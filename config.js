// Configuración de la empresa. Edita este archivo y vuelve a desplegar.
// Los valores marcados con (EJEMPLO) son provisionales: sustitúyelos por los reales.
window.APP_CONFIG = {
  empresa: 'Mi Empresa de Mudanzas',          // (EJEMPLO) nombre que se muestra en la app y en los presupuestos
  telefono: '',                                // teléfono de contacto que se muestra en la página pública
  prefijoPais: '34',                           // se usa para enlaces de WhatsApp si el número no lleva prefijo
  iva: 21,                                     // % de IVA por defecto en presupuestos (compruébalo con tu gestor)
  moneda: 'EUR',
  validezPresupuestoDias: 30,                  // (EJEMPLO) validez por defecto de un presupuesto

  // Datos del responsable del tratamiento que se muestran en la página pública (RGPD, art. 13).
  responsable: '',                             // p. ej. razón social y NIF/CIF
  politicaPrivacidadUrl: '',                   // enlace a vuestra política de privacidad

  // Horario de atención. Día de la semana (0 = domingo ... 6 = sábado) -> [apertura, cierre] o null si cerrado.
  horario: {                                   // (EJEMPLO) horario provisional
    1: ['09:00', '19:00'],
    2: ['09:00', '19:00'],
    3: ['09:00', '19:00'],
    4: ['09:00', '19:00'],
    5: ['09:00', '19:00'],
    6: ['09:00', '14:00'],
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

  function tramo(d) {
    if (C.diasCerrados.indexOf(ymd(d)) >= 0) return null;
    return C.horario[d.getDay()] || null;
  }
  function fechaConHora(d, hhmm) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setHours(Math.floor(aMin(hhmm) / 60), aMin(hhmm) % 60, 0, 0);
    return x;
  }
  function estaAbierto(ahora) {
    const t = tramo(ahora);
    if (!t) return false;
    const m = ahora.getHours() * 60 + ahora.getMinutes();
    return m >= aMin(t[0]) && m < aMin(t[1]);
  }
  // Primer instante >= ahora en el que se puede atender (ahora mismo si está abierto).
  function proximaApertura(ahora) {
    for (let i = 0; i < 15; i++) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + i);
      const t = tramo(d);
      if (!t) continue;
      const ap = fechaConHora(d, t[0]);
      const ci = fechaConHora(d, t[1]);
      if (ahora < ci) return ahora > ap ? new Date(ahora) : ap;
    }
    return null;
  }
  function cierreHoy(ahora) {
    const t = tramo(ahora);
    return t ? fechaConHora(ahora, t[1]) : null;
  }
  return { tramo, estaAbierto, proximaApertura, cierreHoy, ymd };
})();
