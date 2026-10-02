import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { db } from '../firebaseConfig';
import { collection, query, collectionGroup, onSnapshot } from 'firebase/firestore';
import { borrarTodosLosPagosPrueba } from '../services/jugadorService';

export default function ReportesScreen() {
  const [pagos, setPagos] = useState([]);
  const [reporteMeses, setReporteMeses] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Escuchar el resumen mensual persistente en la colección independiente
    const qReportes = collection(db, "reportes_mensuales");
    const unsubReportes = onSnapshot(qReportes, (snapshot) => {
      const resumenList = snapshot.docs.map(docSnap => docSnap.data());
      setReporteMeses(resumenList);
    });

    // Escuchar el historial general de pagos
    const qPagos = query(collectionGroup(db, "pagos"));
    const unsubPagos = onSnapshot(qPagos, (snapshot) => {
      const listaPagos = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        listaPagos.push({ 
          id: docSnap.id, 
          ...data,
          monto: parseFloat(data.monto || 0) 
        });
      });

      // Ordenar por fecha descendente
      listaPagos.sort((a, b) => {
        const fechaA = a.fechaPago ? new Date(a.fechaPago).getTime() : 0;
        const fechaB = b.fechaPago ? new Date(b.fechaPago).getTime() : 0;
        return fechaB - fechaA;
      });

      setPagos(listaPagos);
      setCargando(false);
    });

    return () => {
      unsubReportes();
      unsubPagos();
    };
  }, []);

  const ejecutarLimpieza = () => {
    Alert.alert(
      "Limpiar Historial de Pagos",
      "¿Deseas eliminar las transacciones individuales del historial? Esto NO afectará el resumen de recaudación por mes.",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Sí, limpiar historial", 
          style: "destructive", 
          onPress: async () => {
            try {
              setCargando(true);
              await borrarTodosLosPagosPrueba();
              Alert.alert("Éxito", "Historial de pagos limpiado. El acumulado mensual se conserva.");
            } catch (error) {
              Alert.alert("Error", "No se pudieron borrar los registros del historial.");
            } finally {
              setCargando(false);
            }
          } 
        }
      ]
    );
  };

  if (cargando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1E88E5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>💰 Resumen Recaudado por Mes</Text>
        <TouchableOpacity style={styles.cleanButton} onPress={ejecutarLimpieza}>
          <Text style={styles.cleanButtonText}>🧹 Limpiar Historial</Text>
        </TouchableOpacity>
      </View>
      
      {/* Resumen independiente que periste tras borrar el historial */}
      <View style={styles.summaryContainer}>
        <FlatList
          data={reporteMeses}
          keyExtractor={(item, index) => `resumen_${item.mes}_${index}`}
          renderItem={({ item }) => (
            <View style={styles.reportCard}>
              <Text style={styles.reportMes}>{item.mes}</Text>
              <Text style={styles.reportTotal}>Total: Bs {item.total ? item.total.toFixed(2) : '0.00'}</Text>
              <Text style={styles.reportCount}>Pagos registrados: {item.cantidad || 0}</Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No hay recaudación registrada.</Text>
          }
        />
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 15 }]}>📜 Historial General de Pagos</Text>
      
      {/* Historial de transacciones con nombre de jugador */}
      <FlatList
        data={pagos}
        keyExtractor={(item, index) => `historial_${item.id}_${index}`}
        renderItem={({ item }) => {
          const concepto = item.conceptoMes ? `(${item.conceptoMes})` : '';
          const pendiente = item.montoPendiente ? parseFloat(item.montoPendiente).toFixed(2) : '0.00';
          const nombreJugador = item.nombreJugador || 'Jugador no especificado';

          return (
            <View style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <Text style={styles.playerText}>{nombreJugador}</Text>
                <Text style={styles.historyMonto}>Bs {item.monto ? item.monto.toFixed(2) : '0.00'}</Text>
              </View>
              <Text style={styles.historyMes}>
                Mes: {item.labelMes || 'N/A'} <Text style={styles.conceptText}>{concepto}</Text>
              </Text>
              <Text style={styles.historyDetail}>Método: {item.metodoPago || 'Efectivo'}</Text>
              <Text style={styles.historyDetail}>
                Estado: {item.esCompleto ? '🟢 Completo' : `🔴 Incompleto (Debe: Bs ${pendiente})`}
              </Text>
              <Text style={styles.historyDate}>
                Fecha: {item.fechaPago ? new Date(item.fechaPago).toLocaleString('es-ES') : 'N/A'}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>El historial de pagos está vacío.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: '#F5F5F5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#222' },
  cleanButton: { backgroundColor: '#FFEBEE', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  cleanButtonText: { color: '#D32F2F', fontSize: 12, fontWeight: 'bold' },
  summaryContainer: { maxHeight: 180 },
  
  reportCard: { 
    backgroundColor: '#EBF7EE', 
    padding: 16, 
    borderRadius: 14, 
    marginBottom: 10, 
    borderWidth: 1, 
    borderColor: '#D2EBD7' 
  },
  reportMes: { fontSize: 22, fontWeight: 'bold', color: '#276838', marginBottom: 4 },
  reportTotal: { fontSize: 20, fontWeight: 'bold', color: '#276838', marginBottom: 4 },
  reportCount: { fontSize: 15, color: '#555' },

  historyCard: { backgroundColor: '#FFF', padding: 12, borderRadius: 8, marginBottom: 8, elevation: 1 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  playerText: { fontWeight: 'bold', fontSize: 15, color: '#1E88E5' },
  historyMes: { fontWeight: '600', fontSize: 13, color: '#333', marginBottom: 2 },
  conceptText: { fontWeight: 'normal', color: '#666', fontSize: 12 },
  historyMonto: { fontWeight: 'bold', fontSize: 15, color: '#2E7D32' },
  historyDetail: { fontSize: 12, color: '#666' },
  historyDate: { fontSize: 10, color: '#999', marginTop: 4 },
  emptyText: { color: '#888', fontStyle: 'italic', marginVertical: 10, textAlign: 'center' }
});