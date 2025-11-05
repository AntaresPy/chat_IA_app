// main.js
require('dotenv').config(); // <-- CARGA .env ANTES DE CUALQUIER IMPORT

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isProd = process.env.NODE_ENV === 'production';

// Manejo de promesas no capturadas para evitar que el proceso muera sin logs claros
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

// Capa de datos y AI
const {
  initDb,
  crearSesion,
  obtenerSesiones,
  eliminarSesionDB,
  obtenerHistorial,
  guardarMensajePar,
} = require('./srv/db');

const { completarDeepseek } = require('./srv/ai');

let mainWindow;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  await mainWindow.loadFile(path.join(__dirname, 'index.html'));

  if (!isProd) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(async () => {
  try {
    await initDb(); // abre una sola conexión Mongo y deja todo listo
    await createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  } catch (err) {
    console.error('[startup error]', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ================== IPC seguro (Renderer -> Main) ==================

// Sesiones
ipcMain.handle('sesiones:listar', async () => obtenerSesiones());
ipcMain.handle('sesiones:crear', async (_ev, titulo) => crearSesion(titulo || 'Nueva conversación'));
ipcMain.handle('sesiones:eliminar', async (_ev, sesionId) => eliminarSesionDB(sesionId));

// Historial
ipcMain.handle('historial:obtener', async (_ev, sesionId) => obtenerHistorial(sesionId));

// Chat -> DeepSeek + persistencia
ipcMain.handle('chat:enviar', async (_ev, { sesionId, mensajes }) => {
  const respuesta = await completarDeepseek(mensajes);
  const ultimoUser = mensajes[mensajes.length - 1]?.content ?? '';
  await guardarMensajePar(sesionId, ultimoUser, respuesta);
  return respuesta;
});
