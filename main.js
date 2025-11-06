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
      devTools: false   // 🔒 fuerza deshabilitar DevTools en renderer
    },
  });

  await mainWindow.loadFile(path.join(__dirname, 'index.html'));
  //if (!isProd) mainWindow.webContents.openDevTools({ mode: 'detach' });
  // En desarrollo, podés optar por habilitarlas temporalmente:
  if (!isProd) mainWindow.webContents.setDevToolsWebContents(null);
}

app.commandLine.appendSwitch('disable-features', 'AutofillServerCommunication,AutofillExtendedPaymentsEnabled');

app.whenReady().then(async () => {
  try {
    await initDb();
    await createWindow();
    Menu.setApplicationMenu(null);

    // ⛔ Bloquear atajos de DevTools en todas las ventanas
    app.on('browser-window-created', (_e, win) => {
      win.webContents.on('before-input-event', (event, input) => {
        const isDevtoolsCombo =
          input.type === 'keyDown' && (
            input.key === 'F12' ||
            (input.control && input.shift && (input.key === 'I' || input.key === 'i'))
          );
        if (isDevtoolsCombo) event.preventDefault();
      });
    });
  } catch (err) {
    console.error('[startup error]', err);
    app.quit();
  }
});

const fs = require('fs');
function logFilePath() {
  try { return require('electron').app.getPath('userData') + '/app.log'; } catch { return 'app.log'; }
}
function log(...args) {
  try { fs.appendFileSync(logFilePath(), new Date().toISOString() + ' ' + args.join(' ') + '\n'); } catch {}
}

app.whenReady().then(async () => {
  try {
    await initDb();            // intenta conectar a Mongo
  } catch (e) {
    console.error('[DB]', e);
    log('[DB]', e && (e.stack || e));
    // 👉 no hacemos app.quit(); dejamos que la UI abra igual
  }
  await createWindow();        // siempre intenta abrir UI
  Menu.setApplicationMenu(null);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
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
