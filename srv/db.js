// srv/db.js
const { MongoClient, ObjectId } = require('mongodb');

let client;
let db;

const DB_NAME = process.env.MONGO_DBNAME || 'deepseek_chat';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DEFAULT_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

function asObjectId(id) {
  if (id instanceof ObjectId) return id;
  if (typeof id === 'string') {
    if (!ObjectId.isValid(id)) throw new Error('Id inválido');
    return ObjectId.createFromHexString(id);
  }
  throw new Error('Tipo de id no soportado');
}
function serializeId(doc) {
  if (!doc) return doc;
  // spread bien escrito
  const { _id, ...rest } = doc;
  return { ...rest, _id: String(_id) };
}

// crea colecciones/índices si no existen
async function ensureSchema(db) {
  const colls = await db.listCollections().toArray();
  const names = new Set(colls.map(c => c.name));

  if (!names.has('conversaciones')) await db.createCollection('conversaciones');
  if (!names.has('mensajes')) await db.createCollection('mensajes');

  await db.collection('conversaciones').createIndex({ fecha_creacion: -1 });
  await db.collection('mensajes').createIndex({ sesionId: 1, timestamp: 1 });
}

async function initDb({ retries = 1, delayMs = 1000 } = {}) {
  if (db) return db;

  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      client = new MongoClient(MONGO_URI, {
        maxPoolSize: 10,
        connectTimeoutMS: 8000,
        serverSelectionTimeoutMS: 8000,
      });
      await client.connect();
      db = client.db(DB_NAME);
      await ensureSchema(db);
      return db;
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

async function healthCheckDb(timeoutMs = 2000) {
  if (!db) return false;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    await db.command({ ping: 1 }, { signal: ctl.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

// ===== Sesiones =====
async function crearSesion(titulo, modelo) {
  const r = await db.collection('conversaciones').insertOne({
    titulo,
    modelo: modelo || DEFAULT_MODEL,
    fecha_creacion: new Date(),
  });
  const doc = await db.collection('conversaciones').findOne({ _id: r.insertedId });
  return serializeId(doc);
}
async function obtenerSesiones() {
  const docs = await db.collection('conversaciones')
    .find({})
    .sort({ fecha_creacion: -1 })
    .toArray();
  return docs.map(serializeId);
}
async function obtenerSesionPorId(sesionId) {
  const _id = asObjectId(sesionId);
  const doc = await db.collection('conversaciones').findOne({ _id });
  return serializeId(doc);
}
async function actualizarModeloSesion(sesionId, modelo) {
  const _id = asObjectId(sesionId);
  await db.collection('conversaciones').updateOne({ _id }, { $set: { modelo } });
  const doc = await db.collection('conversaciones').findOne({ _id });
  return serializeId(doc);
}
async function eliminarSesionDB(sesionId) {
  const _id = asObjectId(sesionId);
  await db.collection('mensajes').deleteMany({ sesionId: _id });
  const r = await db.collection('conversaciones').deleteOne({ _id });
  return { ok: r.acknowledged, deletedCount: r.deletedCount };
}

// ===== Historial =====
async function obtenerHistorial(sesionId) {
  const _id = asObjectId(sesionId);
  const items = await db.collection('mensajes')
    .find({ sesionId: _id })
    .sort({ timestamp: 1 })
    .toArray();
  // spread bien escrito
  return items.map(m => ({ ...m, sesionId: String(m.sesionId) }));
}
async function guardarMensajePar(sesionId, userTexto, assistantTexto) {
  const _id = asObjectId(sesionId);
  const t = Date.now();
  await db.collection('mensajes').insertMany([
    { sesionId: _id, rol: 'user', contenido: userTexto, timestamp: new Date(t) },
    { sesionId: _id, rol: 'assistant', contenido: assistantTexto, timestamp: new Date(t + 1) },
  ]);
}

module.exports = {
  initDb,
  healthCheckDb,
  crearSesion,
  obtenerSesiones,
  obtenerSesionPorId,
  actualizarModeloSesion,
  eliminarSesionDB,
  obtenerHistorial,
  guardarMensajePar,
};
