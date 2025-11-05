// srv/db.js
const { MongoClient, ObjectId } = require('mongodb');

let client;
let db;

const DB_NAME = process.env.MONGO_DBNAME || 'deepseek_chat';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';

// Helper para convertir y validar ObjectId (evita overloads deprecados)
function asObjectId(id) {
  if (id instanceof ObjectId) return id;
  if (typeof id === 'string') {
    if (!ObjectId.isValid(id)) throw new Error('Id inválido');
    return ObjectId.createFromHexString(id);
  }
  throw new Error('Tipo de id no soportado');
}

// Helper para serializar _id en docs que se devuelven al renderer
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
async function crearSesion(titulo) {
  const r = await db.collection('conversaciones').insertOne({
    titulo,
    fecha_creacion: new Date(),
  });
  const doc = await db.collection('conversaciones').findOne({ _id: r.insertedId });
  return serializeId(doc);
}

async function obtenerSesiones() {
  const docs = await db
    .collection('conversaciones')
    .find({})
    .sort({ fecha_creacion: -1 })
    .toArray();
  return docs.map(serializeId);
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
  const items = await db
    .collection('mensajes')
    .find({ sesionId: _id })
    .sort({ timestamp: 1 })
    .toArray();

  // No necesitás sesionId en el renderer; si querés, lo serializo también
  return items.map((m) => ({ ...m, sesionId: String(m.sesionId) }));
}

// Guarda un par user/assistant como 2 docs (mejor para paginar/escalar)
async function guardarMensajePar(sesionId, userTexto, assistantTexto) {
  const _id = asObjectId(sesionId);
  const t = Date.now();
  await db.collection('mensajes').insertMany([
    {
      sesionId: _id,
      rol: 'user',
      contenido: userTexto,
      timestamp: new Date(t),
    },
    {
      sesionId: _id,
      rol: 'assistant',
      contenido: assistantTexto,
      timestamp: new Date(t + 1),
    },
  ]);
}

module.exports = {
  initDb,
  crearSesion,
  obtenerSesiones,
  eliminarSesionDB,
  obtenerHistorial,
  guardarMensajePar,
};
