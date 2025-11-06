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

  // Evita que atajos globales o el menubar “roben” el teclado cuando estás tipeando en el modal
  [inputTitulo, selectModelo].forEach(el => {
    if (!el) return;
    el.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });
    el.addEventListener('keypress', (e) => {
      e.stopPropagation();
    });
    el.addEventListener('keyup', (e) => {
      e.stopPropagation();
    });
  });

  function fmtFecha(d) {
    try { return new Date(d).toLocaleString(); } catch { return ''; }
  }
  function preview(text, n = 90) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n - 1) + '…' : t;
  }

  async function renderItem(s) {
    // obtener historial y última respuesta (mejor la última del assistant; si no, la última en general)
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

    // UN SOLO CLICK en toda la tarjeta (excepto en el área de acciones)
    li.addEventListener('click', (e) => {
      if (e.target.closest('.item_actions')) return; // no abrir si clickean 🗑️
      const id = encodeURIComponent(String(s._id));
      const t  = encodeURIComponent(String(s.titulo || ''));
      const m  = encodeURIComponent(String(s.modelo || ''));
      window.location.href = `./chat.html?sid=${id}&t=${t}&m=${m}`;
    });

    btnDel.onclick = async () => {
      if (confirm(`Eliminar la sesión "${s.titulo}"?`)) {
        await window.api.eliminarSesion(s._id);
        await cargarSesiones();
      }
    };

    actions.appendChild(btnDel);

    // leyenda inferior con última respuesta + fecha/hora
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
    const sesiones = await window.api.listarSesiones();
    lista.innerHTML = '';
    // Render en paralelo para no bloquear UI
    const items = await Promise.all(sesiones.map(renderItem));
    for (const it of items) lista.appendChild(it);
  }

  // ===== Modal logic =====
  function openModal() {
    lastFocused = document.activeElement;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    // pequeña pausa para que el DOM pinte y luego focus
    setTimeout(() => {
      if (inputTitulo) {
        inputTitulo.removeAttribute('disabled');
        inputTitulo.removeAttribute('readonly');
        inputTitulo.focus();
        inputTitulo.select();
      }
    }, 30);
  }

  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    inputTitulo.value = '';
    if (selectModelo) selectModelo.value = 'deepseek-chat';
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  // Clic en fondo cierra
  modal.addEventListener('click', (e) => {
    const isBackdrop = e.target instanceof HTMLElement && e.target.dataset.close === 'true';
    if (isBackdrop) closeModal();
  });

  // Botones del modal
  btnNueva.addEventListener('click', openModal);
  btnCerrarModal.addEventListener('click', closeModal);
  btnCancelar.addEventListener('click', closeModal);

  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
    }
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
    } finally {
      btnCrear.disabled = false;
      closeModal();
    }
  }

  window.addEventListener('DOMContentLoaded', cargarSesiones);
})();
