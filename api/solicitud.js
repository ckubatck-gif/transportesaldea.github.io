'use strict';
// POST /api/solicitud — endpoint público: recibe una solicitud de un cliente y la guarda cifrada.
const buzon = require('../lib/buzon');
const store = require('../lib/store');

const MAX_PENDIENTES = 200;

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'metodo' });
  }
  if (!buzon.mismoOrigen(req)) return res.status(403).json({ ok: false, error: 'origen' });

  const key = buzon.clave();
  if (!key || !store.disponible()) {
    return res.status(503).json({ ok: false, error: 'buzon_no_configurado' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  const v = buzon.validarSolicitud(body);
  if (!v.ok) return res.status(400).json({ ok: false, error: v.error });
  if (v.descartar) return res.status(200).json({ ok: true });

  try {
    const pendientes = await store.listar();
    if (pendientes.length >= MAX_PENDIENTES) {
      return res.status(429).json({ ok: false, error: 'buzon_lleno' });
    }
    await store.guardar(buzon.cifrar(v.dato, key));
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('solicitud_error', e && e.message);
    return res.status(502).json({ ok: false, error: 'almacen' });
  }
};
