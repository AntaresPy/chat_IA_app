const { app, BrowserWindow } = require('electron');
require('dotenv').config();
const path = require('path');

const { inicializarBaseDeDatos } = require('./db');

// Función principal de arranque
app.whenReady().then(async () => {
  console.log('🔄 Iniciando aplicación Electron...');
  
  try {
    console.log('🔍 Verificando estructura de base de datos...');
    await inicializarBaseDeDatos();
    console.log('✅ Base de datos lista.');
  } catch (error) {
    console.error('❌ Error al inicializar la base de datos:', error);
  }

  createWindow();
});

// Crear ventana principal
function createWindow() {
  console.log('🪟 Creando ventana principal...');
  
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));

  win.webContents.on('did-finish-load', () => {
    console.log('✅ Interfaz cargada correctamente.');
  });

  win.on('closed', () => {
    console.log('🛑 Ventana cerrada.');
  });
}

// Cierre limpio en macOS y otros entornos
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    console.log('🧹 Cerrando aplicación...');
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    console.log('🔁 Reabriendo ventana...');
    createWindow();
  }
});