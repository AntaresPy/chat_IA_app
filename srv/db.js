// srv/db.js
const { MongoClient, ObjectId } = require('mongodb');

let client;
let db;

const DB_NAME = process.env.MONGO_DBNAME || 'deepseek_chat';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DEFAULT_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

// ---- helpers de error coherentes con el resto del app ----
function dbError(message, code = 'DB_ERROR', status = 500, extra = {}) {
  const e = new Error(message);
  e.code = code;
  e.status = status;
  e.data = extra;
  return e;
}

function assertDbReady() {
  if (!db) throw dbError('La base de datos no está inicializada', 'DB_NOT_READY', 503);
}

function asObjectId(id) {
  if (id instanceof ObjectId) return id;
  if (typeof id === 'string') {
    if (!ObjectId.isValid(id)) throw dbError('Id inválido', 'BAD_ID', 400, { id });
    return ObjectId.createFromHexString(id);
  }
  throw dbError('Tipo de id no soportado', 'BAD_ID', 400, { type: typeof id });
}

function serializeId(doc) {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return { ...rest, _id: String(_id) };
}

// crea colecciones/índices si no existen
async function ensureSchema(db) {
  try {
    const colls = await db.listCollections().toArray();
    const names = new Set(colls.map(c => c.name));

    if (!names.has('conversaciones')) await db.createCollection('conversaciones').catch(() => {});
    if (!names.has('mensajes')) await db.createCollection('mensajes').catch(() => {});

    await db.collection('conversaciones').createIndex({ fecha_creacion: -1 }).catch(() => {});
    await db.collection('mensajes').createIndex({ sesionId: 1, timestamp: 1 }).catch(() => {});
  } catch (e) {
    throw dbError('No se pudo asegurar el esquema de la BD', 'DB_SCHEMA', 500, { cause: e.message });
  }
}

async function initDb({ retries = 1, delayMs = 1000 } = {}) {
  if (!MONGO_URI) {
    throw dbError('MONGO_URI no definido en .env', 'DB_CONFIG', 500);
  }
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
  throw dbError('No se pudo conectar a MongoDB', 'DB_CONNECT', 503, { lastError: String(lastErr?.message || lastErr) });
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
  assertDbReady();
  const r = await db.collection('conversaciones').insertOne({
    titulo,
    modelo: modelo || DEFAULT_MODEL,
    fecha_creacion: new Date(),
  });
  const doc = await db.collection('conversaciones').findOne({ _id: r.insertedId });
  return serializeId(doc);
}

async function obtenerSesiones() {
  assertDbReady();
  const docs = await db.collection('conversaciones')
    .find({})
    .sort({ fecha_creacion: -1 })
    .toArray();
  return docs.map(serializeId);
}

async function obtenerSesionPorId(sesionId) {
  assertDbReady();
  const _id = asObjectId(sesionId);
  const doc = await db.collection('conversaciones').findOne({ _id });
  return serializeId(doc);
}

async function actualizarModeloSesion(sesionId, modelo) {
  assertDbReady();
  const _id = asObjectId(sesionId);
  await db.collection('conversaciones').updateOne({ _id }, { $set: { modelo } });
  const doc = await db.collection('conversaciones').findOne({ _id });
  return serializeId(doc);
}

async function eliminarSesionDB(sesionId) {
  assertDbReady();
  const _id = asObjectId(sesionId);
  await db.collection('mensajes').deleteMany({ sesionId: _id });
  const r = await db.collection('conversaciones').deleteOne({ _id });
  return { ok: r.acknowledged, deletedCount: r.deletedCount };
}

// ===== Historial =====
async function obtenerHistorial(sesionId) {
  assertDbReady();
  const _id = asObjectId(sesionId);
  const items = await db.collection('mensajes')
    .find({ sesionId: _id })
    .sort({ timestamp: 1 })
    .toArray();
  return items.map(m => ({ ...m, sesionId: String(m.sesionId) }));
}

async function guardarMensajePar(sesionId, userTexto, assistantTexto) {
  assertDbReady();
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
