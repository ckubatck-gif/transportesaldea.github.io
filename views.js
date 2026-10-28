'use strict';
// Vistas: cada función devuelve HTML (todo el texto del usuario pasa por esc()).
(function () {
  const M = window.M;
  const { esc, ico } = M;
  const V = (M.V = {});
  const hoyD = new Date();
  const S = (M.estado = {
    agenda: { vista: 'mes', fecha: hoyD, sel: M.ymd(hoyD) },
    cli: { q: '', estado: '' },
    pres: { q: '', estado: '' }
  });

  /* ---------- Utilidades de vista ---------- */
  const optsObj = (o, sel) => Object.keys(o).map((k) => '<option value="' + esc(k) + '"' + (k === sel ? ' selected' : '') + '>' + esc(o[k]) + '</option>').join('');
  const optsArr = (a, sel) => a.map((v) => '<option' + (v === sel ? ' selected' : '') + '>' + esc(v) + '</option>').join('');
  const optsClientes = (sel, vacio) => (vacio ? '<option value="">' + esc(vacio) + '</option>' : '') +
    M.db.clientes.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map((c) => '<option value="' + esc(c.id) + '"' + (c.id === sel ? ' selected' : '') + '>' + esc(c.nombre) + '</option>').join('');
  const iniciales = (n) => (String(n).trim().split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('') || '?').toUpperCase();
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const pillEstadoCliente = (e) => '<span class="pill ' + (e === 'activo' ? 'ok' : e === 'lead' ? 'acc' : '') + '">' + esc(M.ESTADOS_CLIENTE[e] || e) + '</span>';
  const pillPres = (e) => '<span class="pill ' + (M.CLASE_PRES[e] || '') + '">' + esc(M.ESTADOS_PRES[e] || e) + '</span>';
  const pillCita = (e) => '<span class="pill ' + (e === 'confirmada' ? 'ok' : e === 'hecha' ? 'info' : e === 'cancelada' ? 'danger' : 'warn') + '">' + esc(M.ESTADOS_CITA[e] || e) + '</span>';
  const vacio = (t) => '<p class="empty">' + esc(t) + '</p>';
  const ahoraS = () => M.ldt(new Date());
  M.defaultCuando = () => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    if (d.getHours() >= 21 || d.getHours() < 7) { const x = M.addDays(new Date(), d.getHours() < 7 ? 0 : 1); x.setHours(9, 0, 0, 0); return M.ldt(x); }
    return M.ldt(d);
  };

  /* ---------- Hoy ---------- */
  function filaRec(r, ahora) {
    const c = M.cliente(r.clienteId);
    const vencido = r.cuando < ahora;
    return '<li><div class="grow"><b>' + (r.tipo === 'llamada' ? 'Llamar: ' : '') + esc(r.titulo || (c ? c.nombre : 'Recordatorio')) + '</b>' +
      '<small class="sub">' + esc(M.fCuando(r.cuando)) + (c && r.titulo ? ' · ' + esc(c.nombre) : '') + '</small></div>' +
      (vencido ? '<span class="pill danger">Vencido</span>' : '<span class="pill warn">Hoy</span>') +
      '<div class="row">' +
      (c && c.telefono ? '<a class="btn sm" href="' + esc(M.telHref(c.telefono)) + '">' + ico('tel', 'sm') + ' Llamar</a>' : '') +
      '<button class="btn sm primary" data-act="rec-hecho" data-id="' + esc(r.id) + '">Hecho</button>' +
      '<button class="btn sm" data-act="rec-posponer" data-id="' + esc(r.id) + '">Posponer</button>' +
      '<button class="btn sm ghost" data-act="ed-rec" data-id="' + esc(r.id) + '">Editar</button></div></li>';
  }
  V.hoy = () => {
    const ahora = new Date();
    const hoy = M.ymd(ahora);
    const nowS = M.ldt(ahora);
    let estado;
    if (M.H.estaAbierto(ahora)) estado = '<div class="estado on">● Abierto ahora, hasta las ' + M.hm(M.H.cierreHoy(ahora)) + '</div>';
    else {
      const ap = M.H.proximaApertura(ahora);
      estado = '<div class="estado off">● Fuera de horario' + (ap ? '. Próxima apertura: ' + (M.ymd(ap) === hoy ? 'hoy' : M.fLarga(ap)) + ' a las ' + M.hm(ap) : '') + '</div>';
    }
    const pend = M.db.recordatorios.filter((r) => !r.hecho && r.cuando.slice(0, 10) <= hoy).sort((a, b) => a.cuando.localeCompare(b.cuando));
    const citas = M.eventosDia(hoy).filter((e) => e.k === 'cita');
    const envs = M.db.presupuestos.filter((p) => p.estado === 'enviado').sort((a, b) => (a.enviadoEn || '').localeCompare(b.enviadoEn || ''));
    const buzon = M.getBuzon().pendientes.length;
    return '<div class="top"><h1>Hoy</h1><span class="sub">' + esc(M.fLarga(ahora)) + '</span></div>' +
      (M.storageOK ? '' : '<div class="alert err">Este navegador no permite guardar datos: lo que introduzcas se perderá al cerrar. Exporta copias desde Ajustes.</div>') +
      '<div class="stack">' + estado +
      '<div class="row noprint"><button class="btn primary" data-act="nuevo-cliente">' + ico('mas', 'sm') + ' Cliente</button><button class="btn" data-act="nuevo-pres">' + ico('mas', 'sm') + ' Presupuesto</button><button class="btn" data-act="nueva-cita" data-fecha="' + hoy + '">' + ico('mas', 'sm') + ' Cita</button><button class="btn" data-act="nuevo-rec" data-fecha="' + hoy + '">' + ico('mas', 'sm') + ' Recordatorio</button></div>' +
      (buzon ? '<a class="card" style="display:block;text-decoration:none;color:inherit" href="#/solicitudes"><b>' + ico('solicitudes', 'sm') + ' ' + buzon + (buzon === 1 ? ' solicitud nueva' : ' solicitudes nuevas') + ' del buzón</b><div class="sub">Pulsa para revisarlas.</div></a>' : '') +
      '<section class="card"><h2>' + ico('campana', 'sm') + ' Llamadas y recordatorios pendientes <span class="pill">' + pend.length + '</span></h2>' +
      (pend.length ? '<ul class="list">' + pend.map((r) => filaRec(r, nowS)).join('') + '</ul>' : vacio('Nada pendiente para hoy.')) + '</section>' +
      '<section class="card"><h2>' + ico('agenda', 'sm') + ' Citas de hoy <span class="pill">' + citas.length + '</span></h2>' +
      (citas.length ? '<ul class="list">' + citas.map((e) => filaCita(e.o)).join('') + '</ul>' : vacio('No hay citas hoy.')) + '</section>' +
      '<section class="card"><h2>' + ico('presupuestos', 'sm') + ' Presupuestos enviados sin respuesta <span class="pill">' + envs.length + '</span></h2>' +
      (envs.length ? '<ul class="list">' + envs.map((p) => {
        const dias = p.enviadoEn ? M.diasEntre(M.parseD(p.enviadoEn), new Date()) : null;
        return '<li><a class="item-link" href="#/presupuestos/' + esc(p.id) + '"><span class="grow"><b>' + esc(p.numero) + ' · ' + esc(M.nombreCliente(p.clienteId) || 'Sin cliente') + '</b><small>' + (dias == null ? 'Enviado' : dias === 0 ? 'Enviado hoy' : 'Enviado hace ' + dias + (dias === 1 ? ' día' : ' días')) + '</small></span><b>' + esc(M.eur(M.totales(p).total)) + '</b></a></li>';
      }).join('') + '</ul>' : vacio('Ninguno pendiente de respuesta.')) + '</section></div>';
  };

  function filaCita(c) {
    const cli = M.cliente(c.clienteId);
    return '<li><div class="grow"><b>' + esc(c.inicio.slice(11, 16)) + ' · ' + esc(c.titulo || c.tipo) + '</b><small class="sub">' + esc(c.tipo) + (cli ? ' · ' + esc(cli.nombre) : '') + (c.lugar ? ' · ' + esc(c.lugar) : '') + '</small></div>' + pillCita(c.estado) +
      '<button class="btn sm ghost" data-act="ed-cita" data-id="' + esc(c.id) + '">Editar</button></li>';
  }

  /* ---------- Agenda ---------- */
  const tituloPeriodo = () => {
    const a = S.agenda;
    if (a.vista === 'mes') return M.fMes(a.fecha);
    if (a.vista === 'dia') return M.fLarga(a.fecha);
    const i = M.inicioSemana(a.fecha);
    return M.fCorta(i) + ' – ' + M.fCorta(M.addDays(i, 6));
  };
  function chip(e, extra) {
    const hecho = e.hecho ? ' hecha' : '';
    const t = e.k === 'rec' && e.o.tipo === 'llamada' ? ' llamada' : '';
    return '<span class="ev ' + (e.k === 'rec' ? 'rec' : '') + hecho + t + '" ' + 'data-act="ver-ev" data-k="' + e.k + '" data-id="' + esc(e.id) + '" draggable="true" title="' + esc(e.hora + ' ' + e.titulo) + '">' + esc(e.hora) + ' ' + esc(e.titulo) + '</span>' + (extra || '');
  }
  function vistaMes() {
    const a = S.agenda;
    const f = a.fecha;
    const primero = new Date(f.getFullYear(), f.getMonth(), 1);
    const inicio = M.inicioSemana(primero);
    const dias = new Date(f.getFullYear(), f.getMonth() + 1, 0).getDate();
    const semanas = Math.ceil(((primero.getDay() + 6) % 7 + dias) / 7);
    const hoy = M.ymd(new Date());
    let h = '<div class="mes" role="grid" aria-label="' + esc(M.fMes(f)) + '">' + M.DIAS.map((d) => '<div class="dh" role="columnheader">' + d + '</div>').join('');
    for (let i = 0; i < semanas * 7; i++) {
      const d = M.addDays(inicio, i);
      const y = M.ymd(d);
      const evs = M.eventosDia(y);
      h += '<div class="dia' + (d.getMonth() !== f.getMonth() ? ' fuera' : '') + (y === hoy ? ' hoy' : '') + (y === a.sel ? ' sel' : '') + '" role="gridcell" tabindex="0" data-act="dia" data-fecha="' + y + '" data-drop="1" aria-label="' + esc(M.fLarga(d)) + (evs.length ? ', ' + evs.length + ' eventos' : '') + '">' +
        '<span class="num">' + d.getDate() + '</span>' +
        '<span class="dots">' + evs.slice(0, 5).map((e) => '<i class="dot ' + (e.k === 'rec' ? 'rec' : '') + '"></i>').join('') + '</span>' +
        '<span class="chipsd">' + evs.slice(0, 3).map((e) => chip(e)).join('') + (evs.length > 3 ? '<span class="mas">+' + (evs.length - 3) + ' más</span>' : '') + '</span></div>';
    }
    return h + '</div>' + panelDia(a.sel);
  }
  function panelDia(y) {
    const d = M.parseD(y);
    const evs = M.eventosDia(y);
    return '<section class="card" style="margin-top:12px" aria-label="Detalle del día"><div class="row between"><h2 style="margin:0">' + esc(M.fLarga(d)) + '</h2><div class="row noprint"><button class="btn sm primary" data-act="nueva-cita" data-fecha="' + y + '">' + ico('mas', 'sm') + ' Cita</button><button class="btn sm" data-act="nuevo-rec" data-fecha="' + y + '">' + ico('mas', 'sm') + ' Recordatorio</button><button class="btn sm ghost" data-act="ir-dia" data-fecha="' + y + '">Ver horas</button></div></div>' +
      (evs.length ? '<ul class="list">' + evs.map((e) => e.k === 'cita' ? filaCita(e.o) : filaRecAg(e.o)).join('') + '</ul>' : vacio('Sin eventos este día.')) + '</section>';
  }
  function filaRecAg(r) {
    const c = M.cliente(r.clienteId);
    return '<li><div class="grow"><b>' + esc(r.cuando.slice(11, 16)) + ' · ' + (r.tipo === 'llamada' ? 'Llamar: ' : '') + esc(r.titulo || (c ? c.nombre : 'Recordatorio')) + '</b><small class="sub">' + (r.tipo === 'llamada' ? 'Llamada' : 'Evento') + (c && r.titulo ? ' · ' + esc(c.nombre) : '') + '</small></div>' +
      (r.hecho ? '<span class="pill ok">Hecho</span>' : '<button class="btn sm primary" data-act="rec-hecho" data-id="' + esc(r.id) + '">Hecho</button>') +
      '<button class="btn sm ghost" data-act="ed-rec" data-id="' + esc(r.id) + '">Editar</button></li>';
  }
  function vistaSemana() {
    const i = M.inicioSemana(S.agenda.fecha);
    const hoy = M.ymd(new Date());
    let h = '<div class="semana">';
    for (let n = 0; n < 7; n++) {
      const d = M.addDays(i, n);
      const y = M.ymd(d);
      const evs = M.eventosDia(y);
      h += '<div class="col' + (y === hoy ? ' hoy' : '') + '" data-fecha="' + y + '" data-drop="1"><h3><button class="btn sm ghost" data-act="ir-dia" data-fecha="' + y + '">' + esc(M.fDiaSemana(d)) + ' ' + d.getDate() + '</button><button class="btn sm ghost" data-act="nueva-cita" data-fecha="' + y + '" aria-label="Nueva cita el ' + esc(M.fLarga(d)) + '">' + ico('mas', 'sm') + '</button></h3>' +
        (evs.length ? evs.map((e) => chip(e)).join('') : '<span class="sub">—</span>') + '</div>';
    }
    return h + '</div>';
  }
  function vistaDia() {
    const d = S.agenda.fecha;
    const y = M.ymd(d);
    const evs = M.eventosDia(y);
    const PX = 56;
    const items = evs.map((e) => {
      const s = Number(e.hora.slice(0, 2)) * 60 + Number(e.hora.slice(3, 5));
      return { e, s, f: s + (e.k === 'cita' ? Math.max(e.o.duracionMin || 60, 30) : 30) };
    }).sort((a, b) => a.s - b.s || a.f - b.f);
    // carriles para eventos solapados
    let grupo = [], fin = -1;
    const cerrar = () => { const cols = []; grupo.forEach((it) => { let c = cols.findIndex((x) => x <= it.s); if (c < 0) { c = cols.length; cols.push(it.f); } else cols[c] = it.f; it.col = c; }); grupo.forEach((it) => { it.cols = cols.length; }); grupo = []; fin = -1; };
    items.forEach((it) => { if (grupo.length && it.s >= fin) cerrar(); grupo.push(it); fin = Math.max(fin, it.f); });
    if (grupo.length) cerrar();
    const ini = Math.min(360, items.length ? Math.floor(items[0].s / 60) * 60 : 360);
    const fn = Math.max(1320, items.length ? Math.ceil(Math.max(...items.map((i) => i.f)) / 60) * 60 : 1320);
    let h = '<div class="tl" style="height:' + ((fn - ini) / 60 * PX) + 'px">';
    for (let m = ini; m < fn; m += 60) {
      const hh = M.pad(m / 60) + ':00';
      h += '<button type="button" class="h" style="top:' + ((m - ini) / 60 * PX) + 'px;height:' + PX + 'px" data-act="nueva-cita" data-fecha="' + y + '" data-hora="' + hh + '" aria-label="Nueva cita a las ' + hh + '">' + hh + '</button>';
    }
    items.forEach((it) => {
      const top = (it.s - ini) / 60 * PX;
      const alto = Math.max((it.f - it.s) / 60 * PX - 2, 24);
      h += '<button type="button" class="evt ' + (it.e.k === 'rec' ? 'rec' : '') + '" style="top:' + top + 'px;height:' + alto + 'px;left:calc(54px + (100% - 62px) * ' + (it.col / it.cols) + ');width:calc((100% - 62px) / ' + it.cols + ' - 3px)" data-act="ver-ev" data-k="' + it.e.k + '" data-id="' + esc(it.e.id) + '"><b>' + esc(it.e.hora) + '</b> ' + (it.e.k === 'rec' && it.e.o.tipo === 'llamada' ? '☎ ' : '') + esc(it.e.titulo) + '</button>';
    });
    if (y === M.ymd(new Date())) {
      const n = new Date();
      const m = n.getHours() * 60 + n.getMinutes();
      if (m >= ini && m <= fn) h += '<div class="ahora" style="top:' + ((m - ini) / 60 * PX) + 'px"></div>';
    }
    return h + '</div>';
  }
  V.agenda = () => {
    const a = S.agenda;
    const seg = (v, t) => '<button type="button" data-act="vista" data-v="' + v + '" aria-pressed="' + (a.vista === v) + '">' + t + '</button>';
    return '<div class="top"><h1>Agenda</h1><div class="seg noprint" role="group" aria-label="Vista">' + seg('mes', 'Mes') + seg('semana', 'Semana') + seg('dia', 'Día') + '</div></div>' +
      '<div class="row between noprint" style="margin-bottom:12px"><div class="row"><button class="btn sm" data-act="nav" data-d="-1" aria-label="Anterior">' + ico('izq', 'sm') + '</button><button class="btn sm" data-act="nav" data-d="0">Hoy</button><button class="btn sm" data-act="nav" data-d="1" aria-label="Siguiente">' + ico('der', 'sm') + '</button><h2 class="cap" aria-live="polite">' + esc(tituloPeriodo()) + '</h2></div>' +
      '<div class="row"><button class="btn sm primary" data-act="nueva-cita" data-fecha="' + a.sel + '">' + ico('mas', 'sm') + ' Cita</button><button class="btn sm" data-act="nuevo-rec" data-fecha="' + a.sel + '">' + ico('mas', 'sm') + ' Recordatorio</button><button class="btn sm ghost" data-act="ics-agenda" title="Descarga las citas y recordatorios futuros para tu calendario">Exportar .ics</button></div></div>' +
      (a.vista === 'mes' ? vistaMes() : a.vista === 'semana' ? vistaSemana() : vistaDia()) +
      '<p class="sub" style="margin-top:10px">En escritorio puedes arrastrar una cita o recordatorio a otro día. En el móvil, ábrelo y cambia la fecha.</p>';
  };

  /* ---------- Clientes ---------- */
  V.listaClientes = () => {
    const q = norm(S.cli.q);
    const ahora = ahoraS();
    const lista = M.db.clientes.filter((c) => (!S.cli.estado || c.estado === S.cli.estado) && (!q || norm(c.nombre + ' ' + c.telefono + ' ' + c.email + ' ' + c.direccion).includes(q)))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    if (!lista.length) return vacio(M.db.clientes.length ? 'Ningún cliente coincide con la búsqueda.' : 'Aún no hay clientes. Crea el primero con «Nuevo cliente».');
    return '<ul class="list">' + lista.map((c) => {
      const llamada = M.db.recordatorios.some((r) => r.clienteId === c.id && r.tipo === 'llamada' && !r.hecho && r.cuando <= ahora);
      return '<li><a class="item-link" href="#/clientes/' + esc(c.id) + '"><span class="avatar">' + esc(iniciales(c.nombre)) + '</span><span class="grow"><b>' + esc(c.nombre) + '</b><small>' + esc([c.telefono, c.email].filter(Boolean).join(' · ') || 'Sin datos de contacto') + '</small></span>' + (llamada ? '<span class="pill danger">Llamada pendiente</span>' : '') + pillEstadoCliente(c.estado) + '</a></li>';
    }).join('') + '</ul>';
  };
  V.clientes = () => {
    const chip = (v, t) => '<button type="button" class="chipbtn" data-act="filtro-cli" data-v="' + v + '" aria-pressed="' + (S.cli.estado === v) + '">' + t + '</button>';
    return '<div class="top"><h1>Clientes</h1><button class="btn primary" data-act="nuevo-cliente">' + ico('mas', 'sm') + ' Nuevo cliente</button></div>' +
      '<label class="sr" for="q-cli">Buscar clientes</label><input id="q-cli" class="search" type="search" placeholder="Buscar por nombre, teléfono, email…" value="' + esc(S.cli.q) + '" data-filtro="cli">' +
      '<div class="chips">' + chip('', 'Todos') + chip('lead', 'Contactos nuevos') + chip('activo', 'Clientes') + chip('inactivo', 'Inactivos') + '</div>' +
      '<div class="card" id="lista">' + V.listaClientes() + '</div>';
  };
  V.cliente = (id) => {
    const c = M.cliente(id);
    if (!c) return '<div class="top"><h1>Cliente no encontrado</h1></div><a class="btn" href="#/clientes">Volver a clientes</a>';
    const pres = M.db.presupuestos.filter((p) => p.clienteId === id).sort((a, b) => b.creado.localeCompare(a.creado));
    const citas = M.db.citas.filter((x) => x.clienteId === id).sort((a, b) => b.inicio.localeCompare(a.inicio));
    const recs = M.db.recordatorios.filter((r) => r.clienteId === id).sort((a, b) => a.hecho - b.hecho || a.cuando.localeCompare(b.cuando));
    const prox = recs.find((r) => !r.hecho);
    return '<div class="top"><a class="btn sm ghost" href="#/clientes">' + ico('izq', 'sm') + ' Clientes</a><h1>' + esc(c.nombre) + '</h1>' + pillEstadoCliente(c.estado) + '</div>' +
      '<div class="grid2"><section class="card"><h2>Datos</h2><dl class="kv">' +
      '<dt>Teléfono</dt><dd>' + (c.telefono ? esc(c.telefono) : '—') + '</dd><dt>Email</dt><dd>' + (c.email ? '<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>' : '—') + '</dd><dt>Dirección</dt><dd>' + (c.direccion ? esc(c.direccion) : '—') + '</dd><dt>Alta</dt><dd>' + esc(c.creado ? M.fCorta(M.parseL(c.creado)) : '—') + '</dd></dl>' +
      '<div class="row noprint" style="margin-top:12px">' + (c.telefono ? '<a class="btn sm primary" href="' + esc(M.telHref(c.telefono)) + '">' + ico('tel', 'sm') + ' Llamar</a><a class="btn sm" href="' + esc(M.waHref(c.telefono)) + '" target="_blank" rel="noopener">WhatsApp</a>' : '') +
      '<button class="btn sm" data-act="ed-cliente" data-id="' + esc(c.id) + '">Editar</button><button class="btn sm ghost" data-act="del-cliente" data-id="' + esc(c.id) + '">Eliminar</button></div></section>' +
      '<section class="card"><h2>Seguimiento</h2>' + (prox ? '<p><b>Próxima acción:</b> ' + (prox.tipo === 'llamada' ? 'llamar' : 'evento') + ' · ' + esc(M.fCuando(prox.cuando)) + (prox.cuando < ahoraS() ? ' <span class="pill danger">Vencido</span>' : '') + '</p>' : '<p class="sub">No hay ninguna acción programada.</p>') +
      '<div class="row noprint"><button class="btn sm" data-act="nuevo-rec" data-cliente="' + esc(c.id) + '" data-tipo="llamada">' + ico('mas', 'sm') + ' Programar llamada</button></div>' +
      (c.notas ? '<h3 style="margin-top:14px">Notas</h3><p style="white-space:pre-wrap;margin:4px 0 0">' + esc(c.notas) + '</p>' : '') + '</section></div>' +
      '<section class="card" style="margin-top:12px"><div class="row between"><h2 style="margin:0">Presupuestos</h2><button class="btn sm" data-act="nuevo-pres" data-cliente="' + esc(c.id) + '">' + ico('mas', 'sm') + ' Nuevo</button></div>' +
      (pres.length ? '<ul class="list">' + pres.map((p) => '<li><a class="item-link" href="#/presupuestos/' + esc(p.id) + '"><span class="grow"><b>' + esc(p.numero) + ' · ' + esc(p.tipo) + '</b><small>' + esc(p.fecha ? 'Servicio: ' + M.fCorta(M.parseD(p.fecha)) : 'Sin fecha de servicio') + '</small></span><b>' + esc(M.eur(M.totales(p).total)) + '</b>' + pillPres(p.estado) + '</a></li>').join('') + '</ul>' : vacio('Sin presupuestos.')) + '</section>' +
      '<section class="card" style="margin-top:12px"><div class="row between"><h2 style="margin:0">Citas</h2><button class="btn sm" data-act="nueva-cita" data-cliente="' + esc(c.id) + '">' + ico('mas', 'sm') + ' Nueva</button></div>' +
      (citas.length ? '<ul class="list">' + citas.map((x) => '<li><div class="grow"><b>' + esc(M.fCuando(x.inicio)) + ' · ' + esc(x.titulo || x.tipo) + '</b><small class="sub">' + esc(x.tipo + (x.lugar ? ' · ' + x.lugar : '')) + '</small></div>' + pillCita(x.estado) + '<button class="btn sm ghost" data-act="ed-cita" data-id="' + esc(x.id) + '">Editar</button></li>').join('') + '</ul>' : vacio('Sin citas.')) + '</section>' +
      '<section class="card" style="margin-top:12px"><h2>Recordatorios y llamadas</h2>' + (recs.length ? '<ul class="list">' + recs.map((r) => '<li><div class="grow"><b>' + (r.tipo === 'llamada' ? 'Llamada' : 'Evento') + (r.titulo ? ': ' + esc(r.titulo) : '') + '</b><small class="sub">' + esc(M.fCuando(r.cuando)) + '</small></div>' + (r.hecho ? '<span class="pill ok">Hecho</span>' : '<button class="btn sm primary" data-act="rec-hecho" data-id="' + esc(r.id) + '">Hecho</button>') + '<button class="btn sm ghost" data-act="ed-rec" data-id="' + esc(r.id) + '">Editar</button></li>').join('') + '</ul>' : vacio('Sin recordatorios.')) + '</section>';
  };

  /* ---------- Presupuestos ---------- */
  V.listaPres = () => {
    const q = norm(S.pres.q);
    const lista = M.db.presupuestos.filter((p) => (!S.pres.estado || p.estado === S.pres.estado) && (!q || norm(p.numero + ' ' + M.nombreCliente(p.clienteId) + ' ' + p.origen + ' ' + p.destino + ' ' + p.tipo).includes(q)))
      .sort((a, b) => b.creado.localeCompare(a.creado) || b.numero.localeCompare(a.numero));
    if (!lista.length) return vacio(M.db.presupuestos.length ? 'Ningún presupuesto coincide.' : 'Aún no hay presupuestos. Crea el primero con «Nuevo presupuesto».');
    return '<ul class="list">' + lista.map((p) => '<li><a class="item-link" href="#/presupuestos/' + esc(p.id) + '"><span class="grow"><b>' + esc(p.numero) + ' · ' + esc(M.nombreCliente(p.clienteId) || 'Sin cliente') + '</b><small>' + esc(p.tipo + (p.fecha ? ' · ' + M.fCorta(M.parseD(p.fecha)) : '')) + '</small></span><b>' + esc(M.eur(M.totales(p).total)) + '</b>' + pillPres(p.estado) + '</a></li>').join('') + '</ul>';
  };
  V.presupuestos = () => {
    const chip = (v, t) => '<button type="button" class="chipbtn" data-act="filtro-pres" data-v="' + v + '" aria-pressed="' + (S.pres.estado === v) + '">' + t + '</button>';
    const acept = M.db.presupuestos.filter((p) => p.estado === 'aceptado').reduce((s, p) => s + M.totales(p).total, 0);
    return '<div class="top"><h1>Presupuestos</h1><button class="btn primary" data-act="nuevo-pres">' + ico('mas', 'sm') + ' Nuevo presupuesto</button></div>' +
      '<label class="sr" for="q-pres">Buscar presupuestos</label><input id="q-pres" class="search" type="search" placeholder="Buscar por número, cliente, dirección…" value="' + esc(S.pres.q) + '" data-filtro="pres">' +
      '<div class="chips">' + chip('', 'Todos') + Object.keys(M.ESTADOS_PRES).map((k) => chip(k, M.ESTADOS_PRES[k])).join('') + '</div>' +
      (acept ? '<p class="sub">Total aceptado (IVA incluido): <b>' + esc(M.eur(acept)) + '</b></p>' : '') +
      '<div class="card" id="lista">' + V.listaPres() + '</div>';
  };
  V.presupuesto = (id) => {
    const p = M.db.presupuestos.find((x) => x.id === id);
    if (!p) return '<div class="top"><h1>Presupuesto no encontrado</h1></div><a class="btn" href="#/presupuestos">Volver</a>';
    const c = M.cliente(p.clienteId);
    const t = M.totales(p);
    const cfg = M.CFG;
    return '<div class="top noprint"><a class="btn sm ghost" href="#/presupuestos">' + ico('izq', 'sm') + ' Presupuestos</a><h1 class="nw">' + esc(p.numero) + '</h1>' + pillPres(p.estado) + '</div>' +
      '<div class="chips noprint" role="group" aria-label="Estado">' + Object.keys(M.ESTADOS_PRES).map((k) => '<button type="button" class="chipbtn" data-act="estado-pres" data-id="' + esc(p.id) + '" data-estado="' + k + '" aria-pressed="' + (p.estado === k) + '">' + esc(M.ESTADOS_PRES[k]) + '</button>').join('') + '</div>' +
      '<div class="row noprint" style="margin-bottom:12px"><button class="btn primary" data-act="imprimir">Imprimir / guardar PDF</button><button class="btn" data-act="copiar-pres" data-id="' + esc(p.id) + '">Copiar resumen</button><button class="btn" data-act="ed-pres" data-id="' + esc(p.id) + '">Editar</button><button class="btn" data-act="pres-cita" data-id="' + esc(p.id) + '">Crear cita</button><button class="btn ghost" data-act="dup-pres" data-id="' + esc(p.id) + '">Duplicar</button><button class="btn ghost" data-act="del-pres" data-id="' + esc(p.id) + '">Eliminar</button></div>' +
      '<article class="hoja"><div class="row between" style="align-items:flex-start"><div><h2>' + esc(cfg.empresa) + '</h2>' + (cfg.telefono ? '<div class="small">Tel. ' + esc(cfg.telefono) + '</div>' : '') + '</div><div class="der"><b>PRESUPUESTO ' + esc(p.numero) + '</b><div class="small">Fecha: ' + esc(p.creado ? M.fCorta(M.parseL(p.creado)) + ' ' + M.parseL(p.creado).getFullYear() : '') + '</div>' + (p.validezDias ? '<div class="small">Validez: ' + esc(p.validezDias) + ' días</div>' : '') + '</div></div>' +
      '<p style="margin:16px 0 4px"><b>Cliente:</b> ' + esc(c ? c.nombre : 'Sin cliente') + (c ? '<br><span class="small">' + esc([c.telefono, c.email, c.direccion].filter(Boolean).join(' · ')) + '</span>' : '') + '</p>' +
      '<p style="margin:8px 0"><b>Servicio:</b> ' + esc(p.tipo) + (p.fecha ? ' · fecha prevista ' + esc(M.fCorta(M.parseD(p.fecha))) + ' ' + esc(M.parseD(p.fecha).getFullYear()) : '') + (p.origen || p.destino ? '<br><span class="small">' + (p.origen ? 'Origen: ' + esc(p.origen) : '') + (p.origen && p.destino ? ' → ' : '') + (p.destino ? 'Destino: ' + esc(p.destino) : '') + '</span>' : '') + '</p>' +
      '<table><thead><tr><th>Concepto</th><th class="r">Cant.</th><th class="r">Precio</th><th class="r">Importe</th></tr></thead><tbody>' +
      (p.lineas.length ? p.lineas.map((l) => '<tr><td>' + esc(l.concepto) + '</td><td class="r">' + esc(String(l.cantidad).replace('.', ',')) + '</td><td class="r">' + esc(M.eur(l.precioC)) + '</td><td class="r">' + esc(M.eur(Math.round(l.cantidad * l.precioC))) + '</td></tr>').join('') : '<tr><td colspan="4" class="small">Sin líneas.</td></tr>') + '</tbody></table>' +
      '<div class="tot"><span>Base imponible</span><span style="text-align:right">' + esc(M.eur(t.sub)) + '</span><span>IVA ' + esc(String(p.ivaPct).replace('.', ',')) + ' %</span><span style="text-align:right">' + esc(M.eur(t.iva)) + '</span><span class="t">Total</span><span class="t" style="text-align:right">' + esc(M.eur(t.total)) + '</span></div>' +
      (p.notas ? '<p style="margin-top:16px;white-space:pre-wrap"><b>Condiciones / notas</b><br>' + esc(p.notas) + '</p>' : '') + '</article>';
  };

  /* ---------- Solicitudes (buzón fuera de horario) ---------- */
  V.solicitudes = () => {
    const b = M.getBuzon();
    const tieneClave = Boolean(M.getClave());
    return '<div class="top"><h1>Solicitudes</h1><button class="btn primary" data-act="sync">' + ico('sync', 'sm') + ' Sincronizar buzón</button></div>' +
      '<p class="sub">Aquí llegan las peticiones que los clientes envían desde la página pública, también fuera de horario.' + (b.cuando ? ' Última sincronización: ' + esc(M.fCuando(b.cuando)) + '.' : '') + '</p>' +
      (tieneClave ? '' : '<div class="alert">Falta la clave del buzón. Introdúcela en <a href="#/ajustes">Ajustes</a> para poder sincronizar.</div>') +
      (b.pendientes.length ? '<div class="stack">' + b.pendientes.map((s) => {
        const ruta = [s.origen, s.destino].filter(Boolean).join(' → ');
        return '<article class="card"><div class="row between"><b>' + esc(s.nombre) + '</b><span class="row"><span class="pill acc">' + esc(s.servicio) + '</span>' + (s.fueraHorario ? '<span class="pill warn">Fuera de horario</span>' : '') + '</span></div>' +
          '<p class="sub" style="margin:4px 0">Recibida: ' + esc(s.recibido ? M.fCuando(M.ldt(new Date(s.recibido))) : '—') + '</p>' +
          '<dl class="kv"><dt>Teléfono</dt><dd><a href="' + esc(M.telHref(s.telefono)) + '">' + esc(s.telefono) + '</a></dd>' + (s.email ? '<dt>Email</dt><dd>' + esc(s.email) + '</dd>' : '') + (ruta ? '<dt>Ruta</dt><dd>' + esc(ruta) + '</dd>' : '') + (s.fecha ? '<dt>Fecha deseada</dt><dd>' + esc(s.fecha) + '</dd>' : '') + (s.franja ? '<dt>Llamar</dt><dd>' + esc(s.franja) + '</dd>' : '') + (s.detalles ? '<dt>Detalles</dt><dd style="white-space:pre-wrap">' + esc(s.detalles) + '</dd>' : '') + '</dl>' +
          '<div class="row" style="margin-top:12px"><button class="btn primary" data-act="aceptar-sol" data-id="' + esc(s.id) + '">Crear cliente y recordatorio de llamada</button><button class="btn ghost" data-act="descartar-sol" data-id="' + esc(s.id) + '">Descartar</button></div></article>';
      }).join('') + '</div>' : '<div class="card">' + vacio(b.cuando ? 'No hay solicitudes nuevas.' : 'Pulsa «Sincronizar buzón» para ver si hay solicitudes.') + '</div>');
  };

  /* ---------- Ajustes ---------- */
  V.ajustes = () => {
    const cfg = M.CFG;
    const nombres = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const orden = [1, 2, 3, 4, 5, 6, 0];
    const perm = 'Notification' in window ? Notification.permission : 'no disponible';
    const n = M.db;
    return '<div class="top"><h1>Ajustes</h1></div><div class="stack">' +
      '<section class="card"><h2>Empresa y horario</h2><p class="sub">Se editan en el archivo <code>config.js</code> y se vuelve a desplegar.</p><dl class="kv"><dt>Empresa</dt><dd>' + esc(cfg.empresa) + '</dd><dt>IVA por defecto</dt><dd>' + esc(cfg.iva) + ' %</dd>' +
      orden.map((d) => '<dt>' + nombres[d] + '</dt><dd>' + esc(M.H.textoDia(d)) + '</dd>').join('') + '</dl></section>' +
      '<section class="card"><h2>Página pública de solicitudes</h2><p>Comparte este enlace con tus clientes (web, redes, firma de correo). Las peticiones llegan al buzón y las ves en «Solicitudes».</p><p><code id="enlace">' + esc(location.origin + location.pathname.replace(/[^/]*$/, '') + 'solicitar.html') + '</code></p><button class="btn" data-act="copiar-enlace">Copiar enlace</button></section>' +
      '<section class="card"><h2>Clave del buzón</h2><p class="sub">Es la misma clave que se configuró en el servidor (variable <code>ADMIN_KEY</code>). Se guarda solo en este dispositivo y no se incluye en las copias de seguridad.</p>' +
      '<form data-form="clave"><label class="field"><span>Clave</span><input type="password" name="clave" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="' + (M.getClave() ? 'Guardada en este dispositivo' : 'Pega aquí la clave') + '"></label><div class="row"><button class="btn primary" type="submit">Guardar clave</button>' + (M.getClave() ? '<button class="btn ghost" type="button" data-act="quitar-clave">Quitar</button>' : '') + '</div></form></section>' +
      '<section class="card"><h2>Avisos de recordatorios</h2><p>Estado del permiso: <b>' + esc(perm === 'granted' ? 'concedido' : perm === 'denied' ? 'bloqueado' : perm === 'default' ? 'sin decidir' : perm) + '</b>.</p>' +
      '<p class="sub">Los avisos solo suenan <b>mientras la aplicación está abierta</b>. Con la app cerrada no puede avisar. Para tener alarma siempre, usa «Exportar .ics» en la Agenda o en cada cita/recordatorio e impórtalo en el calendario del móvil.</p>' +
      (perm === 'default' ? '<button class="btn primary" data-act="notif-activar">Activar avisos</button>' : '') + '</section>' +
      '<section class="card"><h2>Copia de seguridad</h2><p>Los datos (' + n.clientes.length + ' clientes, ' + n.presupuestos.length + ' presupuestos, ' + n.citas.length + ' citas, ' + n.recordatorios.length + ' recordatorios) se guardan <b>solo en este dispositivo y navegador</b>. Si borras los datos del navegador o cambias de móvil, se pierden. Exporta una copia con regularidad; también sirve para pasar los datos de un dispositivo a otro.</p>' +
      '<div class="row"><button class="btn primary" data-act="exportar">Exportar copia (.json)</button><button class="btn" data-act="importar">Importar copia…</button><input type="file" id="file-imp" accept="application/json,.json" hidden></div></section>' +
      '<section class="card"><h2>Borrar datos</h2><p class="sub">Elimina todos los datos de este dispositivo. No se puede deshacer.</p><button class="btn danger" data-act="borrar-todo">Borrar todo</button></section></div>';
  };

  /* ---------- Formularios (diálogos) ---------- */
  const campo = (etq, input) => '<label class="field"><span>' + esc(etq) + '</span>' + input + '</label>';
  const acciones = (extra) => '<div class="dlg-actions">' + (extra || '') + '<button type="button" class="btn" data-act="cerrar">Cancelar</button><button type="submit" class="btn primary">Guardar</button></div>';

  V.fCliente = (c, nuevo) =>
    '<form class="dlg-body" data-form="cliente" novalidate><h2>' + (nuevo ? 'Nuevo cliente' : 'Editar cliente') + '</h2><input type="hidden" name="id" value="' + esc(c.id) + '">' +
    campo('Nombre *', '<input name="nombre" required maxlength="120" autocomplete="off" value="' + esc(c.nombre) + '">') +
    '<div class="cols2">' + campo('Teléfono', '<input name="telefono" type="tel" inputmode="tel" maxlength="30" value="' + esc(c.telefono) + '">') + campo('Email', '<input name="email" type="email" maxlength="120" value="' + esc(c.email) + '">') + '</div>' +
    campo('Dirección', '<input name="direccion" maxlength="200" value="' + esc(c.direccion) + '">') +
    campo('Estado', '<select name="estado">' + optsObj(M.ESTADOS_CLIENTE, c.estado) + '</select>') +
    campo('Notas', '<textarea name="notas" maxlength="3000">' + esc(c.notas) + '</textarea>') +
    '<div class="alert err" id="err" hidden></div>' + acciones() + '</form>';

  V.fRec = (r, nuevo) =>
    '<form class="dlg-body" data-form="rec" novalidate><h2>' + (nuevo ? 'Nuevo recordatorio' : 'Editar recordatorio') + '</h2><input type="hidden" name="id" value="' + esc(r.id) + '">' +
    '<div class="cols2">' + campo('Tipo', '<select name="tipo"><option value="llamada"' + (r.tipo === 'llamada' ? ' selected' : '') + '>Llamada</option><option value="evento"' + (r.tipo === 'evento' ? ' selected' : '') + '>Evento</option></select>') + campo('Cliente', '<select name="clienteId">' + optsClientes(r.clienteId, '(sin cliente)') + '</select>') + '</div>' +
    campo('Título', '<input name="titulo" maxlength="150" placeholder="Qué hay que recordar" value="' + esc(r.titulo) + '">') +
    '<div class="cols2">' + campo('Fecha', '<input name="fecha" type="date" required value="' + esc(r.cuando.slice(0, 10)) + '">') + campo('Hora', '<input name="hora" type="time" required value="' + esc(r.cuando.slice(11, 16)) + '">') + '</div>' +
    campo('Notas', '<textarea name="notas" maxlength="1500">' + esc(r.notas) + '</textarea>') +
    '<div class="alert err" id="err" hidden></div>' +
    acciones((nuevo ? '' : '<button type="button" class="btn ghost" data-act="ics-rec" data-id="' + esc(r.id) + '">Exportar .ics</button><button type="button" class="btn danger" data-act="del-rec" data-id="' + esc(r.id) + '">Eliminar</button>')) + '</form>';

  V.fCita = (c, nuevo) =>
    '<form class="dlg-body" data-form="cita" novalidate><h2>' + (nuevo ? 'Nueva cita' : 'Editar cita') + '</h2><input type="hidden" name="id" value="' + esc(c.id) + '">' +
    '<div class="cols2">' + campo('Cliente', '<select name="clienteId">' + optsClientes(c.clienteId, '(sin cliente)') + '</select>') + campo('Tipo', '<select name="tipo">' + optsArr(M.TIPOS_CITA, c.tipo) + '</select>') + '</div>' +
    campo('Título', '<input name="titulo" maxlength="150" placeholder="Si lo dejas vacío se usa el tipo" value="' + esc(c.titulo) + '">') +
    '<div class="cols3">' + campo('Fecha', '<input name="fecha" type="date" required data-solape value="' + esc(c.inicio.slice(0, 10)) + '">') + campo('Hora', '<input name="hora" type="time" required data-solape value="' + esc(c.inicio.slice(11, 16)) + '">') + campo('Duración (min)', '<input name="duracion" type="number" min="15" max="1440" step="15" required data-solape value="' + esc(c.duracionMin) + '">') + '</div>' +
    '<div class="alert" id="solape" hidden></div>' +
    campo('Lugar', '<input name="lugar" maxlength="200" value="' + esc(c.lugar) + '">') +
    '<div class="cols2">' + campo('Estado', '<select name="estado">' + optsObj(M.ESTADOS_CITA, c.estado) + '</select>') +
    (nuevo ? campo('Avisarme', '<select name="aviso"><option value="">Sin aviso</option><option value="30">30 minutos antes</option><option value="60" selected>1 hora antes</option><option value="1440">1 día antes</option></select>') : '') + '</div>' +
    campo('Notas', '<textarea name="notas" maxlength="1500">' + esc(c.notas) + '</textarea>') +
    '<div class="alert err" id="err" hidden></div>' +
    acciones((nuevo ? '' : '<button type="button" class="btn ghost" data-act="ics-cita" data-id="' + esc(c.id) + '">Exportar .ics</button><button type="button" class="btn danger" data-act="del-cita" data-id="' + esc(c.id) + '">Eliminar</button>')) + '</form>';

  const CONCEPTOS = ['Camión con conductor (hora)', 'Operario (hora)', 'Embalaje y protección', 'Desmontaje y montaje de muebles', 'Desplazamiento', 'Seguro de transporte', 'Portes'];
  const fila = (l) => '<div class="linea"><input name="concepto" list="conceptos" maxlength="300" placeholder="Concepto" aria-label="Concepto" value="' + esc(l.concepto) + '"><input name="cantidad" inputmode="decimal" aria-label="Cantidad" value="' + esc(String(l.cantidad).replace('.', ',')) + '"><input name="precio" inputmode="decimal" placeholder="0,00" aria-label="Precio unitario" value="' + (l.precioC ? esc(M.deCent(l.precioC).replace('.', ',')) : '') + '"><button type="button" class="x" data-act="linea-del" aria-label="Quitar línea">×</button></div>';
  V.fila = fila;
  V.fPres = (p, nuevo) =>
    '<form class="dlg-body" data-form="pres" novalidate><h2>' + (nuevo ? 'Nuevo presupuesto' : 'Editar presupuesto ' + esc(p.numero)) + '</h2><input type="hidden" name="id" value="' + esc(p.id) + '">' +
    (M.db.clientes.length ? '' : '<div class="alert">Aún no hay clientes. Crea uno primero para asociarlo al presupuesto.</div>') +
    '<div class="cols2">' + campo('Cliente *', '<select name="clienteId" required>' + optsClientes(p.clienteId, '(elige un cliente)') + '</select>') + campo('Tipo de servicio', '<select name="tipo">' + optsArr(M.CFG.tiposServicio, p.tipo) + '</select>') + '</div>' +
    '<div class="cols2">' + campo('Origen', '<input name="origen" maxlength="200" value="' + esc(p.origen) + '">') + campo('Destino', '<input name="destino" maxlength="200" value="' + esc(p.destino) + '">') + '</div>' +
    '<div class="cols3">' + campo('Fecha del servicio', '<input name="fecha" type="date" value="' + esc(p.fecha) + '">') + campo('IVA (%)', '<input name="ivaPct" inputmode="decimal" value="' + esc(String(p.ivaPct).replace('.', ',')) + '">') + campo('Validez (días)', '<input name="validezDias" type="number" min="0" max="365" value="' + esc(p.validezDias) + '">') + '</div>' +
    '<div class="field"><span>Líneas</span></div><div class="lineas" id="lineas">' + (p.lineas.length ? p.lineas : [{ concepto: '', cantidad: 1, precioC: 0 }]).map(fila).join('') + '</div>' +
    '<datalist id="conceptos">' + CONCEPTOS.map((c) => '<option value="' + esc(c) + '">').join('') + '</datalist>' +
    '<button type="button" class="btn sm" data-act="linea-add">' + ico('mas', 'sm') + ' Añadir línea</button><div class="tot" id="tot"></div>' +
    campo('Condiciones / notas', '<textarea name="notas" maxlength="3000">' + esc(p.notas) + '</textarea>') +
    '<div class="alert err" id="err" hidden></div>' + acciones() + '</form>';
})();
