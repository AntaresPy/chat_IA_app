const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
const dbName = 'deepseek_chat';
const coleccion = 'conversaciones';

// Conexión a MongoDB
async function conectar() {
  console.log('🔌 Conectando a MongoDB...');
  const cliente = new MongoClient(uri);
  await cliente.connect();
  console.log('✅ Conexión establecida.');
  const db = cliente.db(dbName);
  return { db, cliente };
}

// Crear nueva sesión
async function crearSesion(titulo) {
  console.log(`🆕 Creando sesión con título: "${titulo}"`);
  const { db, cliente } = await conectar();

  const resultado = await db.collection(coleccion).insertOne({
    titulo,
    fecha_creacion: new Date(),
    mensajes: []
  });

  console.log(`✅ Sesión creada con ID: ${resultado.insertedId}`);
  const sesion = await db.collection(coleccion).findOne({ _id: resultado.insertedId });

  await cliente.close();
  console.log('🔒 Conexión cerrada tras crear sesión.');
  return sesion;
}

// Listar sesiones
async function obtenerSesiones() {
  console.log('📂 Obteniendo lista de sesiones...');
  const { db, cliente } = await conectar();

  const sesiones = await db.collection(coleccion)
    .find({})
    .sort({ fecha_creacion: -1 })
    .toArray();

  console.log(`✅ ${sesiones.length} sesiones encontradas.`);
  await cliente.close();
  console.log('🔒 Conexión cerrada tras listar sesiones.');
  return sesiones;
}

// Obtener historial de una sesión
async function obtenerHistorial(idSesion) {
  console.log(`📜 Obteniendo historial para sesión ID: ${idSesion}`);
  const { db, cliente } = await conectar();

  try {
    const sesion = await db.collection(coleccion).findOne(
      { _id: new ObjectId(idSesion) },
      { projection: { mensajes: 1 } }
    );

    if (!sesion) {
      console.warn(`⚠️ No se encontró la sesión con ID: ${idSesion}`);
      return [];
    }

    const mensajes = sesion.mensajes || [];
    console.log(`✅ Historial recuperado con ${mensajes.length} mensajes.`);
    
    // Asegurarnos de que cada mensaje tiene los campos necesarios
    return mensajes.map(msg => ({
      rol: msg.rol || 'user',
      contenido: msg.contenido || '',
      timestamp: msg.timestamp || new Date()
    }));
  } catch (error) {
    console.error('❌ Error al obtener historial:', error);
    throw error;
  } finally {
    await cliente.close();
    console.log('🔒 Conexión cerrada tras obtener historial.');
  }
}

// Guardar mensaje en sesión
async function guardarMensaje(idSesion, mensajeUsuario, respuestaBot) {
  console.log(`💾 Guardando mensaje en sesión ID: ${idSesion}`);
  console.log(`🧑 Usuario: "${mensajeUsuario}"`);
  console.log(`🤖 Bot: "${respuestaBot}"`);

  const { db, cliente } = await conectar();
  const timestamp = new Date();

  try {
    await db.collection(coleccion).updateOne(
      { _id: new ObjectId(idSesion) },
      {
        $push: {
          mensajes: {
            $each: [
              { 
                rol: 'user', 
                contenido: mensajeUsuario,
                timestamp: timestamp
              },
              { 
                rol: 'assistant', 
                contenido: respuestaBot,
                timestamp: new Date(timestamp.getTime() + 1000) // 1 segundo después
              }
            ]
          }
        }
      }
    );

    console.log('✅ Mensaje guardado correctamente.');
  } catch (error) {
    console.error('❌ Error al guardar mensaje:', error);
    throw error;
  } finally {
    await cliente.close();
    console.log('🔒 Conexión cerrada tras guardar mensaje.');
  }
}

// Inicializar base de datos
async function inicializarBaseDeDatos() {
  console.log('🧪 Verificando estructura de base de datos...');
  const { db, cliente } = await conectar();

  try {
    const colecciones = await db.listCollections().toArray();
    const nombres = colecciones.map(c => c.name);

    if (!nombres.includes(coleccion)) {
      console.log(`🛠️ Colección '${coleccion}' no existe. Creando...`);
      await db.createCollection(coleccion);
      await db.collection(coleccion).createIndexes([
        { key: { fecha_creacion: -1 }, name: 'idx_fecha' },
        { key: { titulo: 1 }, name: 'idx_titulo' }
      ]);
      
      // Crear documento de prueba si la colección está vacía
      const count = await db.collection(coleccion).countDocuments();
      if (count === 0) {
        await crearSesion('Bienvenida a DeepSeek Chat');
      }
      
      console.log(`✅ Colección '${coleccion}' creada e indexada.`);
    } else {
      console.log(`✅ Colección '${coleccion}' ya existe.`);
    }

    console.log('✅ Base de datos inicializada correctamente.');
  } catch (error) {
    console.error('❌ Error al inicializar la base de datos:', error);
    throw error;
  } finally {
    await cliente.close();
    console.log('🔒 Conexión cerrada tras inicialización.');
  }
}

// Eliminar una sesión
async function eliminarSesionDB(idSesion) {
  console.log(`🗑️ Eliminando sesión ID: ${idSesion}`);
  const { db, cliente } = await conectar();

  try {
    await db.collection(coleccion).deleteOne({ _id: new ObjectId(idSesion) });
    console.log('✅ Sesión eliminada correctamente.');
  } catch (error) {
    console.error('❌ Error al eliminar sesión:', error);
    throw error;
  } finally {
    await cliente.close();
    console.log('🔒 Conexión cerrada tras eliminar sesión.');
  }
}

module.exports = {
  inicializarBaseDeDatos,
  crearSesion,
  obtenerSesiones,
  obtenerHistorial,
  guardarMensaje,
  eliminarSesionDB,
};