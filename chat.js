const axios = require('axios');
const { guardarMensaje, obtenerHistorial, obtenerSesiones } = require('./db');
require('dotenv').config();

let sesionActiva = null;
let escribiendo = false;
let historialChat = [];

// Ajustar altura del textarea automáticamente
function ajustarAltura(elemento) {
  elemento.style.height = 'auto';
  elemento.style.height = elemento.scrollHeight + 'px';
}

// Mostrar/ocultar indicador de carga
function mostrarSpinner(mostrar) {
  const spinner = document.getElementById('loading-spinner');
  if (mostrar) {
    spinner.classList.add('active');
  } else {
    spinner.classList.remove('active');
  }
}

// Formatear fecha
function formatearFecha(fecha) {
  const ahora = new Date();
  const fechaMsg = new Date(fecha);
  
  if (fechaMsg.toDateString() === ahora.toDateString()) {
    return fechaMsg.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return fechaMsg.toLocaleDateString([], { 
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Mostrar historial en el panel
function mostrarHistorial(mensajes) {
  historialChat = mensajes; // Guardamos el historial en la variable global
  const contenedor = document.getElementById('historial-chat');
  contenedor.innerHTML = '';

  mensajes.forEach(msg => {
    const div = document.createElement('div');
    div.className = `message ${msg.rol === 'user' ? 'user' : 'bot'}`;
    
    const contenido = document.createElement('div');
    contenido.className = 'message-content';
    contenido.innerHTML = msg.contenido.replace(/\n/g, '<br>');
    
    const tiempo = document.createElement('div');
    tiempo.className = 'message-time';
    tiempo.textContent = formatearFecha(msg.timestamp || new Date());
    
    div.appendChild(contenido);
    div.appendChild(tiempo);
    contenedor.appendChild(div);
  });

  scrollToBottom();
  console.log(`🗂️ Historial cargado con ${mensajes.length} mensajes.`);
}

// Scroll al final del chat
function scrollToBottom() {
  const contenedor = document.getElementById('historial-chat');
  contenedor.scrollTop = contenedor.scrollHeight;
}

// Enviar mensaje al modelo DeepSeek
async function enviarMensaje() {
  if (escribiendo) return;

  const input = document.getElementById('input-mensaje');
  const mensaje = input.value;

  if (!mensaje.trim() || !sesionActiva) {
    console.warn('⚠️ No se puede enviar mensaje: sesión inactiva o mensaje vacío.');
    return;
  }

  input.value = '';
  ajustarAltura(input);
  escribiendo = true;

  const contenedor = document.getElementById('historial-chat');
  const fechaEnvio = new Date();

  // Agregar mensaje del usuario
  const divUser = document.createElement('div');
  divUser.className = 'message user';
  divUser.innerHTML = `
    <div class="message-content">${mensaje.replace(/\n/g, '<br>')}</div>
    <div class="message-time">${formatearFecha(fechaEnvio)}</div>
  `;
  contenedor.appendChild(divUser);
  scrollToBottom();

  try {
    // Indicador de "escribiendo..."
    const divTyping = document.createElement('div');
    divTyping.className = 'message bot typing';
    
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    
    // Agregar los puntos animados
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('span');
      typingIndicator.appendChild(dot);
    }
    
    divTyping.appendChild(typingIndicator);
    contenedor.appendChild(divTyping);
    scrollToBottom();

    // Construir el historial de mensajes para la API
    const mensajesContexto = historialChat.map(msg => ({
      role: msg.rol === 'user' ? 'user' : 'assistant',
      content: msg.contenido
    }));

    // Agregar el mensaje actual
    mensajesContexto.push({ role: 'user', content: mensaje });

    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: mensajesContexto
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Eliminar indicador de escritura
    contenedor.removeChild(divTyping);

    const respuesta = response.data.choices[0].message.content;
    const fechaRespuesta = new Date();

    // Agregar respuesta del bot
    const divBot = document.createElement('div');
    divBot.className = 'message bot';
    divBot.innerHTML = `
      <div class="message-content">${respuesta.replace(/\n/g, '<br>')}</div>
      <div class="message-time">${formatearFecha(fechaRespuesta)}</div>
    `;
    contenedor.appendChild(divBot);
    scrollToBottom();

    // Guardar mensaje en la base de datos y actualizar historial local
    await guardarMensaje(sesionActiva._id, mensaje, respuesta);
    historialChat.push(
      { rol: 'user', contenido: mensaje, timestamp: fechaEnvio },
      { rol: 'assistant', contenido: respuesta, timestamp: fechaRespuesta }
    );
    
    console.log('✅ Mensaje guardado en la base de datos.');
  } catch (error) {
    console.error('❌ Error al consultar DeepSeek o guardar mensaje:', error);
    alert('Error al enviar el mensaje. Por favor, intente nuevamente.');
  } finally {
    escribiendo = false;
  }
}

// Cargar información de la sesión
async function cargarInfoSesion(idSesion) {
  try {
    const sesiones = await obtenerSesiones();
    const sesion = sesiones.find(s => s._id.toString() === idSesion);
    if (sesion) {
      document.getElementById('titulo-sesion-chat').innerText = sesion.titulo;
    }
  } catch (error) {
    console.error('Error al cargar información de la sesión:', error);
  }
}

// Inicializar
window.onload = async () => {
  console.log('💬 Cargando vista de conversación...');
  mostrarSpinner(true);

  const idSesion = localStorage.getItem('sesionActiva');
  if (!idSesion) {
    alert('No hay sesión activa. Redirigiendo...');
    window.location.href = 'index.html';
    return;
  }

  try {
    sesionActiva = { _id: idSesion };
    await cargarInfoSesion(idSesion);
    
    const historial = await obtenerHistorial(idSesion);
    mostrarHistorial(historial);

    const input = document.getElementById('input-mensaje');
    
    // Configurar evento Enter para enviar mensaje
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        enviarMensaje();
      }
    });

    // Configurar ajuste automático de altura
    input.addEventListener('input', () => {
      ajustarAltura(input);
    });
  } catch (error) {
    console.error('Error al cargar el chat:', error);
    alert('Error al cargar la conversación. Por favor, intente nuevamente.');
  } finally {
    mostrarSpinner(false);
  }
};

// Volver a la vista de sesiones
function volverInicio() {
  localStorage.removeItem('sesionActiva');
  window.location.href = 'index.html';
}