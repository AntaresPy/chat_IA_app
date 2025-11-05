// chat.js (para chat.html)
(function () {
  const qs = new URLSearchParams(window.location.search);
  const sesionId = qs.get('sid');

  const btnVolver = document.getElementById('btnVolver');
  const tituloSesion = document.getElementById('tituloSesion');
  const historial = document.getElementById('historial');
  const txt = document.getElementById('txt');
  const btnEnviar = document.getElementById('btnEnviar');

  if (!sesionId) {
    alert('Falta el parámetro sid.');
    window.location.href = './index.html';
    return;
  }

  btnVolver.onclick = () => (window.location.href = './index.html');

  function appendMsg(rol, contenido) {
    const wrap = document.createElement('div');
    wrap.className = `msg ${rol === 'assistant' ? 'assistant' : 'user'}`;

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = contenido;

    wrap.appendChild(bubble);
    historial.appendChild(wrap);
    historial.scrollTop = historial.scrollHeight;
  }

  function autoGrow(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 220) + 'px';
  }

  async function cargarHistorial() {
    const items = await window.api.obtenerHistorial(sesionId);
    historial.innerHTML = '';
    items.forEach((m) => appendMsg(m.rol, m.contenido));
    // opcional: mostrar título en barra izquierda leyendo primer mensaje user
    const primerUser = items.find((m) => m.rol === 'user');
    if (primerUser) tituloSesion.textContent = primerUser.contenido.slice(0, 42);
  }

  async function enviar() {
    const contenido = (txt.value || '').trim();
    if (!contenido) return;
    txt.value = '';
    autoGrow(txt);
    appendMsg('user', contenido);

    // Construir contexto: system + historial truncado + nuevo user
    const historialDocs = await window.api.obtenerHistorial(sesionId);
    const mensajesPrev = historialDocs.map((d) => ({
      role: d.rol === 'assistant' ? 'assistant' : 'user',
      content: d.contenido,
    }));

    const mensajes = [
      {
        role: 'system',
        content:
          'Eres un asistente útil y conciso. Responde de manera clara en español.',
      },
      ...mensajesPrev.slice(-10), // último contexto (ajustable)
      { role: 'user', content: contenido },
    ];

    // indicador "escribiendo..."
    const typing = document.createElement('div');
    typing.className = 'msg assistant';
    typing.innerHTML = '<div class="bubble typing">...</div>';
    historial.appendChild(typing);
    historial.scrollTop = historial.scrollHeight;

    try {
      const respuesta = await window.api.enviarChat({ sesionId, mensajes });
      typing.remove();
      appendMsg('assistant', respuesta);
    } catch (err) {
      typing.remove();
      console.error(err);
      appendMsg(
        'assistant',
        'Lo siento, ocurrió un error al procesar tu mensaje.'
      );
    }
  }

  txt.addEventListener('input', () => autoGrow(txt));
  txt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  });

  btnEnviar.addEventListener('click', enviar);

  window.addEventListener('DOMContentLoaded', cargarHistorial);
})();
