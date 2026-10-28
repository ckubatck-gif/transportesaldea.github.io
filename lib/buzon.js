'use strict';
const crypto = require('crypto');

const SAL = 'mudanzas-buzon-v1';
let cache = null;

function adminKey() {
  const k = process.env.ADMIN_KEY || '';
  return k.length >= 16 ? k : null;
}

function clave() {
  const k = adminKey();
  if (!k) return null;
  if (!cache || cache.origen !== k) {
    cache = { origen: k, clave: crypto.scryptSync(k, SAL, 32) };
  }
  return cache.clave;
}

function cifrar(obj, key) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}

function descifrar(texto, key) {
  const b = Buffer.from(String(texto).trim(), 'base64');
  if (b.length < 29) throw new Error('formato');
  const d = crypto.createDecipheriv('aes-256-gcm', key, b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  const pt = Buffer.concat([d.update(b.subarray(28)), d.final()]);
  return JSON.parse(pt.toString('utf8'));
}

function autorizado(req) {
  const k = adminKey();
  if (!k) return false;
  const m = /^Bearer (.+)$/.exec(req.headers['authorization'] || '');
  if (!m) return false;
  const a = crypto.createHash('sha256').update(m[1]).digest();
  const b = crypto.createHash('sha256').update(k).digest();
  return crypto.timingSafeEqual(a, b);
}

// Rechaza peticiones de otro origen (defensa básica; no sustituye a la clave).
function mismoOrigen(req) {
  const o = req.headers['origin'];
  if (!o) return true;
  try {
    return new URL(o).host === req.headers['host'];
  } catch (e) {
    return false;
  }
}

const SERVICIOS = ['Mudanza', 'Transporte', 'Reparto', 'Otro'];
const FRANJAS = ['Lo antes posible', 'Por la mañana', 'Por la tarde'];

function txt(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

// Devuelve {ok:true, dato} o {ok:false, error}
function validarSolicitud(b) {
  if (!b || typeof b !== 'object') return { ok: false, error: 'invalida' };
  if (b.alt) return { ok: true, descartar: true }; // honeypot: se responde OK pero no se guarda
  const d = {
    nombre: txt(b.nombre, 80),
    telefono: txt(b.telefono, 20),
    email: txt(b.email, 120),
    servicio: txt(b.servicio, 20),
    origen: txt(b.origen, 160),
    destino: txt(b.destino, 160),
    fecha: txt(b.fecha, 10),
    franja: txt(b.franja, 30),
    detalles: txt(b.detalles, 1200)
  };
  if (!d.nombre) return { ok: false, error: 'nombre' };
  if (!/^[+0-9 ().-]{6,20}$/.test(d.telefono)) return { ok: false, error: 'telefono' };
  if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return { ok: false, error: 'email' };
  if (!SERVICIOS.includes(d.servicio)) return { ok: false, error: 'servicio' };
  if (d.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(d.fecha)) return { ok: false, error: 'fecha' };
  if (d.franja && !FRANJAS.includes(d.franja)) d.franja = '';
  if (b.consentimiento !== true) return { ok: false, error: 'consentimiento' };
  d.fueraHorario = b.fueraHorario === true;
  d.recibido = new Date().toISOString();
  return { ok: true, dato: d };
}

module.exports = { adminKey, clave, cifrar, descifrar, autorizado, mismoOrigen, validarSolicitud };
