'use strict';
(function () {
  const C = window.APP_CONFIG, H = window.APP_HORARIO;
  const $ = (s) => document.querySelector(s);
  const pad = (n) => String(n).padStart(2, '0');
  const hm = (d) => pad(d.getHours()) + ':' + pad(d.getMinutes());
  const dia = (d) => new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  $('#emp').textContent = C.empresa;
  document.title = 'Solicitar presupuesto · ' + C.empresa;
  $('#servicio').innerHTML = '<option value="">Elige…</option>' + C.tiposServicio.map((s) => '<option>' + esc(s) + '</option>').join('');
  const hoy = new Date();
  $('#fecha').min = hoy.getFullYear() + '-' + pad(hoy.getMonth() + 1) + '-' + pad(hoy.getDate());
  if (C.telefono) { const t = $('#tel'); t.hidden = false; t.innerHTML = 'También puedes llamarnos: <a href="tel:' + esc(C.telefono.replace(/[^\d+]/g, '')) + '">' + esc(C.telefono) + '</a>'; }

  // Información básica de protección de datos (capa 1). Texto provisional: revisar con asesoramiento en RGPD.
  const pend = (t) => '<span class="pend">[' + t + ']</span>';
  $('#rgpd').innerHTML = '<b>Información básica sobre protección de datos</b><dl>' +
    '<dt>Responsable</dt><dd>' + (C.responsable ? esc(C.responsable) : pend('pendiente: indicar en config.js')) + '</dd>' +
    '<dt>Finalidad</dt><dd>Atender tu solicitud de presupuesto y contactarte.</dd>' +
    '<dt>Legitimación</dt><dd>Tu consentimiento.</dd>' +
    '<dt>Destinatarios</dt><dd>Proveedores de alojamiento y almacenamiento, como encargados del tratamiento.</dd>' +
    '<dt>Derechos</dt><dd>Acceso, rectificación, supresión, oposición, limitación y portabilidad, y reclamar ante la Agencia Española de Protección de Datos.</dd>' +
    '<dt>Más información</dt><dd>' + (C.politicaPrivacidadUrl ? '<a href="' + esc(C.politicaPrivacidadUrl) + '" target="_blank" rel="noopener">Política de privacidad</a>' : pend('pendiente: enlace a la política de privacidad')) + '</dd></dl>';

  function estado() {
    const ahora = new Date();
    const el = $('#estado');
    if (H.estaAbierto(ahora)) {
      el.className = 'estado on';
      el.textContent = 'Estamos atendiendo hasta las ' + hm(H.cierreHoy(ahora)) + '. Déjanos tus datos y te llamamos lo antes posible.';
    } else {
      const ap = H.proximaApertura(ahora);
      el.className = 'estado off';
      el.textContent = 'Ahora estamos fuera de horario. Deja tu solicitud y te llamaremos' + (ap ? ' a partir del ' + dia(ap) + ' a las ' + hm(ap) + '.' : ' en cuanto abramos.');
    }
  }
  estado();
  setInterval(estado, 60000);

  const MENSAJES = {
    nombre: 'Escribe tu nombre.', telefono: 'Revisa el teléfono (solo números, +, espacios o guiones).', email: 'El email no parece válido.',
    servicio: 'Elige el tipo de servicio.', consentimiento: 'Necesitamos que aceptes el tratamiento de datos para poder contactarte.',
    buzon_no_configurado: 'El servicio de solicitudes no está disponible ahora mismo.', buzon_lleno: 'No podemos recibir más solicitudes por ahora.',
    almacen: 'No pudimos guardar tu solicitud. Inténtalo de nuevo en unos minutos.'
  };
  const f = $('#f');
  function fallo(msg) {
    const e = $('#err');
    e.textContent = msg + (C.telefono ? ' Puedes llamarnos al ' + C.telefono + '.' : '');
    e.hidden = false;
  }
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    $('#err').hidden = true;
    const fd = new FormData(f);
    const d = Object.fromEntries(fd.entries());
    d.consentimiento = fd.get('consentimiento') === 'on';
    d.fueraHorario = !H.estaAbierto(new Date());
    if (!String(d.nombre || '').trim()) return fallo(MENSAJES.nombre);
    if (!/^[+0-9 ().-]{6,20}$/.test(String(d.telefono || '').trim())) return fallo(MENSAJES.telefono);
    if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(d.email).trim())) return fallo(MENSAJES.email);
    if (!d.servicio) return fallo(MENSAJES.servicio);
    if (!d.consentimiento) return fallo(MENSAJES.consentimiento);
    const b = $('#enviar');
    b.disabled = true;
    b.textContent = 'Enviando…';
    try {
      const r = await fetch('api/solicitud', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        fallo(MENSAJES[j.error] || (r.status === 429 ? MENSAJES.buzon_lleno : 'No se pudo enviar la solicitud (código ' + r.status + ').'));
      } else {
        f.hidden = true;
        $('#estado').hidden = true;
        const ap = H.proximaApertura(new Date());
        $('#ok-txt').textContent = d.fueraHorario
          ? 'Hemos recibido tu solicitud fuera de horario. Te llamaremos' + (ap ? ' a partir del ' + dia(ap) + ' a las ' + hm(ap) : ' en cuanto abramos') + '.'
          : 'Hemos recibido tu solicitud. Te llamaremos lo antes posible.';
        const ok = $('#ok');
        ok.hidden = false;
        ok.focus();
      }
    } catch (e) {
      fallo('No hay conexión con el servidor. Comprueba tu conexión e inténtalo de nuevo.');
    }
    b.disabled = false;
    b.textContent = 'Enviar solicitud';
  });
})();
