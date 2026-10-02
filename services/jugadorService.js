import { db } from '../firebaseConfig';
import { 
  collection, 
  addDoc, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  increment, 
  query, 
  collectionGroup, 
  getDocs, 
  onSnapshot,
  writeBatch 
} from 'firebase/firestore';

// 1. Escuchar la lista de jugadores en tiempo real
export const suscribirJugadoresService = (callback) => {
  const q = collection(db, "jugadores");
  return onSnapshot(q, (snapshot) => {
    const lista = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    callback(lista);
  });
};

// 2. Obtener los datos de un único jugador por su ID
export const obtenerJugadorPorIdService = async (jugadorId) => {
  try {
    const jugadorRef = doc(db, "jugadores", jugadorId);
    const jugadorSnap = await getDoc(jugadorRef);
    if (jugadorSnap.exists()) {
      return { id: jugadorSnap.id, ...jugadorSnap.data() };
    }
    return null;
  } catch (error) {
    console.error("Error al obtener los datos del jugador: ", error);
    throw error;
  }
};

// 3. Crear un nuevo jugador
export const crearJugadorService = async (datosJugador) => {
  try {
    // Sanitizar datos undefined a string vacío
    const datosLimpios = Object.entries(datosJugador).reduce((acc, [key, value]) => {
      acc[key] = value === undefined ? "" : value;
      return acc;
    }, {});

    const jugadoresRef = collection(db, "jugadores");
    const docRef = await addDoc(jugadoresRef, {
      ...datosLimpios,
      fechaInscripcion: datosLimpios.fechaInscripcion || new Date().toISOString()
    });
    return docRef;
  } catch (error) {
    console.error("Error al crear el jugador: ", error);
    throw error;
  }
};

// 4. Actualizar la información de un jugador (Limpia campos undefined)
// 4. Actualizar la información de un jugador (Solución forzada con setDoc y merge)
export const actualizarJugadorService = async (jugadorId, datosActualizados) => {
  try {
    if (!jugadorId) {
      throw new Error("Se requiere el ID del jugador para realizar la actualización.");
    }

    // Limpiamos los campos undefined para evitar fallos
    const datosLimpios = {};
    Object.keys(datosActualizados).forEach(key => {
      if (datosActualizados[key] !== undefined) {
        datosLimpios[key] = datosActualizados[key];
      }
    });

    console.log("Enviando actualización a Firebase -> ID:", jugadorId);
    console.log("Datos limpios:", datosLimpios);

    const jugadorRef = doc(db, "jugadores", jugadorId);
    
    // Usamos setDoc con merge: true. Es más robusto que updateDoc para evitar errores de campos inexistentes.
    await setDoc(jugadorRef, datosLimpios, { merge: true });
    
    console.log("Actualización exitosa en la base de datos.");
  } catch (error) {
    console.error("Error crítico al actualizar el jugador: ", error);
    throw error;
  }
};

// 5. Registrar un pago individual y acumularlo en el reporte mensual
export const registrarPagoService = async (jugadorId, mesItem, datosPago) => {
  const fechaActual = new Date();
  const mesActualIndex = fechaActual.getMonth();
  const anioActual = fechaActual.getFullYear();
  
  const MESES_NOMBRES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  
  const nombreMesActual = MESES_NOMBRES[mesActualIndex];
  const labelMesActual = `${nombreMesActual} ${anioActual}`;
  const montoIngresado = parseFloat(datosPago.monto) || 0;
  const montoPendienteRestante = parseFloat(datosPago.montoPendiente) || 0;
  const esCompleto = datosPago.esCompleto || montoPendienteRestante === 0;

  const nuevoPago = {
    nombreJugador: datosPago.nombreJugador || 'Jugador no especificado',
    mesCorresponde: mesItem.id,
    conceptoMes: mesItem.label || mesItem.nombre,
    mes: mesActualIndex + 1,
    anio: anioActual,
    labelMes: labelMesActual,
    monto: montoIngresado,
    metodoPago: datosPago.metodoPago || 'Efectivo',
    esCompleto: esCompleto,
    montoPendiente: montoPendienteRestante,
    fechaPago: fechaActual.toISOString()
  };

  const pagosRef = collection(db, "jugadores", jugadorId, "pagos");
  const docRef = await addDoc(pagosRef, nuevoPago);

  const jugadorRef = doc(db, "jugadores", jugadorId);
  const jugadorSnap = await getDoc(jugadorRef);

  if (jugadorSnap.exists()) {
    const jugadorData = jugadorSnap.data();
    const mesesPagos = jugadorData.mesesPagos || {};

    mesesPagos[mesItem.id] = {
      completado: esCompleto,
      montoPendiente: montoPendienteRestante,
      ultimoPago: fechaActual.toISOString()
    };

    await updateDoc(jugadorRef, { mesesPagos });
  }

  const reporteMesRef = doc(db, "reportes_mensuales", labelMesActual);
  await setDoc(reporteMesRef, {
    mes: labelMesActual,
    total: increment(montoIngresado),
    cantidad: increment(1)
  }, { merge: true });

  return docRef;
};

// 6. Eliminar un jugador
export const eliminarJugadorService = async (jugadorId) => {
  const jugadorRef = doc(db, "jugadores", jugadorId);
  return await deleteDoc(jugadorRef);
};

// 7. Borrar solo las transacciones del historial manteniendo 'reportes_mensuales'
export const borrarTodosLosPagosPrueba = async () => {
  try {
    const q = query(collectionGroup(db, "pagos"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });

    await batch.commit();
  } catch (error) {
    console.error("Error al limpiar los pagos: ", error);
    throw error;
  }
};