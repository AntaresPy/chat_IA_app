// renderer.js (para index.html)
(function () {
  const lista = document.getElementById('listaSesiones');
  const input = document.getElementById('tituloSesion');
  const btnCrear = document.getElementById('btnCrearSesion');

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

  btnCrear.addEventListener('click', async () => {
    const titulo = (input.value || '').trim() || 'Nueva conversación';
    const sesion = await window.api.crearSesion(titulo);
    input.value = '';
    await cargarSesiones();
    const id = encodeURIComponent(String(sesion._id));
    window.location.href = `./chat.html?sid=${id}`;
  });

  window.addEventListener('DOMContentLoaded', cargarSesiones);
})();
