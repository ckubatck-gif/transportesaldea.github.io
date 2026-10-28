'use strict';
// Única pieza que toca Vercel Blob. Guarda solo texto cifrado (ver lib/buzon.js).
// Requiere la variable BLOB_READ_WRITE_TOKEN (se crea al conectar un Blob store al proyecto).

const PREFIJO = 'solicitudes/';

function disponible() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function sdk() {
  // import() dinámico: funciona tanto si el paquete es CommonJS como ESM.
  return import('@vercel/blob');
}

async function listar() {
  const { list } = await sdk();
  const out = [];
  let cursor;
  do {
    const r = await list({ prefix: PREFIJO, limit: 200, cursor });
    out.push(...r.blobs);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor && out.length < 1000);
  return out.map((b) => ({ pathname: b.pathname, url: b.url, subido: b.uploadedAt }));
}

async function leer(item) {
  const r = await fetch(item.url, { cache: 'no-store' });
  if (!r.ok) throw new Error('lectura_' + r.status);
  return r.text();
}

async function guardar(texto) {
  const { put } = await sdk();
  const nombre = PREFIJO + Date.now() + '.enc';
  await put(nombre, texto, {
    access: 'public', // el contenido está cifrado: la URL por sí sola no revela nada
    addRandomSuffix: true,
    contentType: 'text/plain'
  });
}

async function borrar(item) {
  const { del } = await sdk();
  await del(item.url);
}

module.exports = { PREFIJO, disponible, listar, leer, guardar, borrar };
