// main.js
const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// === Carga de .env robusta (antes de calcular isProd) ===
(() => {
  try {
    const dotenv = require('dotenv');
    // Dev: .env en cwd
    dotenv.config({ override: false });
    // Prod: .env empaquetado en resources
    if (app.isPackaged) {
      const maybePackedEnv = path.join(process.resourcesPath || '', '.env');
      if (fs.existsSync(maybePackedEnv)) {
        dotenv.config({ path: maybePackedEnv, override: true });
      }
    }
  } catch {}
})();

// Ahora sí: DEV/PROD
const isProd = app.isPackaged || process.env.NODE_ENV === 'production';

// === Logging rotativo ===
function getLogsDir() {
  try { return app.getPath('logs'); } catch { return path.join(process.cwd(), 'logs'); }
}
function ensureDir(p) { try { fs.mkdirSync(p, { recursive: true }); } catch {} }
function rotateIfNeeded(file, maxBytes = 5 * 1024 * 1024, keep = 5) {
  try {
    if (fs.existsSync(file) && fs.statSync(file).size > maxBytes) {
      for (let i = keep - 1; i >= 1; i--) {
        const older = `${file}.${i}`;
        const newer = `${file}.${i + 1}`;
        if (fs.existsSync(older)) fs.renameSync(older, newer);
      }
      fs.renameSync(file, `${file}.1`);
    }
  } catch {}
}
function logFilePath() {
  const dir = getLogsDir();
  ensureDir(dir);
  return path.join(dir, 'app.log');
}
function log(...args) {
  try {
    const line = new Date().toISOString() + ' ' + args.map(a => (a && a.stack) ? a.stack : String(a)).join(' ') + '\n';
    const f = logFilePath();
    rotateIfNeeded(f);
    fs.appendFileSync(f, line);
  } catch {}
}

// Errores globales (proceso principal)
process.on('unhandledRejection', (r) => { console.error('[unhandledRejection]', r); log('[unhandledRejection]', r); });
process.on('uncaughtException', (e) => { console.error('[uncaughtException]', e); log('[uncaughtException]', e); });

// === DB/AI ===
const {
  initDb,
  crearSesion, obtenerSesiones, obtenerSesionPorId,
  actualizarModeloSesion, eliminarSesionDB,
  obtenerHistorial, guardarMensajePar,
  healthCheckDb
} = require('./srv/db');
const { completarDeepseek } = require('./srv/ai');

let mainWindow;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    show: true,
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
      devTools: !isProd, // habilita DevTools solo en DEV
    },
  });

  await mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Abre DevTools automáticamente en DEV
  if (!isProd) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

app.commandLine.appendSwitch('disable-features', 'AutofillServerCommunication,AutofillExtendedPaymentsEnabled');

// Arranque con DB tolerante a fallos
app.whenReady().then(async () => {
  let dbOk = false;
  try {
    await initDb({ retries: 5, delayMs: 1500 });
    dbOk = await healthCheckDb(2000);
  } catch (e) {
    log('[DB:init]', e);
  }

  await createWindow();
  Menu.setApplicationMenu(null);

  if (!dbOk && mainWindow) {
    const msg = 'No se pudo conectar a la base de datos. El sistema seguirá funcionando de forma limitada.';
    log('[DB:warning]', msg);
    dialog.showMessageBox(mainWindow, { type: 'warning', title: 'BD no disponible', message: msg });
    mainWindow.webContents.send('ui:banner', { type: 'warn', text: msg });
  }

  // Bloqueo de atajos DevTools solo en producción
  if (isProd) {
    app.on('browser-window-created', (_e, win) => {
      win.webContents.on('before-input-event', (event, input) => {
        const devtoolsCombo = input.type === 'keyDown' && (
          input.key === 'F12' || (input.control && input.shift && (input.key === 'I' || input.key === 'i'))
        );
        if (devtoolsCombo) event.preventDefault();
      });
    });
  }

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// IPC: logs desde renderer
ipcMain.on('log:rendererError', (_ev, payload) => {
  log('[rendererError]', payload);
});

// IPC: API
ipcMain.handle('sesiones:listar', async () => obtenerSesiones());
ipcMain.handle('sesiones:obtener', async (_ev, id) => obtenerSesionPorId(id));
ipcMain.handle('sesiones:crear', async (_ev, payload) => {
  const titulo = payload?.titulo || 'Nueva conversación';
  const modelo = payload?.modelo;
  return crearSesion(titulo, modelo);
});
function normalizeModelName(n) {
  const map = { 'deepseek-r1': 'deepseek-reasoner', r1: 'deepseek-reasoner', reasoner: 'deepseek-reasoner' };
  return map[n] || n;
}
function isAllowedModel(n) {
  return n === 'deepseek-chat' || n === 'deepseek-reasoner';
}

ipcMain.handle('sesiones:updateModelo', async (_ev, { id, modelo }) => {
  const normalized = normalizeModelName(modelo);
  if (!isAllowedModel(normalized)) {
    const e = new Error(`Modelo no soportado: ${modelo}`);
    e.code = 'BAD_MODEL';
    e.status = 400;
    throw e;
  }
  return actualizarModeloSesion(id, normalized);
});

ipcMain.handle('sesiones:eliminar', async (_ev, sesionId) => eliminarSesionDB(sesionId));
ipcMain.handle('historial:obtener', async (_ev, sesionId) => obtenerHistorial(sesionId));

ipcMain.handle('chat:enviar', async (_ev, { sesionId, mensajes, modelOverride, requestId }) => {
  try {
    const respuesta = await completarDeepseek(mensajes, modelOverride, { requestId, timeoutMs: 60000 });
    const ultimoUser = mensajes[mensajes.length - 1]?.content ?? '';
    await guardarMensajePar(sesionId, ultimoUser, respuesta);
    return respuesta;
  } catch (e) {
    const err = (e && typeof e === 'object') ? e : new Error(String(e));
    const status = err.status || err.httpStatus || err.response?.status;
    const code   = err.code || err.response?.data?.error?.code;
    log('[chat:enviar:error]', { requestId, status, code, message: err.message });
    const ex = new Error(err.message || 'chat:enviar failed');
    ex.status = status;
    ex.code = code;
    ex.data = { requestId, stack: err.stack, status, code };
    throw ex;
  }
});

