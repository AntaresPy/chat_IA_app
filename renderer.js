// renderer.js (para index.html)
(function () {
  const lista = document.getElementById('listaSesiones');
  const btnNueva = document.getElementById('btnNueva');

  // Modal elements
  const modal = document.getElementById('modalNueva');
  const btnCerrarModal = document.getElementById('btnCerrarModal');
  const btnCancelar = document.getElementById('btnCancelar');
  const btnCrear = document.getElementById('btnCrearSesion');
  const inputTitulo = document.getElementById('tituloSesion');
  const selectModelo = document.getElementById('modeloSesion');

  let lastFocused = null;

  // Reporte global de errores
  window.addEventListener('error', (e) => {
    try { window.telemetry?.error({ type: 'error', message: e.message, stack: e.error?.stack }); } catch {}
  });
  window.addEventListener('unhandledrejection', (e) => {
    try { window.telemetry?.error({ type: 'unhandledrejection', reason: String(e.reason) }); } catch {}
  });

  // Banner helpers + SweetAlert
  function showBanner(kind, text, autoHideMs) {
    const bar = document.getElementById('errorBanner');
    if (!bar) return;

    bar.className = 'banner';
    const kindClass = kind === 'err' ? 'is-err' : kind === 'warn' ? 'is-warn' : 'is-info';
    bar.classList.add(kindClass);
    bar.textContent = text || '';
    if (text && text.trim()) {
      bar.classList.add('is-visible');
    } else {
      bar.classList.remove('is-visible');
    }

    if (autoHideMs && Number.isFinite(autoHideMs)) {
      window.clearTimeout(bar.__hideTimer__);
      bar.__hideTimer__ = window.setTimeout(() => hideBanner(), autoHideMs);
    }

    // SweetAlert (si está disponible)
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

  // Banner remoto
  window.telemetry?.onBanner?.(({ type, text }) => {
    showBanner(type === 'warn' ? 'warn' : 'info', text);
  });

  // Guardas de foco en modal
  [inputTitulo, selectModelo].forEach(el => {
    if (!el) return;
    el.addEventListener('keydown', (e) => e.stopPropagation());
    el.addEventListener('keypress', (e) => e.stopPropagation());
    el.addEventListener('keyup', (e) => e.stopPropagation());
  });

  function fmtFecha(d) { try { return new Date(d).toLocaleString(); } catch { return ''; } }
  function preview(text, n = 90) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n - 1) + '…' : t;
  }

  async function renderItem(s) {
    let lastMsg = null;
    try {
      const hist = await window.api.obtenerHistorial(s._id);
      if (hist && hist.length) {
        lastMsg = [...hist].reverse().find(m => m.rol === 'assistant') || hist[hist.length - 1];
      }
    } catch {}

    const li = document.createElement('li');
    li.className = 'item';

    const title = document.createElement('h3');
    title.className = 'item_title';
    title.textContent = s.titulo;

    const actions = document.createElement('div');
    actions.className = 'item_actions';

    const btnDel = document.createElement('button');
    btnDel.textContent = '🗑️';
    btnDel.className = 'danger';
    btnDel.title = 'Eliminar conversación';

    li.addEventListener('click', (e) => {
      const tgt = e.target;
      if (tgt instanceof Element && tgt.closest('.item_actions')) return;
      const id = encodeURIComponent(String(s._id));
      const t  = encodeURIComponent(String(s.titulo || ''));
      const m  = encodeURIComponent(String(s.modelo || ''));
      window.location.href = `./chat.html?sid=${id}&t=${t}&m=${m}`;
    });

    btnDel.onclick = async () => {
      const proceed = window.Swal
        ? (await Swal.fire({ icon:'question', title:'¿Eliminar?', text:`Eliminar la sesión "${s.titulo}"`, showCancelButton:true, confirmButtonText:'Sí, eliminar', cancelButtonText:'Cancelar', heightAuto:false })).isConfirmed
        : confirm(`Eliminar la sesión "${s.titulo}"?`);
      if (!proceed) return;
      await window.api.eliminarSesion(s._id);
      await cargarSesiones();
    };

    actions.appendChild(btnDel);

    const meta = document.createElement('div');
    meta.className = 'item_meta';

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = s.modelo || 'deepseek-chat';

    const info = document.createElement('span');
    const txtPrev = preview(lastMsg?.contenido || '—');
    const when = lastMsg?.timestamp ? fmtFecha(lastMsg.timestamp) : '';
    info.textContent = when ? `${txtPrev} · ${when}` : txtPrev;

    meta.appendChild(badge);
    meta.appendChild(info);

    li.appendChild(title);
    li.appendChild(actions);
    li.appendChild(meta);

    return li;
  }

  async function cargarSesiones() {
    try {
      const sesiones = await window.api.listarSesiones();
      lista.innerHTML = '';
      const frag = document.createDocumentFragment();
      const items = await Promise.all(sesiones.map(renderItem));
      for (const it of items) frag.appendChild(it);
      lista.appendChild(frag);
    } catch (err) {
      window.telemetry?.error({ type: 'ipc', op: 'listarSesiones', message: String(err) });
      showBanner('err', 'No se pudo cargar la lista de conversaciones. Verificá la conexión con la BD.');
    }
  }

  // Modal
  function openModal() {
    lastFocused = document.activeElement;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => {
      if (inputTitulo) { inputTitulo.removeAttribute('disabled'); inputTitulo.removeAttribute('readonly'); inputTitulo.focus(); inputTitulo.select(); }
    }, 30);
  }
  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    inputTitulo.value = '';
    if (selectModelo) selectModelo.value = 'deepseek-chat';
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }
  modal && modal.addEventListener('click', (e) => {
    const isBackdrop = e.target instanceof HTMLElement && e.target.dataset.close === 'true';
    if (isBackdrop) closeModal();
  });
  btnNueva && btnNueva.addEventListener('click', openModal);
  btnCerrarModal && btnCerrarModal.addEventListener('click', closeModal);
  btnCancelar && btnCancelar.addEventListener('click', closeModal);

  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
    if (e.key === 'Enter' && (e.target === inputTitulo || e.target === selectModelo)) {
      e.preventDefault();
      crearSesionDesdeModal();
    }
  });
  btnCrear.addEventListener('click', crearSesionDesdeModal);

  async function crearSesionDesdeModal() {
    const titulo = (inputTitulo.value || '').trim() || 'Nueva conversación';
    const modelo = (selectModelo?.value || 'deepseek-chat');
    btnCrear.disabled = true;
    try {
      const sesion = await window.api.crearSesion({ titulo, modelo });
      await cargarSesiones();
      const id = encodeURIComponent(String(sesion._id));
      const t  = encodeURIComponent(String(sesion.titulo || ''));
      const m  = encodeURIComponent(String(sesion.modelo || modelo || ''));
      window.location.href = `./chat.html?sid=${id}&t=${t}&m=${m}`;
    } catch (e) {
      showBanner('err', 'No se pudo crear la conversación.');
    } finally {
      btnCrear.disabled = false;
      closeModal();
    }
  }

  window.addEventListener('DOMContentLoaded', cargarSesiones);
})();
