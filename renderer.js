const axios = require('axios');
const { guardarMensaje, crearSesion, obtenerSesiones, obtenerHistorial } = require('./db');
require('dotenv').config();

let sesionActiva = null;

// Mostrar modal de nueva sesión
function crearNuevaSesion() {
  const modal = document.getElementById('modal-nueva-sesion');
  const input = document.getElementById('titulo-nueva-sesion');
  modal.classList.add('active');
  input.value = '';
  input.focus();
}

// Cancelar creación de nueva sesión
function cancelarNuevaSesion() {
  const modal = document.getElementById('modal-nueva-sesion');
  modal.classList.remove('active');
}

// Confirmar creación de nueva sesión
async function confirmarNuevaSesion() {
  const input = document.getElementById('titulo-nueva-sesion');
  const titulo = input.value.trim();
  
  if (!titulo) {
    alert('Por favor, ingrese un título para la conversación');
    return;
  }

  try {
    mostrarSpinner(true);
    const sesion = await crearSesion(titulo);
    console.log(`🆕 Sesión creada: "${titulo}"`);
    
    // Redirigir a la pantalla de chat
    localStorage.setItem('sesionActiva', sesion._id);
    window.location.href = 'chat.html';
  } catch (error) {
    console.error('Error al crear sesión:', error);
    alert('Error al crear la sesión. Por favor, intente nuevamente.');
  } finally {
    mostrarSpinner(false);
    cancelarNuevaSesion();
  }
}

// Mostrar/ocultar spinner de carga
function mostrarSpinner(mostrar) {
  const spinner = document.getElementById('loading-spinner');
  if (mostrar) {
    spinner.classList.add('active');
  } else {
    spinner.classList.remove('active');
  }
}

// Eliminar una sesión
async function eliminarSesion(id, titulo) {
  if (!confirm(`¿Está seguro de eliminar la conversación "${titulo}"?`)) {
    return;
  }

  try {
    mostrarSpinner(true);
    await eliminarSesionDB(id);
    await cargarSesiones();
    console.log(`🗑️ Sesión eliminada: "${titulo}"`);
  } catch (error) {
    console.error('Error al eliminar sesión:', error);
    alert('Error al eliminar la sesión. Por favor, intente nuevamente.');
  } finally {
    mostrarSpinner(false);
  }
}

// Abrir una sesión existente
function abrirSesion(id) {
  localStorage.setItem('sesionActiva', id);
  window.location.href = 'chat.html';
}

// Cargar lista de sesiones
async function cargarSesiones() {
  console.log('📂 Cargando lista de sesiones...');
  mostrarSpinner(true);
  
  try {
    const sesiones = await obtenerSesiones();
    const lista = document.getElementById('lista-sesiones');
    lista.innerHTML = '';

    sesiones.forEach(s => {
      const chatItem = document.createElement('div');
      chatItem.className = 'chat-item';
      
      const chatInfo = document.createElement('div');
      chatInfo.className = 'chat-info';
      chatInfo.onclick = () => abrirSesion(s._id);
      
      const titulo = document.createElement('div');
      titulo.className = 'chat-title';
      titulo.textContent = s.titulo;
      
      const fecha = document.createElement('div');
      fecha.className = 'chat-date';
      fecha.textContent = new Date(s.fecha_creacion).toLocaleDateString();
      
      chatInfo.appendChild(titulo);
      chatInfo.appendChild(fecha);
      
      const actions = document.createElement('div');
      actions.className = 'chat-actions';
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-delete';
      deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        eliminarSesion(s._id, s.titulo);
      };
      
      actions.appendChild(deleteBtn);
      chatItem.appendChild(chatInfo);
      chatItem.appendChild(actions);
      lista.appendChild(chatItem);
    });

    console.log(`✅ ${sesiones.length} sesiones cargadas.`);
  } catch (error) {
    console.error('Error al cargar sesiones:', error);
    alert('Error al cargar las sesiones. Por favor, recargue la página.');
  } finally {
    mostrarSpinner(false);
  }
}

// Inicializar
window.onload = () => {
  console.log('🚀 Inicializando aplicación...');
  cargarSesiones();
  
  // Manejar tecla Enter en el modal
  document.getElementById('titulo-nueva-sesion').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      confirmarNuevaSesion();
    }
  });
};

// Enviar mensaje al modelo DeepSeek
async function enviarMensaje() {
  const input = document.getElementById('input-mensaje');
  const mensaje = input.value.trim();

  if (!mensaje || !sesionActiva) {
    console.warn('⚠️ No se puede enviar mensaje: sesión inactiva o mensaje vacío.');
    return;
  }

  console.log(`📤 Enviando mensaje: "${mensaje}"`);
  input.value = '';

  const contenedor = document.getElementById('historial-chat');
  const divUser = document.createElement('div');
  divUser.innerText = `🧑 ${mensaje}`;
  contenedor.appendChild(divUser);

  try {
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: mensaje }]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const respuesta = response.data.choices[0].message.content;
    const divBot = document.createElement('div');
    divBot.innerText = `🤖 ${respuesta}`;
    contenedor.appendChild(divBot);

    console.log(`📥 Respuesta recibida: "${respuesta}"`);

    await guardarMensaje(sesionActiva._id, mensaje, respuesta);
    console.log('💾 Mensaje guardado en la base de datos.');
  } catch (error) {
    console.error('❌ Error al consultar DeepSeek o guardar mensaje:', error);
  }
}

// Inicializar
window.onload = () => {
  console.log('🚀 Inicializando interfaz...');
  cargarSesiones();
};