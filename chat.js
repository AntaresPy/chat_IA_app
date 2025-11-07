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

  // ===== helpers de errores/UX =====
  function showBanner(kind, text, autoHideMs) {
    const bar = document.getElementById('errorBanner');
    if (!bar) return;

    bar.className = 'banner';
    const kindClass = kind === 'err' ? 'is-err' : kind === 'warn' ? 'is-warn' : 'is-info';
    bar.classList.add(kindClass);
    bar.textContent = text || '';
    if (text && text.trim()) bar.classList.add('is-visible'); else bar.classList.remove('is-visible');

    if (autoHideMs && Number.isFinite(autoHideMs)) {
      window.clearTimeout(bar.__hideTimer__);
      bar.__hideTimer__ = window.setTimeout(() => hideBanner(), autoHideMs);
    }

    if (window.Swal && text) {
      Swal.fire({
        icon: kind === 'err' ? 'error' : kind === 'warn' ? 'warning' : 'info',
        title: kind === 'err' ? 'Ocurrió un error' : kind === 'warn' ? 'Atención' : 'Aviso',
        text,
        confirmButtonText: 'Entendido',
        heightAuto: false,
      });
    }
  }
  function hideBanner() {
    const bar = document.getElementById('errorBanner');
    if (!bar) return;
    bar.className = 'banner';
    bar.textContent = '';
    if (bar.__hideTimer__) { window.clearTimeout(bar.__hideTimer__); bar.__hideTimer__ = undefined; }
  }

  function withTimeout(promise, ms, label = 'operation') {
    let to;
    const timeout = new Promise((_, rej) => {
      to = setTimeout(() => rej(new Error(`timeout:${label}:${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(to));
  }
  function newRequestId() {
    try { return crypto.randomUUID(); } catch { return 'req_' + Math.random().toString(36).slice(2); }
  }
  function normalizeIpcError(err) {
    const base = { message: '', status: undefined, code: undefined, requestId: undefined, stack: undefined };
    if (!err) return { ...base, message: 'Error desconocido' };
    if (typeof err === 'string') return { ...base, message: err };
    const any = err;
    const data = any.data || any.cause || {};
    return {
      message: any.message || String(any),
      status: any.status ?? data.status,
      code: any.code ?? data.code,
      requestId: any.requestId ?? data.requestId,
      stack: any.stack || data.stack,
    };
  }
  function appendDiagBubble(diag) {
    const { message, status, code, requestId } = diag;
    const lines = [];
    lines.push('⚠️ Hubo un problema al consultar la IA.');
    if (status)   lines.push(`• status: ${status}`);
    if (code)     lines.push(`• code: ${code}`);
    if (requestId)lines.push(`• id: ${requestId}`);
    if (message)  lines.push(`• msg: ${message}`);
    appendMsg('assistant', lines.join('\n'));
  }

  // Precarga de título/modelo
  const tParam = qs.get('t');
  const mParam = qs.get('m');
  if (tParam && tParam.trim()) tituloSesion.textContent = decodeURIComponent(tParam);
  if (mParam && mParam.trim()) {
    sessionModel = decodeURIComponent(mParam);
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
    showBanner('err', 'Falta el parámetro "sid".');
    window.location.href = './index.html';
    return;
  }

  let currentSesionDoc = null;
  btnVolver.onclick = () => (window.location.href = './index.html');

  function scrollAlFinal() { historial.scrollTop = historial.scrollHeight; }

  function escapeHtml(s = '') {
    return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function buildFormattedHtmlFromText(text = '') {
    const fence = /(```|''')([\w-]+)?\n([\s\S]*?)\1/g;
    let html = '';
    let last = 0;
    let m;

    while ((m = fence.exec(text))) {
      if (m.index > last) {
        const chunk = text.slice(last, m.index);
        html += `<p class="p">${escapeHtml(chunk).replace(/\n{2,}/g, '\n\n').replace(/\n/g,'<br>')}</p>`;
      }
      const lang = (m[2] || '').trim();
      const code = m[3] || '';
      html += `
      <div class="code-block">
        <div class="code-head">
          <span class="lang">${escapeHtml(lang || 'code')}</span>
          <button type="button" class="copy-code">Copiar</button>
        </div>
        <pre><code class="${escapeHtml(lang)}">${escapeHtml(code)}</code></pre>
      </div>`;
      last = fence.lastIndex;
    }

    if (last < text.length) {
      const chunk = text.slice(last);
      html += `<p class="p">${escapeHtml(chunk).replace(/\n{2,}/g, '\n\n').replace(/\n/g,'<br>')}</p>`;
    }
    return html;
  }

  function formatAssistantBubble(bubble) {
    const raw = bubble.textContent || '';
    const html = buildFormattedHtmlFromText(raw);
    bubble.innerHTML = html;
    bubble.querySelectorAll('.copy-code').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const pre = btn.closest('.code-block')?.querySelector('pre');
        const text = pre ? pre.textContent : '';
        try {
          if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
          else { const ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }
          const old = btn.textContent; btn.textContent = 'Copiado'; setTimeout(() => (btn.textContent = old), 1200);
        } catch {
          const old = btn.textContent; btn.textContent = 'Error'; setTimeout(() => (btn.textContent = old), 1200);
        }
      });
    });
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
    if (rol === 'assistant' && contenido) {
      formatAssistantBubble(bubble);
    }
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
    try {
      const sesion = await withTimeout(window.api.obtenerSesion(sesionId), 10000, 'obtenerSesion');
      currentSesionDoc = sesion;
      if (sesion?.titulo) tituloSesion.textContent = sesion.titulo;
      sessionModel = sesion?.modelo || null;
      if (sessionModel) selectModelo.value = sessionModel;
    } catch (e) {
      const diag = normalizeIpcError(e);
      window.telemetry?.error({ type: 'ipc', op: 'obtenerSesion', ...diag });
      showBanner('err', 'No se pudo cargar la sesión. Verificá la conexión a la BD.');
    }
  }

  async function cargarHistorial() {
    try {
      const items = await withTimeout(window.api.obtenerHistorial(sesionId), 15000, 'obtenerHistorial');
      historial.innerHTML = '';
      items.forEach((m) => appendMsg(m.rol, m.contenido));
    } catch (e) {
      const diag = normalizeIpcError(e);
      window.telemetry?.error({ type: 'ipc', op: 'obtenerHistorial', ...diag });
      showBanner('err', 'No se pudo cargar el historial. Intentá recargar la página.');
      return;
    }

    if (tituloSesion.textContent === 'Chat') {
      const items = Array.from(historial.querySelectorAll('.msg.user .bubble')).map(b => ({ rol:'user', contenido:b.textContent||'' }));
      const primerUser = items[0];
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

    let historialDocs = [];
    try {
      historialDocs = await withTimeout(window.api.obtenerHistorial(sesionId), 10000, 'obtenerHistorial');
    } catch (e) {
      const diag = normalizeIpcError(e);
      window.telemetry?.error({ type: 'ipc', op: 'obtenerHistorial(pre-envio)', ...diag });
      showBanner('err', 'No se pudo preparar el contexto del chat.');
      enviando = false; btnEnviar.disabled = false;
      return;
    }

    const mensajesPrev = historialDocs.map((d) => ({ role: d.rol === 'assistant' ? 'assistant' : 'user', content: d.contenido }));
    const mensajes = [
      { role: 'system', content: 'Eres un asistente útil y conciso. Responde de manera clara en español.' },
      ...mensajesPrev.slice(-10),
      { role: 'user', content: contenido },
    ];

    const typingNode = appendTyping();
    const requestId = newRequestId();

    try {
      const respuesta = await withTimeout(window.api.enviarChat({
        sesionId,
        mensajes,
        modelOverride: sessionModel || undefined,
        requestId,
      }), 60000, 'enviarChat');

      typingNode.remove();
      const bubble = appendMsg('assistant', '');
      await typeWriter(bubble, respuesta, 15);
      formatAssistantBubble(bubble);

    } catch (err) {
      typingNode.remove();
      const diag = normalizeIpcError(err);
      window.telemetry?.error({ type: 'ipc', op: 'enviarChat', ...diag, requestId });

      const bannerText = diag.status
        ? `La IA respondió con error (status ${diag.status}).`
        : (String(diag.message || '').startsWith('timeout:') ? 'La solicitud a la IA excedió el tiempo de espera.' : 'No se pudo completar la solicitud a la IA.');
      showBanner(diag.status ? 'warn' : 'err', bannerText);

      // Modal con detalles (si SweetAlert está)
      if (window.Swal) {
        const html = `
          <div style="text-align:left;font-size:13px;line-height:1.35">
            <div><strong>requestId:</strong> ${escapeHtml(diag.requestId || '')}</div>
            <div><strong>status:</strong> ${escapeHtml(String(diag.status ?? ''))}</div>
            <div><strong>code:</strong> ${escapeHtml(String(diag.code ?? ''))}</div>
            <div><strong>mensaje:</strong> ${escapeHtml(String(diag.message || ''))}</div>
          </div>`;
        Swal.fire({ icon:'error', title:'Error al consultar la IA', html, confirmButtonText:'Cerrar', heightAuto:false });
      }

      appendDiagBubble({ ...diag, requestId });
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
      window.telemetry?.error({ type:'ipc', op:'actualizarModelo', message:String(e) });
      showBanner('err', 'No se pudo actualizar el modelo.');
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
        const lines = [];
        if (includeMeta) {
          lines.push(`# ${sesion?.titulo || 'Chat'}`);
          lines.push(`Modelo: ${sesion?.modelo || sessionModel || 'deepseek-chat'}`);
          lines.push(`Exportado: ${now.toLocaleString()}`);
          lines.push(''); lines.push('---'); lines.push('');
        }
        for (const m of items) lines.push(`[${m.rol}] ${m.contenido}`);
        const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${safeTitle}_${stamp}.txt`;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } catch (e) {
      showBanner('err', 'No se pudo exportar la conversación.');
    } finally {
      closeDownloadModal();
    }
  });

  // Wiring
  txt.addEventListener('input', () => autoGrow(txt));
  txt.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } });
  btnEnviar.addEventListener('click', enviar);

  window.addEventListener('DOMContentLoaded', async () => {
    await cargarSesion();
    await cargarHistorial();
  });
})();
