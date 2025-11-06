// chat.js (para chat.html)
(function () {
  const qs = new URLSearchParams(window.location.search);
  const sesionId = qs.get('sid');

  // Topbar
  const btnVolver = document.getElementById('btnVolver');
  const tituloSesion = document.getElementById('tituloSesion');
  const selectModelo = document.getElementById('selectModelo');
  const btnDescargar = document.getElementById('btnDescargar');

  let sessionModel = null;

  // Pre-carga de UI con datos de la URL (mejor UX al abrir)
  const tParam = qs.get('t');
  const mParam = qs.get('m');
  if (tParam && tParam.trim()) tituloSesion.textContent = decodeURIComponent(tParam);
  if (mParam && mParam.trim()) {
    sessionModel = decodeURIComponent(mParam);
    // si coincide con alguna opción, refléjalo en el select
    const opt = Array.from(selectModelo.options).some(o => o.value === sessionModel);
    if (opt) selectModelo.value = sessionModel;
  }

  // Modal descarga
  const modal = document.getElementById('modalDescarga');
  const btnCerrarModalDesc = document.getElementById('btnCerrarModalDesc');
  const btnCancelarDesc = document.getElementById('btnCancelarDesc');
  const btnConfirmarDesc = document.getElementById('btnConfirmarDesc');
  const chkMeta = document.getElementById('chkMeta');

  // Chat UI
  const historial = document.getElementById('historial');
  const txt = document.getElementById('txt');
  const btnEnviar = document.getElementById('btnEnviar');

  if (!sesionId) {
    alert('Falta el parámetro sid.');
    window.location.href = './index.html';
    return;
  }

  //let sessionModel = null;
  let currentSesionDoc = null;

  btnVolver.onclick = () => (window.location.href = './index.html');

  // ===== util =====
  function scrollAlFinal() { historial.scrollTop = historial.scrollHeight; }

  function addCopyButton(bubble) {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'copy-btn'; btn.textContent = 'Copiar';
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const text = bubble.textContent || '';
      try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
        else { const ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }
        const old = btn.textContent; btn.textContent = 'Copiado'; setTimeout(() => (btn.textContent = old), 1200);
      } catch { const old = btn.textContent; btn.textContent = 'Error'; setTimeout(() => (btn.textContent = old), 1200); }
    });
    bubble.appendChild(btn);
  }

  function appendMsg(rol, contenido) {
    const wrap = document.createElement('div');
    wrap.className = `msg ${rol === 'assistant' ? 'assistant' : 'user'}`;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = contenido;
    wrap.appendChild(bubble);
    historial.appendChild(wrap);
    scrollAlFinal();
    if (rol === 'assistant' && contenido) addCopyButton(bubble);
    return bubble;
  }

  function appendTyping() {
    const wrap = document.createElement('div');
    wrap.className = 'msg assistant';
    const bubble = document.createElement('div');
    bubble.className = 'bubble typing';
    bubble.innerHTML = `<span class="typing-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>`;
    wrap.appendChild(bubble);
    historial.appendChild(wrap);
    scrollAlFinal();
    return wrap;
  }

  function autoGrow(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 220) + 'px'; }

  // ===== data =====
  async function cargarSesion() {
    const sesion = await window.api.obtenerSesion(sesionId);
    currentSesionDoc = sesion;
    if (sesion?.titulo) tituloSesion.textContent = sesion.titulo;
    sessionModel = sesion?.modelo || null;
    if (sessionModel) selectModelo.value = sessionModel;
  }

  async function cargarHistorial() {
    const items = await window.api.obtenerHistorial(sesionId);
    historial.innerHTML = '';
    items.forEach((m) => appendMsg(m.rol, m.contenido));

    // Fallback de título si no vino de DB
    if (tituloSesion.textContent === 'Chat') {
      const primerUser = items.find((m) => m.rol === 'user');
      if (primerUser) tituloSesion.textContent = primerUser.contenido.slice(0, 42);
    }
  }

  // ===== typewriter =====
  function typeWriter(targetBubble, fullText, speed = 15) {
    return new Promise((resolve) => {
      targetBubble.textContent = '';
      let i = 0;
      const tick = () => {
        const chunk = fullText.slice(i, i + 3);
        targetBubble.textContent += chunk;
        i += chunk.length;
        scrollAlFinal();
        if (i < fullText.length) setTimeout(tick, speed);
        else resolve();
      };
      tick();
    });
  }

  // ===== enviar =====
  let enviando = false;

  async function enviar() {
    if (enviando) return;
    const contenido = (txt.value || '').trim();
    if (!contenido) return;

    enviando = true; btnEnviar.disabled = true;

    txt.value = ''; autoGrow(txt);
    appendMsg('user', contenido);

    const historialDocs = await window.api.obtenerHistorial(sesionId);
    const mensajesPrev = historialDocs.map((d) => ({ role: d.rol === 'assistant' ? 'assistant' : 'user', content: d.contenido }));

    const mensajes = [
      { role: 'system', content: 'Eres un asistente útil y conciso. Responde de manera clara en español.' },
      ...mensajesPrev.slice(-10),
      { role: 'user', content: contenido },
    ];

    const typingNode = appendTyping();

    try {
      const respuesta = await window.api.enviarChat({
        sesionId,
        mensajes,
        modelOverride: sessionModel || undefined,
      });
      typingNode.remove();
      const bubble = appendMsg('assistant', '');
      await typeWriter(bubble, respuesta, 15);
      if (!bubble.querySelector('.copy-btn')) addCopyButton(bubble);

    } catch (err) {
      typingNode.remove();
      console.error(err);
      appendMsg('assistant', 'Lo siento, ocurrió un error al procesar tu mensaje.');
    } finally {
      enviando = false; btnEnviar.disabled = false;
    }
  }

  // ===== selector de modelo =====
  selectModelo.addEventListener('change', async () => {
    const nuevo = selectModelo.value;
    try {
      await window.api.actualizarModelo(sesionId, nuevo);
      sessionModel = nuevo;
    } catch (e) {
      console.error('No se pudo actualizar el modelo:', e);
      // revertir UI
      selectModelo.value = sessionModel || 'deepseek-chat';
    }
  });

  // ===== descarga =====
  function openDownloadModal() { modal.classList.add('is-open'); modal.setAttribute('aria-hidden', 'false'); }
  function closeDownloadModal() { modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true'); }

  btnDescargar.addEventListener('click', openDownloadModal);
  btnCerrarModalDesc.addEventListener('click', closeDownloadModal);
  btnCancelarDesc.addEventListener('click', closeDownloadModal);
  modal.addEventListener('click', (e) => {
    const isBackdrop = e.target instanceof HTMLElement && e.target.dataset.close === 'true';
    if (isBackdrop) closeDownloadModal();
  });

  btnConfirmarDesc.addEventListener('click', async () => {
    try {
      // formato elegido
      const fmt = Array.from(modal.querySelectorAll('input[name="fmt"]')).find(i => i.checked)?.value || 'txt';
      const includeMeta = !!chkMeta.checked;

      const sesion = currentSesionDoc || await window.api.obtenerSesion(sesionId);
      const items = await window.api.obtenerHistorial(sesionId);

      const now = new Date();
      const safeTitle = (sesion?.titulo || 'chat').replace(/[^\p{L}\p{N}\-_ ]/gu, '').trim().replace(/\s+/g, '_').slice(0, 60);
      const stamp = now.toISOString().replace(/[:.]/g, '-');

      if (fmt === 'json') {
        const payload = {
          export_format: 'deepseek-electron-chat@v1',
          sesion: {
            _id: String(sesion?._id || sesionId),
            titulo: sesion?.titulo || 'Chat',
            modelo: sesion?.modelo || sessionModel || 'deepseek-chat',
            fecha_creacion: sesion?.fecha_creacion || null,
          },
          mensajes: items.map(m => ({ rol: m.rol, contenido: m.contenido, timestamp: m.timestamp })),
          meta: includeMeta ? { exportado_en: now.toISOString(), app: 'DeepSeek Chat (Electron)' } : undefined,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${safeTitle}_${stamp}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      } else {
        // TXT
        const lines = [];
        if (includeMeta) {
          lines.push(`# ${sesion?.titulo || 'Chat'}`);
          lines.push(`Modelo: ${sesion?.modelo || sessionModel || 'deepseek-chat'}`);
          lines.push(`Exportado: ${now.toLocaleString()}`);
          lines.push(''); lines.push('---'); lines.push('');
        }
        for (const m of items) {
          lines.push(`[${m.rol}] ${m.contenido}`);
        }
        const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${safeTitle}_${stamp}.txt`;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } finally {
      closeDownloadModal();
    }
  });

  // ===== wiring =====
  txt.addEventListener('input', () => autoGrow(txt));
  txt.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } });
  btnEnviar.addEventListener('click', enviar);

  window.addEventListener('DOMContentLoaded', async () => {
    await cargarSesion();
    await cargarHistorial();
  });
})();
