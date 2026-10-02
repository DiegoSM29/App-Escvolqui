import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, Button, Alert, TouchableOpacity, 
  KeyboardAvoidingView, Platform, ScrollView 
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { crearJugadorService, actualizarJugadorService } from '../services/jugadorService';
import { calcularEdad } from '../utils/dateUtils';

export default function RegistroJugador({ navigation, route }) {
  const jugadorEditar = route.params?.jugador;

  const [nombre, setNombre] = useState('');
  const [grupo, setGrupo] = useState('1'); // Valor por defecto en 1
  const [telefono, setTelefono] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState(new Date());
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [cargando, setCargando] = useState(false);

  const GRUPOS_DISPONIBLES = ['1', '2', '3', '4'];

  useEffect(() => {
    if (jugadorEditar) {
      setNombre(jugadorEditar.nombre !== undefined ? String(jugadorEditar.nombre) : '');
      // Si el grupo guardado está entre 1 y 4 lo asigna, de lo contrario por defecto '1'
      const grupoExistente = jugadorEditar.grupo !== undefined ? String(jugadorEditar.grupo) : '1';
      setGrupo(GRUPOS_DISPONIBLES.includes(grupoExistente) ? grupoExistente : '1');

      setTelefono(jugadorEditar.telefono !== undefined ? String(jugadorEditar.telefono) : '');
      
      if (jugadorEditar.fechaNacimiento) {
        let d;
        if (jugadorEditar.fechaNacimiento.toDate) {
          d = jugadorEditar.fechaNacimiento.toDate();
        } else {
          d = new Date(jugadorEditar.fechaNacimiento);
        }
        if (!isNaN(d.getTime())) setFechaNacimiento(d);
      }
    }
  }, [jugadorEditar]);

  const formatearFechaSegura = (fecha) => {
    if (!fecha || isNaN(fecha.getTime())) return 'Fecha inválida';
    const dia = fecha.getDate().toString().padStart(2, '0');
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const anio = fecha.getFullYear();
    return `${dia}/${mes}/${anio}`;
  };

  const alCambiarFecha = (event, fechaSeleccionada) => {
    setMostrarCalendario(false);
    if (fechaSeleccionada) {
      setFechaNacimiento(fechaSeleccionada);
    }
  };

  const manejarGuardar = async () => {
    const nombreStr = String(nombre);
    const telefonoStr = String(telefono);

    if (!nombreStr.trim() || !telefonoStr.trim()) {
      Alert.alert("Error", "Por favor llena todos los campos obligatorios");
      return;
    }

    setCargando(true);
    const edadCalculada = calcularEdad(fechaNacimiento.toISOString());

    const datosJugador = {
      nombre: nombreStr.trim(),
      edad: edadCalculada,
      fechaNacimiento: fechaNacimiento.toISOString(),
      grupo: grupo, // Se guarda el número seleccionado (1, 2, 3 o 4)
      telefono: telefonoStr.trim()
    };

    try {
      if (jugadorEditar) {
        await actualizarJugadorService(jugadorEditar.id, datosJugador);
        Alert.alert("Éxito", "Jugador actualizado correctamente.", [
          { text: "OK", onPress: () => navigation.goBack() }
        ]);
      } else {
        await crearJugadorService(datosJugador);
        Alert.alert("Éxito", "Jugador registrado correctamente.", [
          { text: "OK", onPress: () => navigation.goBack() }
        ]);
      }
    } catch (e) {
      console.error("Error al guardar jugador:", e);
      Alert.alert("Error", `No se pudo guardar la información: ${e.message}`);
    } finally {
      setCargando(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.flexContainer} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{jugadorEditar ? "Editar Jugador ✏️" : "Nuevo Jugador 🏐"}</Text>
        
        <View style={styles.form}>
          <TextInput 
            style={styles.input} 
            placeholder="Nombre completo" 
            value={nombre} 
            onChangeText={setNombre} 
          />

          <Text style={styles.label}>Selecciona el Grupo:</Text>
          <View style={styles.grupoContainer}>
            {GRUPOS_DISPONIBLES.map((num) => (
              <TouchableOpacity
                key={num}
                style={[styles.grupoBoton, grupo === num && styles.grupoBotonActivo]}
                onPress={() => setGrupo(num)}
              >
                <Text style={[styles.grupoTexto, grupo === num && styles.grupoTextoActivo]}>
                  {num}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput 
            style={styles.input} 
            placeholder="Nro de Teléfono" 
            value={telefono} 
            keyboardType="phone-pad" 
            onChangeText={setTelefono} 
          />
          
          <TouchableOpacity style={styles.dateInput} onPress={() => setMostrarCalendario(true)}>
            <Text style={styles.dateInputText}>
              🎂 F. Nacimiento: {formatearFechaSegura(fechaNacimiento)} ({calcularEdad(fechaNacimiento.toISOString())} años)
            </Text>
          </TouchableOpacity>

          {mostrarCalendario && (
            <DateTimePicker 
              value={fechaNacimiento} 
              mode="date" 
              display="default" 
              onChange={alCambiarFecha} 
              maximumDate={new Date()} 
            />
          )}

          <View style={styles.buttonContainer}>
            <Button 
              title={cargando ? "Guardando..." : (jugadorEditar ? "Actualizar Jugador" : "Guardar Jugador")} 
              onPress={manejarGuardar} 
              color="#1E88E5" 
              disabled={cargando}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flexContainer: { flex: 1, backgroundColor: '#F5F5F5' },
  scrollContainer: { flexGrow: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, color: '#333' },
  form: { backgroundColor: '#FFF', padding: 20, borderRadius: 10, elevation: 3 },
  input: { borderWidth: 1, borderColor: '#DDD', padding: 12, marginBottom: 12, borderRadius: 5, backgroundColor: '#FAFAFA', fontSize: 16 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#444', marginBottom: 6 },
  grupoContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  grupoBoton: { flex: 1, paddingVertical: 10, borderWidth: 1, borderColor: '#DDD', borderRadius: 5, alignItems: 'center', marginHorizontal: 3, backgroundColor: '#FAFAFA' },
  grupoBotonActivo: { backgroundColor: '#1E88E5', borderColor: '#1E88E5' },
  grupoTexto: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  grupoTextoActivo: { color: '#FFF' },
  dateInput: { borderWidth: 1, borderColor: '#DDD', padding: 12, marginBottom: 20, borderRadius: 5, backgroundColor: '#FAFAFA', justifyContent: 'center' },
  dateInputText: { color: '#333', fontSize: 16, fontWeight: '500' },
  buttonContainer: { marginTop: 10 }
});