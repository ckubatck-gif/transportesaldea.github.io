// Configuración de la empresa. Edita este archivo y vuelve a desplegar.
// Los valores marcados con (EJEMPLO) son provisionales: sustitúyelos por los reales.
window.APP_CONFIG = {
  empresa: 'Transportes Aldea',               // nombre que se muestra en la app y en los presupuestos
  telefono: '666627459',                       // teléfono de contacto que se muestra en la página pública
  prefijoPais: '34',                           // se usa para enlaces de WhatsApp si el número no lleva prefijo
  iva: 21,                                     // % de IVA por defecto en presupuestos (compruébalo con tu gestor)
  moneda: 'EUR',
  validezPresupuestoDias: 30,                  // (EJEMPLO) validez por defecto de un presupuesto

  // Datos del responsable del tratamiento que se muestran en la página pública (RGPD, art. 13).
  responsable: '',                             // p. ej. razón social y NIF/CIF
  politicaPrivacidadUrl: '',                   // enlace a vuestra política de privacidad

  // Horario de atención. Día de la semana (0 = domingo ... 6 = sábado) -> un tramo ['09:00','13:00'],
  // varios tramos [['09:00','13:00'],['15:00','19:00']] o null si cerrado.
  horario: {
    1: [['09:00', '13:30'], ['15:30', '19:30']],
    2: [['09:00', '13:30'], ['15:30', '19:30']],
    3: [['09:00', '13:30'], ['15:30', '19:30']],
    4: [['09:00', '13:30'], ['15:30', '19:30']],
    5: [['09:00', '13:30'], ['15:30', '19:30']],
    6: ['09:30', '14:00'],
    0: null
  },
  // Días cerrados por festivo o vacaciones, formato 'AAAA-MM-DD'.
  diasCerrados: [],

  tiposServicio: ['Mudanza', 'Transporte', 'Reparto', 'Otro']
};

// Utilidades de horario compartidas por la app y la página pública.
window.APP_HORARIO = (function () {
  const C = window.APP_CONFIG;
  const aMin = (hhmm) => { const p = hhmm.split(':'); return Number(p[0]) * 60 + Number(p[1]); };
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

  // Tramos del día como pares [apertura, cierre] de Date; admite un tramo o varios.
  function tramos(d) {
    if (C.diasCerrados.indexOf(ymd(d)) >= 0) return [];
    const h = C.horario[d.getDay()];
    if (!h) return [];
    const lista = Array.isArray(h[0]) ? h : [h];
    return lista.map((t) => [fechaConHora(d, t[0]), fechaConHora(d, t[1])]).sort((a, b) => a[0] - b[0]);
  }
  function fechaConHora(d, hhmm) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setHours(Math.floor(aMin(hhmm) / 60), aMin(hhmm) % 60, 0, 0);
    return x;
  }
  function tramoActual(ahora) {
    return tramos(ahora).find((t) => ahora >= t[0] && ahora < t[1]) || null;
  }
  function estaAbierto(ahora) { return !!tramoActual(ahora); }
  // Primer instante >= ahora en el que se puede atender (ahora mismo si está abierto).
  function proximaApertura(ahora) {
    for (let i = 0; i < 15; i++) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + i);
      for (const t of tramos(d)) {
        if (ahora < t[1]) return ahora > t[0] ? new Date(ahora) : t[0];
      }
    }
    return null;
  }
  // Cierre del tramo en el que estamos (null si ahora está cerrado).
  function cierreHoy(ahora) {
    const t = tramoActual(ahora);
    return t ? t[1] : null;
  }
  // Texto del horario de un día, p. ej. «09:00–13:30 y 15:30–19:30» o «Cerrado».
  function textoDia(dia) {
    const h = C.horario[dia];
    if (!h) return 'Cerrado';
    return (Array.isArray(h[0]) ? h : [h]).map((t) => t[0] + ' – ' + t[1]).join(' y ');
  }
  return { tramos, estaAbierto, proximaApertura, cierreHoy, textoDia, ymd };
})();
