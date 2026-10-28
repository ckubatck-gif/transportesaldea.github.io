'use strict';
// Núcleo: utilidades, datos locales, avisos, diálogos, notificaciones y exportación a calendario.
(function () {
  const M = (window.M = {});
  const CFG = (M.CFG = window.APP_CONFIG);
  M.H = window.APP_HORARIO;

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  M.$ = $;
  M.$$ = $$;
  M.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  M.uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

  /* ---------- Fechas (siempre hora local, formato 'AAAA-MM-DDTHH:MM') ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  M.pad = pad;
  M.ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  M.hm = (d) => pad(d.getHours()) + ':' + pad(d.getMinutes());
  M.ldt = (d) => M.ymd(d) + 'T' + M.hm(d);
  M.parseL = (s) => {
    const p = String(s || '').split('T');
    const f = (p[0] || '').split('-').map(Number);
    const h = (p[1] || '00:00').split(':').map(Number);
    return new Date(f[0], (f[1] || 1) - 1, f[2] || 1, h[0] || 0, h[1] || 0);
  };
  M.parseD = (s) => M.parseL(String(s).slice(0, 10) + 'T00:00');
  M.addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()); x.setDate(x.getDate() + n); return x; };
  M.addMin = (d, n) => new Date(d.getTime() + n * 60000);
  M.inicioSemana = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  M.DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
  M.fLarga = (d) => new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  M.fCorta = (d) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(d);
  M.fMes = (d) => new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(d);
  M.fCuando = (s) => { const d = M.parseL(s); return M.fCorta(d) + ' · ' + M.hm(d); };
  M.fDiaSemana = (d) => new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(d);
  M.diasEntre = (a, b) => Math.round((M.parseD(M.ymd(b)) - M.parseD(M.ymd(a))) / 86400000);

  /* ---------- Dinero (en céntimos) ---------- */
  M.eur = (c) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: CFG.moneda || 'EUR' }).format((c || 0) / 100);
  M.aCent = (v) => { const n = Number(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(n) ? Math.round(n * 100) : 0; };
  M.deCent = (c) => ((c || 0) / 100).toFixed(2);
  M.totales = (p) => {
    let sub = 0;
    for (const l of (Array.isArray(p.lineas) ? p.lineas : [])) sub += Math.round((Number(l.cantidad) || 0) * (l.precioC || 0));
    const iva = Math.round((sub * (Number(p.ivaPct) || 0)) / 100);
    return { sub, iva, total: sub + iva };
  };

  /* ---------- Teléfonos ---------- */
  M.telHref = (t) => 'tel:' + String(t || '').replace(/[^\d+]/g, '');
  M.waHref = (t) => {
    let d = String(t || '').replace(/[^\d+]/g, '');
    if (d.startsWith('+')) d = d.slice(1);
    else if (d.startsWith('00')) d = d.slice(2);
    else if (d.length === 9 && CFG.prefijoPais) d = CFG.prefijoPais + d;
    return 'https://wa.me/' + d;
  };

  /* ---------- Catálogos ---------- */
  M.ESTADOS_CLIENTE = { lead: 'Contacto nuevo', activo: 'Cliente', inactivo: 'Inactivo' };
  M.ESTADOS_PRES = { borrador: 'Borrador', enviado: 'Enviado', aceptado: 'Aceptado', rechazado: 'Rechazado' };
  M.CLASE_PRES = { borrador: '', enviado: 'info', aceptado: 'ok', rechazado: 'danger' };
  M.ESTADOS_CITA = { pendiente: 'Pendiente', confirmada: 'Confirmada', hecha: 'Hecha', cancelada: 'Cancelada' };
  M.TIPOS_CITA = ['Visita de valoración', 'Mudanza', 'Transporte', 'Reparto', 'Otra'];

  /* ---------- Datos locales ---------- */
  const KEY = 'mudanzas.datos.v1';
  const KEY_CLAVE = 'mudanzas.clave';
  M.storageOK = true;

  const MOLDES = {
    cliente: () => ({ id: '', nombre: '', telefono: '', email: '', direccion: '', estado: 'lead', notas: '', creado: '' }),
    presupuesto: () => ({ id: '', numero: '', clienteId: '', tipo: 'Mudanza', origen: '', destino: '', fecha: '', lineas: [], ivaPct: CFG.iva, validezDias: CFG.validezPresupuestoDias, estado: 'borrador', notas: '', creado: '', enviadoEn: '' }),
    cita: () => ({ id: '', clienteId: '', titulo: '', tipo: 'Visita de valoración', inicio: '', duracionMin: 60, lugar: '', estado: 'pendiente', notas: '', presupuestoId: '' }),
    recordatorio: () => ({ id: '', tipo: 'llamada', titulo: '', clienteId: '', cuando: '', notas: '', hecho: false, avisado: false, citaId: '' })
  };
  M.nuevo = (tipo) => { const o = MOLDES[tipo](); o.id = M.uid(); if ('creado' in o) o.creado = M.ldt(new Date()); return o; };

  function arreglar(tipo, o) {
    const base = MOLDES[tipo]();
    const r = {};
    for (const k of Object.keys(base)) {
      const v = o && typeof o === 'object' ? o[k] : undefined;
      if (typeof base[k] === 'string') r[k] = v == null ? base[k] : String(v).slice(0, 5000);
      else if (typeof base[k] === 'number') r[k] = Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : base[k];
      else if (typeof base[k] === 'boolean') r[k] = v === true;
      else if (Array.isArray(base[k])) {
        r[k] = Array.isArray(v) ? v.slice(0, 200).map((l) => ({
          concepto: String((l && l.concepto) || '').slice(0, 300),
          cantidad: Number.isFinite(Number(l && l.cantidad)) ? Number(l.cantidad) : 1,
          precioC: Number.isFinite(Number(l && l.precioC)) ? Math.round(Number(l.precioC)) : 0
        })) : [];
      }
    }
    if (!r.id) r.id = M.uid();
    return r;
  }
  function normalizar(d) {
    const b = { v: 1, clientes: [], presupuestos: [], citas: [], recordatorios: [] };
    if (!d || typeof d !== 'object') return b;
    const m = { clientes: 'cliente', presupuestos: 'presupuesto', citas: 'cita', recordatorios: 'recordatorio' };
    for (const k of Object.keys(m)) b[k] = Array.isArray(d[k]) ? d[k].filter((x) => x && typeof x === 'object').map((x) => arreglar(m[k], x)) : [];
    return b;
  }
  M.normalizar = normalizar;

  function cargar() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return normalizar(JSON.parse(raw));
    } catch (e) {
      M.storageOK = false;
    }
    return normalizar(null);
  }
  M.db = cargar();
  let avisoGuardado = false;
  M.guardar = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(M.db));
      M.storageOK = true;
    } catch (e) {
      M.storageOK = false;
      if (!avisoGuardado) {
        avisoGuardado = true;
        M.toast('Este navegador no permite guardar los datos. Exporta una copia desde Ajustes.', 'err');
      }
    }
  };
  M.getClave = () => { try { return localStorage.getItem(KEY_CLAVE) || ''; } catch (e) { return ''; } };
  M.setClave = (v) => { try { if (v) localStorage.setItem(KEY_CLAVE, v); else localStorage.removeItem(KEY_CLAVE); } catch (e) { /* sin almacenamiento */ } };
  const KEY_SYNC = 'mudanzas.buzon';
  M.getBuzon = () => { try { return JSON.parse(localStorage.getItem(KEY_SYNC) || 'null') || { pendientes: [], cuando: '' }; } catch (e) { return { pendientes: [], cuando: '' }; } };
  M.setBuzon = (v) => { try { localStorage.setItem(KEY_SYNC, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };

  M.exportar = () => JSON.stringify({ app: 'mudanzas', version: 1, exportado: new Date().toISOString(), datos: M.db }, null, 2);
  M.importar = (texto) => {
    const j = JSON.parse(texto);
    if (!j || j.app !== 'mudanzas' || !j.datos) throw new Error('Archivo no válido');
    return normalizar(j.datos);
  };

  M.cliente = (id) => M.db.clientes.find((c) => c.id === id);
  M.nombreCliente = (id) => { const c = M.cliente(id); return c ? c.nombre : ''; };
  M.siguienteNumero = () => {
    const anio = new Date().getFullYear();
    let max = 0;
    for (const p of M.db.presupuestos) {
      const m = /^P-(\d{4})-(\d+)$/.exec(p.numero || '');
      if (m && Number(m[1]) === anio) max = Math.max(max, Number(m[2]));
    }
    return 'P-' + anio + '-' + String(max + 1).padStart(3, '0');
  };

  /* ---------- Iconos (trazos de Feather Icons, licencia MIT) ---------- */
  const ICONOS = {
    hoy: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    agenda: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    clientes: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    presupuestos: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    solicitudes: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    ajustes: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    camion: '<rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    mas: '<path d="M12 5v14M5 12h14"/>',
    tel: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    campana: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>',
    izq: '<path d="M15 18l-6-6 6-6"/>',
    der: '<path d="M9 18l6-6-6-6"/>',
    sync: '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>'
  };
  M.ico = (n, cls) => '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONOS[n] || '') + '</svg>';

  /* ---------- Avisos y diálogos ---------- */
  M.toast = (msg, tipo, acciones) => {
    acciones = acciones || [];
    const cont = $('#toasts');
    if (!cont) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (tipo || '');
    el.setAttribute('role', tipo === 'err' ? 'alert' : 'status');
    el.innerHTML = '<span>' + M.esc(msg) + '</span>' + acciones.map((a, i) => '<button type="button" data-ta="' + i + '">' + M.esc(a.label) + '</button>').join('');
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ta]');
      if (b) { acciones[Number(b.dataset.ta)].fn(); el.remove(); }
    });
    cont.appendChild(el);
    setTimeout(() => el.remove(), acciones.length ? 20000 : 5000);
  };

  M.dialogo = (html, clase) => {
    const d = $('#dlg');
    d.className = clase || '';
    d.innerHTML = html;
    d.returnValue = '';
    if (!d.open) d.showModal();
    return d;
  };
  M.cerrar = () => { const d = $('#dlg'); if (d.open) d.close(); };
  M.confirmar = (msg, opts) => new Promise((res) => {
    opts = opts || {};
    const d = M.dialogo('<form method="dialog" class="dlg-body"><p>' + M.esc(msg) + '</p><div class="dlg-actions"><button class="btn" value="no">Cancelar</button><button class="btn ' + (opts.peligro ? 'danger' : 'primary') + '" value="si">' + M.esc(opts.ok || 'Aceptar') + '</button></div></form>', 'sm');
    d.addEventListener('close', () => res(d.returnValue === 'si'), { once: true });
  });

  /* ---------- Notificaciones del sistema (solo con la app abierta) ---------- */
  M.notificar = (titulo, cuerpo, tag) => {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((r) => r.showNotification(titulo, { body: cuerpo, tag: tag, icon: 'icons/icon-192.png' })).catch(() => new Notification(titulo, { body: cuerpo, tag: tag }));
      } else {
        new Notification(titulo, { body: cuerpo, tag: tag });
      }
    } catch (e) { /* notificaciones no disponibles */ }
  };

  /* ---------- Exportar a calendario (.ics) ---------- */
  const icsEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
  const icsFecha = (s) => String(s).replace(/[-:]/g, '') + '00';
  const plegar = (linea) => {
    const cs = Array.from(linea);
    if (cs.length <= 70) return linea;
    const partes = [];
    for (let i = 0; i < cs.length; i += 65) partes.push(cs.slice(i, i + 65).join(''));
    return partes.join('\r\n ');
  };
  // eventos: [{uid, inicio:'AAAA-MM-DDTHH:MM', fin, titulo, descripcion, lugar, avisoMin}]
  M.ics = (eventos) => {
    const sello = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gestion de mudanzas//ES', 'CALSCALE:GREGORIAN'];
    for (const e of eventos) {
      L.push('BEGIN:VEVENT', 'UID:' + e.uid + '@mudanzas-app', 'DTSTAMP:' + sello, 'DTSTART:' + icsFecha(e.inicio), 'DTEND:' + icsFecha(e.fin), 'SUMMARY:' + icsEsc(e.titulo));
      if (e.descripcion) L.push('DESCRIPTION:' + icsEsc(e.descripcion));
      if (e.lugar) L.push('LOCATION:' + icsEsc(e.lugar));
      if (e.avisoMin != null) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(e.titulo), 'TRIGGER:-PT' + Math.max(0, e.avisoMin) + 'M', 'END:VALARM');
      L.push('END:VEVENT');
    }
    L.push('END:VCALENDAR');
    return L.map(plegar).join('\r\n') + '\r\n';
  };
  M.descargar = (nombre, contenido, mime) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([contenido], { type: mime || 'application/octet-stream' }));
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };
  M.eventoCita = (c) => {
    const fin = M.ldt(M.addMin(M.parseL(c.inicio), c.duracionMin || 60));
    const cli = M.cliente(c.clienteId);
    return { uid: c.id, inicio: c.inicio, fin: fin, titulo: c.titulo || c.tipo, descripcion: [cli ? 'Cliente: ' + cli.nombre : '', cli && cli.telefono ? 'Tel: ' + cli.telefono : '', c.notas].filter(Boolean).join('\n'), lugar: c.lugar, avisoMin: 30 };
  };
  M.eventoRec = (r) => {
    const cli = M.cliente(r.clienteId);
    return { uid: r.id, inicio: r.cuando, fin: M.ldt(M.addMin(M.parseL(r.cuando), 15)), titulo: (r.tipo === 'llamada' ? 'Llamar: ' : '') + (r.titulo || (cli ? cli.nombre : 'Recordatorio')), descripcion: [cli ? 'Cliente: ' + cli.nombre : '', cli && cli.telefono ? 'Tel: ' + cli.telefono : '', r.notas].filter(Boolean).join('\n'), lugar: '', avisoMin: 0 };
  };

  /* ---------- Cálculos de agenda ---------- */
  // Eventos de un día (citas no canceladas + recordatorios pendientes o hechos), ordenados por hora.
  M.eventosDia = (ymd) => {
    const out = [];
    for (const c of M.db.citas) if (c.estado !== 'cancelada' && c.inicio.slice(0, 10) === ymd) out.push({ k: 'cita', id: c.id, hora: c.inicio.slice(11, 16), titulo: c.titulo || c.tipo, hecho: c.estado === 'hecha', o: c });
    for (const r of M.db.recordatorios) if (r.cuando.slice(0, 10) === ymd) out.push({ k: 'rec', id: r.id, hora: r.cuando.slice(11, 16), titulo: r.titulo || M.nombreCliente(r.clienteId) || 'Recordatorio', hecho: r.hecho, o: r });
    out.sort((a, b) => (a.hora + a.k).localeCompare(b.hora + b.k));
    return out;
  };
  M.solapes = (inicio, dur, excluirId) => {
    const a = M.parseL(inicio).getTime();
    const b = a + (dur || 60) * 60000;
    return M.db.citas.filter((c) => c.id !== excluirId && c.estado !== 'cancelada' && c.inicio && (() => {
      const s = M.parseL(c.inicio).getTime();
      const e = s + (c.duracionMin || 60) * 60000;
      return s < b && e > a;
    })());
  };
})();
