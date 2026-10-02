export const calcularMesesPendientes = (fechaInscripcionStr, mesesPagadosCompletos = []) => {
  if (!fechaInscripcionStr) return [];

  const fechaInscripcion = new Date(fechaInscripcionStr);
  const fechaActual = new Date();

  const meses = [];
  
  // Se empieza a cobrar a partir del primer día del MES SIGUIENTE a la inscripción
  let fechaIteracion = new Date(fechaInscripcion.getFullYear(), fechaInscripcion.getMonth() + 1, 1);
  const finIteracion = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1);

  const MESES_NOMBRES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  while (fechaIteracion <= finIteracion) {
    const anio = fechaIteracion.getFullYear();
    const mesNum = fechaIteracion.getMonth() + 1;
    const mesId = `${anio}_${mesNum}`;

    if (!mesesPagadosCompletos.includes(mesId)) {
      const nombreMes = MESES_NOMBRES[fechaIteracion.getMonth()];
      meses.push({
        id: mesId,
        label: `${nombreMes} ${anio}`,
        anio,
        mes: mesNum
      });
    }

    fechaIteracion.setMonth(fechaIteracion.getMonth() + 1);
  }

  return meses;
};

export const calcularEdad = (fechaNacimientoStr) => {
  if (!fechaNacimientoStr) return '';
  const hoy = new Date();
  const nac = new Date(fechaNacimientoStr);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) {
    edad--;
  }
  return edad;
};