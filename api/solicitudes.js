'use strict';
// GET  /api/solicitudes            — lista (descifrada) las solicitudes pendientes. Requiere clave.
// DELETE /api/solicitudes?id=...   — borra una solicitud ya importada o descartada. Requiere clave.
const buzon = require('../lib/buzon');
const store = require('../lib/store');

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, DELETE');
    return res.status(405).json({ ok: false, error: 'metodo' });
  }
  if (!buzon.mismoOrigen(req)) return res.status(403).json({ ok: false, error: 'origen' });

  const key = buzon.clave();
  if (!key || !store.disponible()) {
    return res.status(503).json({ ok: false, error: 'buzon_no_configurado' });
  }
  if (!buzon.autorizado(req)) {
    await pausa(600); // frena un poco los intentos de adivinar la clave
    return res.status(401).json({ ok: false, error: 'clave' });
  }

  try {
    const items = await store.listar();

    if (req.method === 'DELETE') {
      const id = String((req.query && req.query.id) || '');
      if (!id.startsWith(store.PREFIJO)) return res.status(400).json({ ok: false, error: 'id' });
      const item = items.find((i) => i.pathname === id);
      if (!item) return res.status(404).json({ ok: false, error: 'no_existe' });
      await store.borrar(item);
      return res.status(200).json({ ok: true });
    }

    const out = [];
    let ilegibles = 0;
    for (const it of items) {
      try {
        const dato = buzon.descifrar(await store.leer(it), key);
        out.push({ id: it.pathname, ...dato });
      } catch (e) {
        ilegibles++;
      }
    }
    out.sort((a, b) => String(a.recibido).localeCompare(String(b.recibido)));
    return res.status(200).json({ ok: true, items: out, ilegibles });
  } catch (e) {
    console.error('solicitudes_error', e && e.message);
    return res.status(502).json({ ok: false, error: 'almacen' });
  }
};
