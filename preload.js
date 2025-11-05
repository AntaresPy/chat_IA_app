// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Sesiones
  listarSesiones: () => ipcRenderer.invoke('sesiones:listar'),
  crearSesion: (titulo) => ipcRenderer.invoke('sesiones:crear', titulo),
  eliminarSesion: (id) => ipcRenderer.invoke('sesiones:eliminar', id),

  // Historial
  obtenerHistorial: (sesionId) => ipcRenderer.invoke('historial:obtener', sesionId),

  // Chat
  enviarChat: (payload) => ipcRenderer.invoke('chat:enviar', payload),
});
