'use strict';
// Navegación, acciones, formularios, recordatorios y sincronización del buzón.
(function () {
  const M = window.M;
  const { $, $$, esc } = M;
  const V = M.V;
  const S = M.estado;

  /* ---------- Navegación ---------- */
  const RUTAS = [['hoy', 'Hoy'], ['agenda', 'Agenda'], ['clientes', 'Clientes'], ['presupuestos', 'Presupuestos'], ['solicitudes', 'Solicitudes'], ['ajustes', 'Ajustes']];
  const ruta = () => { const p = location.hash.replace(/^#\/?/, '').split('/'); return { a: p[0] || 'hoy', id: p[1] ? decodeURIComponent(p[1]) : '' }; };

  function contadores() {
    const hoy = M.ymd(new Date());
    return {
      hoy: M.db.recordatorios.filter((r) => !r.hecho && r.cuando.slice(0, 10) <= hoy).length,
      solicitudes: M.getBuzon().pendientes.length
    };
  }
  function navegacion(actual) {
    const n = contadores();
    const item = (id, t, lado) => '<a ' + (lado ? 'class="nav" ' : '') + 'href="#/' + id + '"' + (actual === id ? ' aria-current="page"' : '') + '>' + M.ico(id) + '<span>' + t + '</span>' + (n[id] ? '<span class="badge-n" aria-label="' + n[id] + ' pendientes">' + n[id] + '</span>' : '') + '</a>';
    $('#side').innerHTML = '<div class="brand">' + M.ico('camion') + '<span>' + esc(M.CFG.empresa) + '</span></div>' + RUTAS.map((r) => item(r[0], r[1], true)).join('');
    $('#tabs').innerHTML = RUTAS.map((r) => item(r[0], r[1], false)).join('');
  }

  function render() {
    const r = ruta();
    let html;
    try {
      switch (r.a) {
        case 'agenda': html = V.agenda(); break;
        case 'clientes': html = r.id ? V.cliente(r.id) : V.clientes(); break;
        case 'presupuestos': html = r.id ? V.presupuesto(r.id) : V.presupuestos(); break;
        case 'solicitudes': html = V.solicitudes(); break;
        case 'ajustes': html = V.ajustes(); break;
        default: r.a = 'hoy'; html = V.hoy();
      }
    } catch (e) {
      console.error(e);
      html = '<div class="card"><h2>No se pudo mostrar esta pantalla</h2><p class="sub">Tus datos no se han modificado. Recarga la página; si sigue fallando, exporta una copia desde Ajustes.</p></div>';
    }
    $('#main').innerHTML = html;
    navegacion(r.a);
    const t = RUTAS.find((x) => x[0] === r.a);
    document.title = (t ? t[1] : 'Hoy') + ' · ' + M.CFG.empresa;
  }
  function refrescar() { const y = window.scrollY; render(); window.scrollTo(0, y); }
  window.addEventListener('hashchange', () => { M.cerrar(); render(); window.scrollTo(0, 0); });

  /* ---------- Utilidades de formularios ---------- */
  const num = (s) => { const t = String(s == null ? '' : s).trim().replace(',', '.'); return t === '' ? NaN : Number(t); };
  function error(form, msg) { const e = $('#err', form); if (e) { e.textContent = msg; e.hidden = false; e.scrollIntoView({ block: 'nearest' }); } return false; }
  const val = (fd, k) => String(fd.get(k) == null ? '' : fd.get(k)).trim();
  const abrir = (html, clase) => M.dialogo(html, clase);
  const hecho = (msg, extra) => { M.guardar(); M.cerrar(); M.toast(msg, '', extra); refrescar(); };

  function leerLineas(form) {
    const fd = new FormData(form);
    const c = fd.getAll('concepto'), q = fd.getAll('cantidad'), p = fd.getAll('precio');
    const lineas = [];
    let err = '';
    for (let i = 0; i < c.length; i++) {
      const con = String(c[i]).trim(), cs = String(q[i]).trim(), ps = String(p[i]).trim();
      if (!con && !ps) continue;
      const cant = num(cs), prec = num(ps);
      if (!con) err = err || 'Falta el concepto en la línea ' + (i + 1) + '.';
      else if (!Number.isFinite(cant) || cant === 0) err = err || 'La cantidad de la línea ' + (i + 1) + ' no es válida.';
      else if (!Number.isFinite(prec)) err = err || 'El precio de la línea ' + (i + 1) + ' no es válido.';
      lineas.push({ concepto: con, cantidad: Number.isFinite(cant) ? cant : 0, precioC: Number.isFinite(prec) ? Math.round(prec * 100) : 0 });
    }
    return { lineas, err };
  }
  function actualizarTotales() {
    const f = $('#dlg form[data-form="pres"]');
    if (!f) return;
    const iva = num(new FormData(f).get('ivaPct'));
    const t = M.totales({ lineas: leerLineas(f).lineas, ivaPct: Number.isFinite(iva) ? iva : 0 });
    $('#tot', f).innerHTML = '<span>Base imponible</span><span style="text-align:right">' + esc(M.eur(t.sub)) + '</span><span>IVA</span><span style="text-align:right">' + esc(M.eur(t.iva)) + '</span><span class="t">Total</span><span class="t" style="text-align:right">' + esc(M.eur(t.total)) + '</span>';
  }
  function revisarSolape() {
    const f = $('#dlg form[data-form="cita"]');
    if (!f) return;
    const fd = new FormData(f);
    const box = $('#solape', f);
    const fecha = val(fd, 'fecha'), hora = val(fd, 'hora'), dur = Number(val(fd, 'duracion'));
    if (!fecha || !hora || !(dur > 0)) { box.hidden = true; return; }
    const s = M.solapes(fecha + 'T' + hora, dur, val(fd, 'id'));
    if (s.length) { box.hidden = false; box.textContent = 'Solapa con: ' + s.map((c) => c.inicio.slice(11, 16) + ' ' + (c.titulo || c.tipo)).join('; ') + '. Puedes guardarla igualmente.'; } else box.hidden = true;
  }

  /* ---------- Guardado de formularios ---------- */
  const FORMS = {
    cliente(f, fd) {
      const nombre = val(fd, 'nombre');
      if (!nombre) return error(f, 'El nombre es obligatorio.');
      const email = val(fd, 'email');
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return error(f, 'El email no parece válido.');
      let c = M.cliente(val(fd, 'id'));
      const nuevo = !c;
      if (nuevo) { c = M.nuevo('cliente'); M.db.clientes.push(c); }
      Object.assign(c, { nombre, telefono: val(fd, 'telefono'), email, direccion: val(fd, 'direccion'), estado: val(fd, 'estado') || 'lead', notas: val(fd, 'notas') });
      hecho(nuevo ? 'Cliente creado' : 'Cliente actualizado', nuevo ? [{ label: 'Abrir', fn: () => { location.hash = '#/clientes/' + c.id; } }] : []);
    },
    rec(f, fd) {
      const fecha = val(fd, 'fecha'), hora = val(fd, 'hora');
      if (!fecha || !hora) return error(f, 'Indica fecha y hora.');
      const titulo = val(fd, 'titulo'), clienteId = val(fd, 'clienteId');
      if (!titulo && !clienteId) return error(f, 'Escribe un título o elige un cliente.');
      let r = M.db.recordatorios.find((x) => x.id === val(fd, 'id'));
      const nuevo = !r;
      if (nuevo) { r = M.nuevo('recordatorio'); M.db.recordatorios.push(r); }
      const cuando = fecha + 'T' + hora;
      if (cuando !== r.cuando) { r.avisado = cuando <= M.ldt(new Date()); }
      Object.assign(r, { tipo: val(fd, 'tipo') === 'evento' ? 'evento' : 'llamada', titulo, clienteId, cuando, notas: val(fd, 'notas') });
      hecho(nuevo ? 'Recordatorio creado' : 'Recordatorio actualizado');
    },
    cita(f, fd) {
      const fecha = val(fd, 'fecha'), hora = val(fd, 'hora'), dur = Math.round(Number(val(fd, 'duracion')));
      if (!fecha || !hora) return error(f, 'Indica fecha y hora.');
      if (!(dur >= 15 && dur <= 1440)) return error(f, 'La duración debe estar entre 15 y 1440 minutos.');
      let c = M.db.citas.find((x) => x.id === val(fd, 'id'));
      const nuevo = !c;
      const inicio = fecha + 'T' + hora;
      if (nuevo) { c = M.nuevo('cita'); M.db.citas.push(c); } else if (c.inicio !== inicio) moverRecsDeCita(c, inicio);
      Object.assign(c, { clienteId: val(fd, 'clienteId'), tipo: val(fd, 'tipo') || 'Otra', titulo: val(fd, 'titulo'), inicio, duracionMin: dur, lugar: val(fd, 'lugar'), estado: val(fd, 'estado') || 'pendiente', notas: val(fd, 'notas') });
      let aviso = '';
      if (nuevo && val(fd, 'aviso')) {
        const cuando = M.ldt(M.addMin(M.parseL(inicio), -Number(val(fd, 'aviso'))));
        if (cuando > M.ldt(new Date())) {
          const r = M.nuevo('recordatorio');
          Object.assign(r, { tipo: 'evento', titulo: 'Cita: ' + (c.titulo || c.tipo), clienteId: c.clienteId, cuando, citaId: c.id });
          M.db.recordatorios.push(r);
        } else aviso = ' (sin aviso: la hora del aviso ya pasó)';
      }
      if (c.estado === 'cancelada') M.db.recordatorios.forEach((r) => { if (r.citaId === c.id) r.hecho = true; });
      hecho((nuevo ? 'Cita creada' : 'Cita actualizada') + aviso);
    },
    pres(f, fd) {
      const clienteId = val(fd, 'clienteId');
      if (!clienteId) return error(f, 'Elige un cliente.');
      const iva = num(fd.get('ivaPct'));
      if (!Number.isFinite(iva) || iva < 0 || iva > 100) return error(f, 'El IVA debe ser un número entre 0 y 100.');
      const L = leerLineas(f);
      if (L.err) return error(f, L.err);
      if (!L.lineas.length) return error(f, 'Añade al menos una línea.');
      let p = M.db.presupuestos.find((x) => x.id === val(fd, 'id'));
      const nuevo = !p;
      if (nuevo) { p = M.nuevo('presupuesto'); p.numero = M.siguienteNumero(); M.db.presupuestos.push(p); }
      Object.assign(p, { clienteId, tipo: val(fd, 'tipo'), origen: val(fd, 'origen'), destino: val(fd, 'destino'), fecha: val(fd, 'fecha'), ivaPct: iva, validezDias: Math.max(0, Math.round(Number(val(fd, 'validezDias')) || 0)), lineas: L.lineas, notas: val(fd, 'notas') });
      M.guardar(); M.cerrar();
      M.toast(nuevo ? 'Presupuesto ' + p.numero + ' creado' : 'Presupuesto actualizado');
      if (nuevo) location.hash = '#/presupuestos/' + p.id; else refrescar();
    },
    clave(f, fd) {
      const v = val(fd, 'clave');
      if (!v) { M.toast('Escribe la clave', 'err'); return false; }
      M.setClave(v);
      M.toast('Clave guardada en este dispositivo');
      refrescar();
    }
  };
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    const fn = FORMS[f.dataset.form];
    if (fn) fn(f, new FormData(f));
  });

  /* ---------- Citas y recordatorios ---------- */
  function moverRecsDeCita(c, nuevoInicio) {
    const delta = M.parseL(nuevoInicio) - M.parseL(c.inicio);
    M.db.recordatorios.forEach((r) => {
      if (r.citaId !== c.id || r.hecho) return;
      r.cuando = M.ldt(new Date(M.parseL(r.cuando).getTime() + delta));
      r.avisado = r.cuando <= M.ldt(new Date());
    });
  }
  function mover(k, id, fecha) {
    if (k === 'cita') {
      const c = M.db.citas.find((x) => x.id === id);
      if (!c || c.inicio.slice(0, 10) === fecha) return;
      const antes = JSON.stringify(M.db.recordatorios.filter((r) => r.citaId === id));
      const antesIni = c.inicio;
      const nuevo = fecha + c.inicio.slice(10);
      moverRecsDeCita(c, nuevo);
      c.inicio = nuevo;
      M.guardar();
      refrescar();
      const s = M.solapes(c.inicio, c.duracionMin, c.id);
      M.toast('Cita movida al ' + M.fCorta(M.parseD(fecha)) + (s.length ? ' · aviso: solapa con otra cita' : ''), '', [{
        label: 'Deshacer', fn: () => {
          c.inicio = antesIni;
          const prev = JSON.parse(antes);
          M.db.recordatorios.forEach((r) => { const p = prev.find((x) => x.id === r.id); if (p) Object.assign(r, p); });
          M.guardar(); refrescar();
        }
      }]);
    } else {
      const r = M.db.recordatorios.find((x) => x.id === id);
      if (!r || r.cuando.slice(0, 10) === fecha) return;
      const antes = Object.assign({}, r);
      r.cuando = fecha + r.cuando.slice(10);
      r.avisado = r.cuando <= M.ldt(new Date());
      M.guardar();
      refrescar();
      M.toast('Recordatorio movido al ' + M.fCorta(M.parseD(fecha)), '', [{ label: 'Deshacer', fn: () => { Object.assign(r, antes); M.guardar(); refrescar(); } }]);
    }
  }
  function marcarHecho(id) {
    const r = M.db.recordatorios.find((x) => x.id === id);
    if (!r) return;
    r.hecho = true;
    M.guardar();
    refrescar();
    M.toast(r.tipo === 'llamada' ? 'Llamada marcada como hecha' : 'Recordatorio hecho', '', r.tipo === 'llamada' && r.clienteId ? [{ label: 'Programar otra', fn: () => A['nuevo-rec']({ dataset: { cliente: r.clienteId, tipo: 'llamada' } }) }] : []);
  }
  function avisar(r) {
    const c = M.cliente(r.clienteId);
    const texto = (r.tipo === 'llamada' ? 'Llamar: ' : '') + (r.titulo || (c ? c.nombre : 'Recordatorio'));
    M.toast('⏰ ' + texto, '', [{ label: 'Hecho', fn: () => marcarHecho(r.id) }, { label: 'Ver', fn: () => { location.hash = '#/hoy'; } }]);
    M.notificar(texto, M.fCuando(r.cuando) + (c && c.telefono ? ' · ' + c.telefono : ''), r.id);
  }
  function tick(primera) {
    const ahora = M.ldt(new Date());
    const limite = M.ldt(M.addMin(new Date(), -15));
    let cambio = false;
    for (const r of M.db.recordatorios) {
      if (r.hecho || r.avisado || r.cuando > ahora) continue;
      r.avisado = true;
      cambio = true;
      if (primera && r.cuando < limite) continue; // los antiguos quedan visibles en «Hoy» como vencidos
      avisar(r);
    }
    if (cambio) M.guardar();
    navegacion(ruta().a);
    if (cambio && ruta().a === 'hoy' && !$('#dlg').open) refrescar();
  }

  /* ---------- Buzón de solicitudes ---------- */
  const cab = () => ({ Authorization: 'Bearer ' + M.getClave() });
  async function sincronizar() {
    if (!M.getClave()) { M.toast('Primero guarda la clave del buzón en Ajustes', 'err'); location.hash = '#/ajustes'; return; }
    const btn = $('[data-act="sync"]');
    if (btn) btn.disabled = true;
    try {
      const r = await fetch('api/solicitudes', { headers: cab(), cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) M.toast('La clave no es correcta', 'err');
      else if (r.status === 503) M.toast('El buzón no está configurado en el servidor (falta la clave o el almacenamiento)', 'err');
      else if (!r.ok) M.toast('No se pudo consultar el buzón (código ' + r.status + ')', 'err');
      else {
        const b = M.getBuzon();
        const imp = new Set(b.importadas || []);
        const nuevas = (j.items || []).filter((s) => !imp.has(s.id));
        // reintenta borrar en el servidor las ya importadas que sigan allí
        for (const s of (j.items || [])) if (imp.has(s.id)) fetch('api/solicitudes?id=' + encodeURIComponent(s.id), { method: 'DELETE', headers: cab() }).catch(() => {});
        M.setBuzon({ pendientes: nuevas, cuando: M.ldt(new Date()), importadas: Array.from(imp).slice(-500) });
        M.toast(nuevas.length ? nuevas.length + (nuevas.length === 1 ? ' solicitud nueva' : ' solicitudes nuevas') : 'No hay solicitudes nuevas');
        if (j.ilegibles) M.toast(j.ilegibles + ' solicitud(es) no se pudieron descifrar (¿cambió la clave del servidor?)', 'err');
      }
    } catch (e) {
      M.toast('No hay conexión con el servidor', 'err');
    }
    render();
  }
  const digs = (t) => String(t || '').replace(/\D/g, '');
  async function quitarDelServidor(id) {
    const r = await fetch('api/solicitudes?id=' + encodeURIComponent(id), { method: 'DELETE', headers: cab() });
    return r.ok || r.status === 404;
  }
  async function aceptarSolicitud(id) {
    const b = M.getBuzon();
    const s = b.pendientes.find((x) => x.id === id);
    if (!s) return;
    const detalle = ['Solicitud web (' + s.servicio + ')' + (s.fueraHorario ? ', recibida fuera de horario' : ''), (s.origen || s.destino) ? 'Ruta: ' + [s.origen, s.destino].filter(Boolean).join(' → ') : '', s.fecha ? 'Fecha deseada: ' + s.fecha : '', s.franja ? 'Llamar: ' + s.franja : '', s.detalles ? 'Detalles: ' + s.detalles : ''].filter(Boolean).join('\n');
    let c = digs(s.telefono).length >= 6 ? M.db.clientes.find((x) => digs(x.telefono).slice(-9) === digs(s.telefono).slice(-9)) : null;
    const existente = Boolean(c);
    if (c) c.notas = (c.notas ? c.notas + '\n\n' : '') + detalle;
    else { c = M.nuevo('cliente'); Object.assign(c, { nombre: s.nombre, telefono: s.telefono, email: s.email || '', estado: 'lead', notas: detalle }); M.db.clientes.push(c); }
    const recibida = s.recibido ? new Date(s.recibido) : new Date();
    const cuando = M.H.proximaApertura(recibida) || M.addMin(new Date(), 60);
    const r = M.nuevo('recordatorio');
    Object.assign(r, { tipo: 'llamada', titulo: 'Devolver llamada: ' + s.servicio, clienteId: c.id, cuando: M.ldt(cuando), notas: s.franja || '' });
    r.avisado = r.cuando <= M.ldt(new Date());
    M.db.recordatorios.push(r);
    M.guardar();
    b.importadas = (b.importadas || []).concat([id]);
    b.pendientes = b.pendientes.filter((x) => x.id !== id);
    M.setBuzon(b);
    let ok = false;
    try { ok = await quitarDelServidor(id); } catch (e) { ok = false; }
    M.toast((existente ? 'Asociada al cliente existente ' + c.nombre : 'Cliente creado') + ' y llamada programada para ' + M.fCuando(r.cuando) + (ok ? '' : ' (no se pudo borrar del buzón; se reintentará)'));
    location.hash = '#/clientes/' + c.id;
  }
  async function descartarSolicitud(id) {
    if (!(await M.confirmar('¿Descartar esta solicitud? Se borra del buzón y no se puede recuperar.', { ok: 'Descartar', peligro: true }))) return;
    try {
      if (!(await quitarDelServidor(id))) throw new Error('x');
      const b = M.getBuzon();
      b.pendientes = b.pendientes.filter((x) => x.id !== id);
      M.setBuzon(b);
      M.toast('Solicitud descartada');
    } catch (e) { M.toast('No se pudo borrar en el servidor', 'err'); }
    render();
  }

  /* ---------- Acciones (clic) ---------- */
  const A = {
    cerrar: () => M.cerrar(),
    'nuevo-cliente': () => abrir(V.fCliente(M.nuevo('cliente'), true)),
    'ed-cliente': (el) => { const c = M.cliente(el.dataset.id); if (c) abrir(V.fCliente(c, false)); },
    async 'del-cliente'(el) {
      const c = M.cliente(el.dataset.id);
      if (!c) return;
      const np = M.db.presupuestos.filter((p) => p.clienteId === c.id).length, nc = M.db.citas.filter((x) => x.clienteId === c.id).length, nr = M.db.recordatorios.filter((x) => x.clienteId === c.id).length;
      if (!(await M.confirmar('¿Eliminar a ' + c.nombre + '? También se borrarán ' + np + ' presupuesto(s), ' + nc + ' cita(s) y ' + nr + ' recordatorio(s) asociados. No se puede deshacer.', { ok: 'Eliminar', peligro: true }))) return;
      M.db.presupuestos = M.db.presupuestos.filter((p) => p.clienteId !== c.id);
      M.db.citas = M.db.citas.filter((x) => x.clienteId !== c.id);
      M.db.recordatorios = M.db.recordatorios.filter((x) => x.clienteId !== c.id);
      M.db.clientes = M.db.clientes.filter((x) => x.id !== c.id);
      M.guardar();
      M.toast('Cliente eliminado');
      location.hash = '#/clientes';
    },
    'nuevo-pres'(el) {
      const p = M.nuevo('presupuesto');
      p.clienteId = (el.dataset && el.dataset.cliente) || '';
      abrir(V.fPres(p, true));
      actualizarTotales();
    },
    'ed-pres'(el) { const p = M.db.presupuestos.find((x) => x.id === el.dataset.id); if (p) { abrir(V.fPres(p, false)); actualizarTotales(); } },
    async 'del-pres'(el) {
      const p = M.db.presupuestos.find((x) => x.id === el.dataset.id);
      if (!p || !(await M.confirmar('¿Eliminar el presupuesto ' + p.numero + '? No se puede deshacer.', { ok: 'Eliminar', peligro: true }))) return;
      M.db.presupuestos = M.db.presupuestos.filter((x) => x.id !== p.id);
      M.guardar();
      M.toast('Presupuesto eliminado');
      location.hash = '#/presupuestos';
    },
    'estado-pres'(el) {
      const p = M.db.presupuestos.find((x) => x.id === el.dataset.id);
      if (!p) return;
      p.estado = el.dataset.estado;
      if (p.estado === 'enviado' && !p.enviadoEn) p.enviadoEn = M.ymd(new Date());
      if (p.estado === 'borrador') p.enviadoEn = '';
      M.guardar();
      refrescar();
    },
    imprimir: () => window.print(),
    async 'copiar-pres'(el) {
      const p = M.db.presupuestos.find((x) => x.id === el.dataset.id);
      if (!p) return;
      const t = M.totales(p);
      const txt = ['Presupuesto ' + p.numero + ' — ' + M.CFG.empresa, 'Cliente: ' + (M.nombreCliente(p.clienteId) || '—'), 'Servicio: ' + p.tipo + (p.fecha ? ' (' + p.fecha + ')' : ''), (p.origen || p.destino) ? 'Ruta: ' + [p.origen, p.destino].filter(Boolean).join(' → ') : '']
        .concat(p.lineas.map((l) => '- ' + l.concepto + ': ' + String(l.cantidad).replace('.', ',') + ' × ' + M.eur(l.precioC) + ' = ' + M.eur(Math.round(l.cantidad * l.precioC))))
        .concat(['Base imponible: ' + M.eur(t.sub), 'IVA ' + String(p.ivaPct).replace('.', ',') + ' %: ' + M.eur(t.iva), 'TOTAL: ' + M.eur(t.total)]).filter(Boolean).join('\n');
      try { await navigator.clipboard.writeText(txt); M.toast('Resumen copiado'); } catch (e) {
        const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select();
        let ok = false; try { ok = document.execCommand('copy'); } catch (x) { ok = false; }
        ta.remove(); M.toast(ok ? 'Resumen copiado' : 'No se pudo copiar', ok ? '' : 'err');
      }
    },
    'dup-pres'(el) {
      const p = M.db.presupuestos.find((x) => x.id === el.dataset.id);
      if (!p) return;
      const n = Object.assign(M.nuevo('presupuesto'), JSON.parse(JSON.stringify(p)), { id: M.uid(), numero: M.siguienteNumero(), estado: 'borrador', enviadoEn: '', creado: M.ldt(new Date()) });
      M.db.presupuestos.push(n);
      M.guardar();
      M.toast('Presupuesto duplicado como ' + n.numero);
      location.hash = '#/presupuestos/' + n.id;
    },
    'pres-cita'(el) {
      const p = M.db.presupuestos.find((x) => x.id === el.dataset.id);
      if (!p) return;
      const c = M.nuevo('cita');
      Object.assign(c, { clienteId: p.clienteId, tipo: M.TIPOS_CITA.includes(p.tipo) ? p.tipo : 'Otra', titulo: p.numero, lugar: p.origen, presupuestoId: p.id, inicio: (p.fecha || M.ymd(new Date())) + 'T09:00' });
      abrir(V.fCita(c, true));
      revisarSolape();
    },
    'nueva-cita'(el) {
      const c = M.nuevo('cita');
      const d = el.dataset || {};
      c.inicio = (d.fecha || M.ymd(new Date())) + 'T' + (d.hora || '10:00');
      c.clienteId = d.cliente || '';
      abrir(V.fCita(c, true));
      revisarSolape();
    },
    'ed-cita'(el) { const c = M.db.citas.find((x) => x.id === el.dataset.id); if (c) { abrir(V.fCita(c, false)); revisarSolape(); } },
    async 'del-cita'(el) {
      const c = M.db.citas.find((x) => x.id === el.dataset.id);
      if (!c || !(await M.confirmar('¿Eliminar esta cita y sus avisos?', { ok: 'Eliminar', peligro: true }))) return;
      M.db.citas = M.db.citas.filter((x) => x.id !== c.id);
      M.db.recordatorios = M.db.recordatorios.filter((r) => r.citaId !== c.id);
      M.guardar(); M.cerrar(); M.toast('Cita eliminada'); refrescar();
    },
    'ics-cita'(el) { const c = M.db.citas.find((x) => x.id === el.dataset.id); if (c) M.descargar('cita.ics', M.ics([M.eventoCita(c)]), 'text/calendar'); },
    'ics-rec'(el) { const r = M.db.recordatorios.find((x) => x.id === el.dataset.id); if (r) M.descargar('recordatorio.ics', M.ics([M.eventoRec(r)]), 'text/calendar'); },
    'ics-agenda'() {
      const ahora = M.ldt(new Date());
      const ev = M.db.citas.filter((c) => c.estado !== 'cancelada' && c.inicio >= ahora).map(M.eventoCita).concat(M.db.recordatorios.filter((r) => !r.hecho && r.cuando >= ahora).map(M.eventoRec));
      if (!ev.length) { M.toast('No hay citas ni recordatorios futuros que exportar'); return; }
      M.descargar('agenda-mudanzas.ics', M.ics(ev), 'text/calendar');
    },
    'nuevo-rec'(el) {
      const r = M.nuevo('recordatorio');
      const d = el.dataset || {};
      r.cuando = !d.fecha || d.fecha === M.ymd(new Date()) ? M.defaultCuando() : d.fecha + 'T09:00';
      r.clienteId = d.cliente || '';
      r.tipo = d.tipo === 'evento' ? 'evento' : 'llamada';
      abrir(V.fRec(r, true));
    },
    'ed-rec'(el) { const r = M.db.recordatorios.find((x) => x.id === el.dataset.id); if (r) abrir(V.fRec(r, false)); },
    async 'del-rec'(el) {
      const r = M.db.recordatorios.find((x) => x.id === el.dataset.id);
      if (!r || !(await M.confirmar('¿Eliminar este recordatorio?', { ok: 'Eliminar', peligro: true }))) return;
      M.db.recordatorios = M.db.recordatorios.filter((x) => x.id !== r.id);
      M.guardar(); M.cerrar(); M.toast('Recordatorio eliminado'); refrescar();
    },
    'rec-hecho': (el) => marcarHecho(el.dataset.id),
    'rec-posponer'(el) {
      const id = esc(el.dataset.id);
      abrir('<div class="dlg-body"><h2>Posponer</h2><div class="stack"><button class="btn" style="width:100%" data-act="pos" data-m="1h" data-id="' + id + '">Dentro de 1 hora</button><button class="btn" style="width:100%" data-act="pos" data-m="manana" data-id="' + id + '">Mañana a las 09:00</button><button class="btn" style="width:100%" data-act="ed-rec" data-id="' + id + '">Elegir fecha y hora…</button><button class="btn ghost" style="width:100%" data-act="cerrar">Cancelar</button></div></div>', 'sm');
    },
    pos(el) {
      const r = M.db.recordatorios.find((x) => x.id === el.dataset.id);
      if (!r) return;
      let d;
      if (el.dataset.m === '1h') d = M.addMin(new Date(), 60);
      else { d = M.addDays(new Date(), 1); d.setHours(9, 0, 0, 0); }
      r.cuando = M.ldt(d); r.avisado = false; r.hecho = false;
      hecho('Pospuesto a ' + M.fCuando(r.cuando));
    },
    dia(el) {
      S.agenda.sel = el.dataset.fecha;
      S.agenda.fecha = M.parseD(el.dataset.fecha);
      refrescar();
    },
    vista(el) { S.agenda.vista = el.dataset.v; S.agenda.fecha = M.parseD(S.agenda.sel); refrescar(); },
    nav(el) {
      const a = S.agenda, d = Number(el.dataset.d);
      let n;
      if (d === 0) n = new Date();
      else if (a.vista === 'mes') n = new Date(a.fecha.getFullYear(), a.fecha.getMonth() + d, 1);
      else n = M.addDays(M.parseD(a.sel), d * (a.vista === 'semana' ? 7 : 1));
      a.sel = M.ymd(n); a.fecha = M.parseD(a.sel);
      refrescar();
    },
    'ir-dia'(el) { S.agenda.sel = el.dataset.fecha; S.agenda.fecha = M.parseD(el.dataset.fecha); S.agenda.vista = 'dia'; if (ruta().a !== 'agenda') location.hash = '#/agenda'; else refrescar(); },
    'ver-ev'(el) { A[el.dataset.k === 'cita' ? 'ed-cita' : 'ed-rec']({ dataset: { id: el.dataset.id } }); },
    'filtro-cli'(el) { S.cli.estado = el.dataset.v; refrescar(); },
    'filtro-pres'(el) { S.pres.estado = el.dataset.v; refrescar(); },
    'linea-add'() { $('#lineas').insertAdjacentHTML('beforeend', V.fila({ concepto: '', cantidad: 1, precioC: 0 })); const i = $$('#lineas .linea input[name="concepto"]'); i[i.length - 1].focus(); },
    'linea-del'(el) {
      const l = el.closest('.linea');
      if ($$('#lineas .linea').length > 1) l.remove(); else $$('input', l).forEach((i) => { i.value = i.name === 'cantidad' ? '1' : ''; });
      actualizarTotales();
    },
    sync: sincronizar,
    'aceptar-sol': (el) => aceptarSolicitud(el.dataset.id),
    'descartar-sol': (el) => descartarSolicitud(el.dataset.id),
    'quitar-clave'() { M.setClave(''); M.toast('Clave eliminada de este dispositivo'); refrescar(); },
    exportar() { M.descargar('mudanzas-copia-' + M.ymd(new Date()) + '.json', M.exportar(), 'application/json'); M.toast('Copia exportada'); },
    importar() { $('#file-imp').click(); },
    async 'borrar-todo'() {
      if (!(await M.confirmar('Se borrarán TODOS los clientes, presupuestos, citas y recordatorios de este dispositivo. ¿Has exportado una copia? No se puede deshacer.', { ok: 'Borrar todo', peligro: true }))) return;
      M.db = M.normalizar(null); M.guardar(); M.setBuzon({ pendientes: [], cuando: '' });
      M.toast('Datos borrados'); refrescar();
    },
    async 'notif-activar'() {
      try { const p = await Notification.requestPermission(); M.toast(p === 'granted' ? 'Avisos activados (solo con la app abierta)' : 'Permiso no concedido'); } catch (e) { M.toast('Este navegador no admite avisos', 'err'); }
      refrescar();
    },
    async 'copiar-enlace'() { try { await navigator.clipboard.writeText($('#enlace').textContent); M.toast('Enlace copiado'); } catch (e) { M.toast('Selecciona y copia el enlace manualmente', 'err'); } }
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) { if (e.target === $('#dlg')) M.cerrar(); return; }
    const fn = A[el.dataset.act];
    if (fn) { if (el.tagName === 'A') e.preventDefault(); fn(el, e); }
  });
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.dia[data-act="dia"]')) { e.preventDefault(); A.dia(e.target); }
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.matches('[data-filtro]')) {
      S[t.dataset.filtro].q = t.value;
      $('#lista').innerHTML = t.dataset.filtro === 'cli' ? V.listaClientes() : V.listaPres();
    } else if (t.closest('form[data-form="pres"]')) actualizarTotales();
    else if (t.matches('[data-solape]')) revisarSolape();
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'file-imp') {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      f.text().then(async (txt) => {
        let nuevo;
        try { nuevo = M.importar(txt); } catch (x) { M.toast('El archivo no es una copia válida de esta aplicación', 'err'); return; }
        if (!(await M.confirmar('La copia tiene ' + nuevo.clientes.length + ' clientes, ' + nuevo.presupuestos.length + ' presupuestos, ' + nuevo.citas.length + ' citas y ' + nuevo.recordatorios.length + ' recordatorios. Se REEMPLAZARÁN los datos actuales. ¿Continuar?', { ok: 'Reemplazar', peligro: true }))) return;
        M.db = nuevo; M.guardar(); M.toast('Copia importada'); refrescar();
      });
    } else if (e.target.matches('[data-solape]')) revisarSolape();
  });

  /* ---------- Arrastrar y soltar (escritorio) ---------- */
  document.addEventListener('dragstart', (e) => {
    const t = e.target.closest && e.target.closest('[data-act="ver-ev"][draggable]');
    if (!t) return;
    e.dataTransfer.setData('text/plain', t.dataset.k + ':' + t.dataset.id);
    e.dataTransfer.effectAllowed = 'move';
  });
  document.addEventListener('dragover', (e) => { const d = e.target.closest && e.target.closest('[data-drop]'); if (d) { e.preventDefault(); d.classList.add('drop'); } });
  document.addEventListener('dragleave', (e) => { const d = e.target.closest && e.target.closest('[data-drop]'); if (d && !d.contains(e.relatedTarget)) d.classList.remove('drop'); });
  document.addEventListener('drop', (e) => {
    const d = e.target.closest && e.target.closest('[data-drop]');
    if (!d) return;
    e.preventDefault();
    $$('.drop').forEach((x) => x.classList.remove('drop'));
    const dato = e.dataTransfer.getData('text/plain');
    const i = dato.indexOf(':');
    if (i > 0) mover(dato.slice(0, i), dato.slice(i + 1), d.dataset.fecha);
  });

  /* ---------- Arranque ---------- */
  render();
  tick(true);
  setInterval(() => tick(false), 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(false); });
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo sin conexión */ });
  }
})();
