// main.js
require('dotenv').config({ quiet: true });
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const isProd = process.env.NODE_ENV === 'production';

process.on('unhandledRejection', (r) => console.error('[unhandledRejection]', r));
process.on('uncaughtException', (e) => console.error('[uncaughtException]', e));

const {
  initDb,
  crearSesion,
  obtenerSesiones,
  obtenerSesionPorId,
  actualizarModeloSesion,
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

    // ✅ opciones de la ventana (no van en webPreferences)
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'win32' ? 'hidden' : 'hiddenInset',
    titleBarOverlay: process.platform === 'win32'
      ? { color: '#0f1115', symbolColor: '#e6e6e6', height: 48 }
      : true,

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  await mainWindow.loadFile(path.join(__dirname, 'index.html'));
  if (!isProd) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

app.commandLine.appendSwitch('disable-features', 'AutofillServerCommunication,AutofillExtendedPaymentsEnabled');

app.whenReady().then(async () => {
  try {
    await initDb();
    await createWindow();
    Menu.setApplicationMenu(null);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  } catch (err) {
    console.error('[startup error]', err);
    app.quit();
  }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ===== IPC =====
ipcMain.handle('sesiones:listar', async () => obtenerSesiones());
ipcMain.handle('sesiones:obtener', async (_ev, id) => obtenerSesionPorId(id));
ipcMain.handle('sesiones:crear', async (_ev, payload) => {
  const titulo = payload?.titulo || 'Nueva conversación';
  const modelo = payload?.modelo;
  return crearSesion(titulo, modelo);
});
ipcMain.handle('sesiones:updateModelo', async (_ev, { id, modelo }) => {
  return actualizarModeloSesion(id, modelo);
});
ipcMain.handle('sesiones:eliminar', async (_ev, sesionId) => eliminarSesionDB(sesionId));

ipcMain.handle('historial:obtener', async (_ev, sesionId) => obtenerHistorial(sesionId));

ipcMain.handle('chat:enviar', async (_ev, { sesionId, mensajes, modelOverride }) => {
  const respuesta = await completarDeepseek(mensajes, modelOverride);
  const ultimoUser = mensajes[mensajes.length - 1]?.content ?? '';
  await guardarMensajePar(sesionId, ultimoUser, respuesta);
  return respuesta;
});
