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

  async function cargarSesiones() {
    const sesiones = await window.api.listarSesiones();
    lista.innerHTML = '';
    for (const s of sesiones) {
      const li = document.createElement('li');
      li.className = 'item';

      const span = document.createElement('span');
      span.textContent = s.titulo;
      span.title = new Date(s.fecha_creacion).toLocaleString();

      span.ondblclick = () => {
        const id = encodeURIComponent(String(s._id));
        window.location.href = `./chat.html?sid=${id}`;
      };

      const btnDel = document.createElement('button');
      btnDel.textContent = '🗑️';
      btnDel.className = 'danger';
      btnDel.onclick = async () => {
        if (confirm(`Eliminar la sesión "${s.titulo}"?`)) {
          await window.api.eliminarSesion(s._id);
          await cargarSesiones();
        }
      };

      li.appendChild(span);
      li.appendChild(btnDel);
      lista.appendChild(li);
    }
  }

  // ===== Modal logic =====
  function openModal() {
    lastFocused = document.activeElement;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    // pequeña pausa para que el DOM pinte y luego focus
    setTimeout(() => {
      if (inputTitulo) {
        // por si quedó con algún flag/no-interactivo desde el DOM
        inputTitulo.removeAttribute('disabled');
        inputTitulo.removeAttribute('readonly');
        inputTitulo.focus();
        inputTitulo.select(); // mejora UX
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

  // Enter crea, Esc cierra
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
    btnCrear.disabled = true;

    try {
      const modelo = (selectModelo?.value || 'deepseek-chat');
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
