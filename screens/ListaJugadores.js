import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, FlatList, TextInput, TouchableOpacity, 
  ScrollView, Alert, Modal, Switch 
} from 'react-native';
import { db } from '../firebaseConfig';
import { query, collectionGroup, onSnapshot } from 'firebase/firestore';

import { 
  suscribirJugadoresService, 
  registrarPagoService, 
  eliminarJugadorService,
  actualizarJugadorService 
} from '../services/jugadorService';
import { calcularMesesPendientes, calcularEdad } from '../utils/dateUtils';

export default function ListaJugadores({ navigation }) {
  const [busqueda, setBusqueda] = useState('');
  const [jugadores, setJugadores] = useState([]);
  const [pagosGlobales, setPagosGlobales] = useState({});
  const [vista, setVista] = useState('deudores');

  // Modal Pago
  const [modalVisible, setModalVisible] = useState(false);
  const [pagoSeleccionado, setPagoSeleccionado] = useState(null);
  
  // Montos
  const [costoTotalMes, setCostoTotalMes] = useState('');
  const [esAbonoExistente, setEsAbonoExistente] = useState(false);
  const [monto, setMonto] = useState('');
  const [montoPendiente, setMontoPendiente] = useState('0');
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [esCompleto, setEsCompleto] = useState(false);

  useEffect(() => {
    const unsubJugadores = suscribirJugadoresService((listaActualizada) => {
      setJugadores(listaActualizada);
    });

    // Escucha global de pagos registrados
    const qPagos = query(collectionGroup(db, "pagos"));
    const unsubPagos = onSnapshot(qPagos, (snapshot) => {
      const mapeoPagos = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const jugadorId = docSnap.ref.parent?.parent?.id;
        
        if (jugadorId) {
          if (!mapeoPagos[jugadorId]) mapeoPagos[jugadorId] = [];
          
          const claveMes = data.mesCorresponde || `${data.anio}_${data.mes}`;
          
          const estaSaldado = data.esCompleto === true || (data.montoPendiente !== undefined && parseFloat(data.montoPendiente) === 0);
          
          if (estaSaldado) {
            mapeoPagos[jugadorId].push(claveMes);
          }
        }
      });
      setPagosGlobales(mapeoPagos);
    });

    return () => {
      unsubJugadores();
      unsubPagos();
    };
  }, []);

  const abrirModalPago = (jugador, mesItem) => {
    const registroPrevio = jugador?.mesesPagos?.[mesItem.id];

    if (registroPrevio && registroPrevio.montoPendiente !== undefined && parseFloat(registroPrevio.montoPendiente) > 0) {
      const saldoRestante = parseFloat(registroPrevio.montoPendiente).toString();
      setEsAbonoExistente(true);
      setCostoTotalMes(saldoRestante);
      setMonto(saldoRestante);
      setMontoPendiente('0');
      setEsCompleto(true);
    } else {
      setEsAbonoExistente(false);
      setCostoTotalMes('');
      setMonto('');
      setMontoPendiente('0');
      setEsCompleto(true);
    }

    setPagoSeleccionado({ jugador, mesItem });
    setMetodoPago('Efectivo');
    setModalVisible(true);
  };

  const handleCostoTotalChange = (val) => {
    setCostoTotalMes(val);
    const total = parseFloat(val) || 0;
    const pagado = parseFloat(monto) || 0;

    if (esCompleto) {
      setMonto(val);
      setMontoPendiente('0');
    } else {
      const restante = Math.max(0, total - pagado);
      setMontoPendiente(restante.toFixed(2));
    }
  };

  const handleMontoChange = (val) => {
    setMonto(val);
    const pagado = parseFloat(val) || 0;
    const total = parseFloat(costoTotalMes) || 0;

    if (pagado >= total && total > 0) {
      setEsCompleto(true);
      setMontoPendiente('0');
    } else {
      setEsCompleto(false);
      const restante = Math.max(0, total - pagado);
      setMontoPendiente(restante.toFixed(2));
    }
  };

  const handleSwitchChange = (val) => {
    setEsCompleto(val);
    const total = parseFloat(costoTotalMes) || 0;

    if (val) {
      setMonto(costoTotalMes);
      setMontoPendiente('0');
    } else {
      const pagado = parseFloat(monto) || 0;
      const restante = Math.max(0, total - pagado);
      setMontoPendiente(restante.toFixed(2));
    }
  };

  const guardarPago = async () => {
    const montoNum = parseFloat(monto);
    const costoTotalNum = parseFloat(costoTotalMes);

    if (isNaN(costoTotalNum) || costoTotalNum <= 0) {
      Alert.alert("Error", "Ingresa un monto total válido para la mensualidad.");
      return;
    }

    if (isNaN(montoNum) || montoNum <= 0) {
      Alert.alert("Error", "Ingresa un monto a cobrar válido.");
      return;
    }

    if (montoNum > costoTotalNum) {
      Alert.alert("Error", `El cobro (Bs ${montoNum}) no puede ser mayor que la deuda del mes (Bs ${costoTotalNum}).`);
      return;
    }

    const pendienteNum = esCompleto ? 0 : Math.max(0, costoTotalNum - montoNum);
    const saldado = esCompleto || pendienteNum === 0;

    try {
      const { jugador, mesItem } = pagoSeleccionado;

      await registrarPagoService(
        jugador.id, 
        mesItem, 
        { 
          nombreJugador: jugador.nombre,
          monto: montoNum, 
          metodoPago, 
          esCompleto: saldado, 
          montoPendiente: pendienteNum,
          costoTotalMes: costoTotalNum
        }
      );

      const mesesPagosActualizados = {
        ...(jugador.mesesPagos || {}),
        [mesItem.id]: {
          completado: saldado,
          montoPendiente: pendienteNum,
          ultimoPago: new Date().toISOString()
        }
      };

      await actualizarJugadorService(jugador.id, { mesesPagos: mesesPagosActualizados });

      Alert.alert("Éxito", saldado ? "Pago registrado y deuda saldada." : `Abono de Bs ${montoNum} registrado. Queda pendiente: Bs ${pendienteNum}`);
      setModalVisible(false);
    } catch (e) {
      Alert.alert("Error", "No se pudo registrar el pago.");
    }
  };

  const confirmarEliminacion = (jugadorId, nombreJugador) => {
    Alert.alert(
      "Eliminar Jugador",
      `¿Estás seguro de que deseas eliminar a ${nombreJugador}?`,
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Eliminar", 
          style: "destructive",
          onPress: async () => {
            try {
              await eliminarJugadorService(jugadorId);
              Alert.alert("Éxito", "Jugador eliminado.");
            } catch (e) {
              Alert.alert("Error", "No se pudo eliminar el jugador.");
            }
          } 
        }
      ]
    );
  };

  // Filtrado y Ordenamiento unificado (Búsqueda global + Pestaña de estado)
  const jugadoresFiltrados = jugadores
    .filter((jugador) => {
      const mesesPagadosGlobales = pagosGlobales[jugador.id] || [];
      const mesesPagadosCompletos = [...mesesPagadosGlobales];

      if (jugador.mesesPagos) {
        Object.keys(jugador.mesesPagos).forEach(mesId => {
          const itemMes = jugador.mesesPagos[mesId];
          const esSaldado = itemMes.completado === true || (itemMes.montoPendiente !== undefined && parseFloat(itemMes.montoPendiente) === 0);
          
          if (esSaldado && !mesesPagadosCompletos.includes(mesId)) {
            mesesPagadosCompletos.push(mesId);
          }
        });
      }

      const deudas = calcularMesesPendientes(jugador.fechaInscripcion, mesesPagadosCompletos);
      const estaDebe = deudas.length > 0;

      const nombreCompleto = jugador.nombre ? jugador.nombre.toLowerCase() : '';
      const textoBusqueda = busqueda.trim().toLowerCase();
      const coincideBusqueda = !textoBusqueda || nombreCompleto.includes(textoBusqueda);

      // Si el usuario está escribiendo en la búsqueda, priorizamos encontrar al jugador sin importar la pestaña
      if (textoBusqueda) {
        return coincideBusqueda;
      }

      // Si no hay búsqueda activa, respetamos la pestaña seleccionada
      if (vista === 'deudores' && !estaDebe) return false;
      if (vista === 'alDia' && estaDebe) return false;

      return true;
    })
    .sort((a, b) => {
      const fechaA = a.fechaInscripcion ? new Date(a.fechaInscripcion).getTime() : 0;
      const fechaB = b.fechaInscripcion ? new Date(b.fechaInscripcion).getTime() : 0;
      return fechaB - fechaA; // Más reciente primero
    });

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.reportButton} 
        onPress={() => navigation.navigate('Reportes')}
      >
        <Text style={styles.reportButtonText}>📊 Ver Reporte de Ingresos / Historial</Text>
      </TouchableOpacity>

      {/* Barra de búsqueda única y transversal */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Buscar jugador por nombre..."
          value={busqueda}
          onChangeText={setBusqueda}
        />
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, vista === 'deudores' && styles.tabActive]} 
          onPress={() => setVista('deudores')}
        >
          <Text style={[styles.tabText, vista === 'deudores' && styles.tabTextActive]}>🔴 Deudores</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, vista === 'alDia' && styles.tabActive]} 
          onPress={() => setVista('alDia')}
        >
          <Text style={[styles.tabText, vista === 'alDia' && styles.tabTextActive]}>🟢 Al Día</Text>
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={jugadoresFiltrados}
        keyExtractor={(item, index) => item.id || `jugador_${index}`}
        renderItem={({ item }) => {
          const mesesPagadosGlobales = pagosGlobales[item.id] || [];
          const mesesPagadosCompletos = [...mesesPagadosGlobales];

          if (item.mesesPagos) {
            Object.keys(item.mesesPagos).forEach(mesId => {
              const itemMes = item.mesesPagos[mesId];
              const esSaldado = itemMes.completado === true || (itemMes.montoPendiente !== undefined && parseFloat(itemMes.montoPendiente) === 0);
              
              if (esSaldado && !mesesPagadosCompletos.includes(mesId)) {
                mesesPagadosCompletos.push(mesId);
              }
            });
          }

          const deudas = calcularMesesPendientes(item.fechaInscripcion, mesesPagadosCompletos);
          
          const formatearFechaString = (fechaStr) => {
            if (!fechaStr) return null;
            const d = new Date(fechaStr);
            if (isNaN(d.getTime())) return 'Inválida';
            return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
          };

          const fNac = formatearFechaString(item.fechaNacimiento) || 'No registrada';
          const edadCalculada = item.fechaNacimiento ? calcularEdad(item.fechaNacimiento) : item.edad;
          const fInscripcion = formatearFechaString(item.fechaInscripcion) || 'N/A';

          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.playerName}>{item.nombre}</Text>
                <View style={styles.actionsContainer}>
                  <TouchableOpacity 
                    style={styles.editButton}
                    onPress={() => navigation.navigate('Registro', { jugador: item })}
                  >
                    <Text style={styles.editButtonText}>✏️ Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.deleteButton}
                    onPress={() => confirmarEliminacion(item.id, item.nombre)}
                  >
                    <Text style={styles.deleteButtonText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.playerInfo}>
                <Text style={styles.playerDetail}>🏷️ Grupo: {item.grupo || 'Sin asignar'} | 📞 Tel: {item.telefono || 'N/A'}</Text>
                <Text style={styles.playerDetail}>🎂 F. Nacimiento: {fNac} ({edadCalculada || 'N/A'} años)</Text>
                <Text style={styles.playerDetail}>📅 Fecha Inscripción: {fInscripcion}</Text>
                <Text style={styles.playerDetail}>
                  Estado: {deudas.length === 0 ? "🟢 Al día" : `🔴 Debe ${deudas.length} mes(es)`}
                </Text>
              </View>

              {deudas.length > 0 && (
                <View style={styles.debtContainer}>
                  <Text style={styles.debtTitle}>Mensualidades pendientes:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {deudas.map((mes, index) => {
                      const saldoParcial = item?.mesesPagos?.[mes.id]?.montoPendiente;
                      const tieneSaldoPendiente = saldoParcial !== undefined && parseFloat(saldoParcial) > 0;
                      
                      const textoBoton = tieneSaldoPendiente 
                        ? `${mes.label} (Resta: Bs ${saldoParcial})` 
                        : mes.label;

                      return (
                        <TouchableOpacity 
                          key={`deuda_${item.id}_${mes.id}_${index}`} 
                          style={styles.payButton} 
                          onPress={() => abrirModalPago(item, mes)}
                        >
                          <Text style={styles.payButtonText}>{textoBoton}</Text>
                          <Text style={styles.payButtonSubText}>Cobrar</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {busqueda.trim() ? 'No se encontró ningún jugador con ese nombre.' : (vista === 'deudores' ? 'No hay jugadores con deudas.' : 'No hay jugadores al día.')}
          </Text>
        }
      />

      {/* Modal Registrar Pago */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Registrar Pago 💳</Text>
            {pagoSeleccionado && (
              <Text style={styles.modalSubTitle}>
                {pagoSeleccionado.jugador.nombre} - {pagoSeleccionado.mesItem.label}
              </Text>
            )}

            <Text style={styles.label}>
              {esAbonoExistente ? "Deuda Pendiente del Mes (Bs):" : "Monto Total del Mes (Bs):"}
            </Text>
            <TextInput
              style={[styles.modalInput, esAbonoExistente && styles.inputDisabled]}
              keyboardType="numeric"
              placeholder="Ej. 100, 150, 200"
              editable={!esAbonoExistente}
              value={costoTotalMes}
              onChangeText={handleCostoTotalChange}
            />

            <Text style={styles.label}>Monto A Cobrar Hoy (Bs):</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              placeholder="Monto abonado"
              value={monto}
              onChangeText={handleMontoChange}
            />

            <Text style={styles.label}>Método de Pago:</Text>
            <View style={styles.methodsRow}>
              {['Efectivo', 'QR', 'Transferencia'].map((metodo) => (
                <TouchableOpacity 
                  key={metodo} 
                  style={[styles.methodChip, metodoPago === metodo && styles.methodChipActive]}
                  onPress={() => setMetodoPago(metodo)}
                >
                  <Text style={[styles.methodChipText, metodoPago === metodo && styles.methodChipTextActive]}>{metodo}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.label}>¿Saldar Deuda Completa?</Text>
              <Switch value={esCompleto} onValueChange={handleSwitchChange} />
            </View>

            {!esCompleto && (
              <>
                <Text style={styles.label}>Restante por Pagar (Bs):</Text>
                <TextInput
                  style={[styles.modalInput, styles.inputDisabled]}
                  keyboardType="numeric"
                  editable={false}
                  value={montoPendiente}
                />
              </>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={guardarPago}>
                <Text style={styles.saveBtnText}>Guardar Pago</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <TouchableOpacity 
        style={styles.fabButton} 
        onPress={() => navigation.navigate('Registro')}
      >
        <Text style={styles.fabButtonText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 10, paddingHorizontal: 15, backgroundColor: '#F5F5F5' },
  reportButton: { backgroundColor: '#388E3C', padding: 12, borderRadius: 8, marginBottom: 10, alignItems: 'center' },
  reportButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  searchContainer: { marginBottom: 10 },
  searchInput: { borderWidth: 1, borderColor: '#1E88E5', padding: 12, borderRadius: 25, backgroundColor: '#FFF', elevation: 2, paddingLeft: 20, fontSize: 15 },
  tabsContainer: { flexDirection: 'row', marginBottom: 12, backgroundColor: '#DDD', borderRadius: 8, padding: 3 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  tabActive: { backgroundColor: '#1E88E5' },
  tabText: { fontWeight: 'bold', color: '#555' },
  tabTextActive: { color: '#FFF' },
  emptyText: { textAlign: 'center', color: '#888', marginTop: 30, fontSize: 16 },
  card: { backgroundColor: '#FFF', padding: 15, borderRadius: 10, marginBottom: 12, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  playerName: { fontSize: 18, fontWeight: 'bold', color: '#222', flex: 1 },
  actionsContainer: { flexDirection: 'row', alignItems: 'center' },
  editButton: { backgroundColor: '#F0F0F0', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 5, marginRight: 6 },
  editButtonText: { fontSize: 12, color: '#333', fontWeight: 'bold' },
  deleteButton: { backgroundColor: '#FFEBEE', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 5 },
  deleteButtonText: { fontSize: 12 },
  playerInfo: { marginVertical: 8 },
  playerDetail: { fontSize: 13, color: '#666', marginTop: 3 },
  debtContainer: { marginTop: 5, borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 8 },
  debtTitle: { fontSize: 12, fontWeight: 'bold', color: '#E53935', marginBottom: 5 },
  payButton: { backgroundColor: '#E53935', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, marginRight: 8, alignItems: 'center' },
  payButtonText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  payButtonSubText: { color: '#FFCDD2', fontSize: 10, marginTop: 2 },
  fabButton: { position: 'absolute', width: 60, height: 60, alignItems: 'center', justifyContent: 'center', right: 20, bottom: 25, backgroundColor: '#1E88E5', borderRadius: 30, elevation: 5 },
  fabButtonText: { color: 'white', fontSize: 32, lineHeight: 34, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 12, padding: 20, width: '100%', elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', color: '#222' },
  modalSubTitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 15 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#444', marginTop: 8, marginBottom: 4 },
  modalInput: { borderWidth: 1, borderColor: '#CCC', borderRadius: 6, padding: 8, fontSize: 16, backgroundColor: '#FAFAFA' },
  inputDisabled: { backgroundColor: '#E0E0E0', color: '#555' },
  methodsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  methodChip: { flex: 1, padding: 8, borderWidth: 1, borderColor: '#CCC', borderRadius: 6, alignItems: 'center', marginHorizontal: 2 },
  methodChipActive: { backgroundColor: '#1E88E5', borderColor: '#1E88E5' },
  methodChipText: { color: '#333', fontSize: 12 },
  methodChipTextActive: { color: '#FFF', fontWeight: 'bold' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  cancelBtn: { flex: 1, padding: 12, borderRadius: 6, backgroundColor: '#EEE', marginRight: 5, alignItems: 'center' },
  cancelBtnText: { color: '#333', fontWeight: 'bold' },
  saveBtn: { flex: 1, padding: 12, borderRadius: 6, backgroundColor: '#388E3C', marginLeft: 5, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontWeight: 'bold' }
});