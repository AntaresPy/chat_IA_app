// preload.js
(() => {
  // Evita doble inicialización si el preload llegara a evaluarse dos veces
  if (globalThis.__STAR_PRELOAD_INIT__) return;
  globalThis.__STAR_PRELOAD_INIT__ = true;

  const { contextBridge, ipcRenderer } = require('electron');

  // API de la app expuesta al renderer (index.html / chat.html)
  contextBridge.exposeInMainWorld('api', {
    // Sesiones
    listarSesiones: () => ipcRenderer.invoke('sesiones:listar'),
    crearSesion: (payload) => ipcRenderer.invoke('sesiones:crear', payload),
    obtenerSesion: (id) => ipcRenderer.invoke('sesiones:obtener', id),
    actualizarModelo: (id, modelo) => ipcRenderer.invoke('sesiones:updateModelo', { id, modelo }),
    eliminarSesion: (id) => ipcRenderer.invoke('sesiones:eliminar', id),

    // Historial
    obtenerHistorial: (sesionId) => ipcRenderer.invoke('historial:obtener', sesionId),

    // Chat
    enviarChat: (payload) => ipcRenderer.invoke('chat:enviar', payload),
  });

  // Telemetría / banners
  contextBridge.exposeInMainWorld('telemetry', {
    error: (payload) => ipcRenderer.send('log:rendererError', payload),
    onBanner: (cb) => ipcRenderer.on('ui:banner', (_ev, data) => cb?.(data)),
  });
})();
