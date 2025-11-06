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
  return { ...doc, _id: String(doc._id) };
}

async function initDb() {
  if (db) return db;
  client = new MongoClient(MONGO_URI, { maxPoolSize: 10 });
  await client.connect();
  db = client.db(DB_NAME);

  await db.collection('conversaciones').createIndex({ fecha_creacion: -1 });
  await db.collection('mensajes').createIndex({ sesionId: 1, timestamp: 1 });
  return db;
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
  return items.map((m) => ({ ...m, sesionId: String(m.sesionId) }));
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
  crearSesion,
  obtenerSesiones,
  obtenerSesionPorId,
  actualizarModeloSesion,
  eliminarSesionDB,
  obtenerHistorial,
  guardarMensajePar,
};
