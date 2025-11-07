# 🧠 DeepSeek Chat (Electron + MongoDB)

Aplicación de escritorio desarrollada con **Electron**, **MongoDB** y **DeepSeek API**, que permite crear, almacenar y gestionar conversaciones con modelos de inteligencia artificial de DeepSeek, directamente desde un entorno local y seguro.

---

## 🚀 Características principales

- **Chat con IA** usando los modelos oficiales de DeepSeek:
  - `deepseek-chat` (estándar)
  - `deepseek-reasoner` (razonamiento avanzado)
- **Sesiones persistentes**: cada conversación se guarda en MongoDB con historial completo.
- **Exportación** de chats en formato `.txt` o `.json`.
- **Cambio de modelo en tiempo real** dentro de una misma sesión.
- **Manejo robusto de errores** con:
  - Registro automático en archivo `app.log`.
  - Alertas visuales con **SweetAlert2**.
  - Banners informativos en pantalla.
- **Funcionamiento tolerante a fallos**: si la base de datos no está disponible, el programa sigue operativo en modo limitado.
- **Compatibilidad total con entorno offline/online**.

---

## ⚙️ Requisitos previos

| Componente | Requisito mínimo |
|-------------|------------------|
| **Node.js** | v20 o superior   |
| **npm**     | v10 o superior   |
| **MongoDB** | Local o remoto (puerto 27017 abierto) |
| **Windows** | 10 o 11 (x64)    |
| **Inno Setup** *(opcional)* | Para compilar el instalador `.exe` |

---

## 🔧 Configuración del entorno `.env`

```ini
NODE_ENV=production

# DeepSeek API
DEEPSEEK_API_KEY=tu_api_key
DEEPSEEK_URL=https://api.deepseek.com/v1/chat/completions
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_REASONING_EFFORT=medium
DEEPSEEK_MAX_TOKENS=1024
DEEPSEEK_TEMPERATURE=0.3

# Base de datos
MONGO_URI=mongodb://localhost:27017
MONGO_DBNAME=deepseek_chat
```

---

## 🧪 Modo desarrollo

```bash
npm ci
npm start
```

- DevTools se abren automáticamente.
- Logs se guardan en la carpeta `logs/` del proyecto.

---

## 📦 Empaquetado de producción

1. Configurá `.env` con `NODE_ENV=production`.
2. Ejecutá:
   ```bash
   npm run pack:win
   ```
   Genera `dist\win-unpacked\DeepSeek Chat.exe`
3. (Opcional) Crear instalador con Inno Setup:
   ```bash
   npm run installer
   ```

---

## 🧰 Logs y diagnóstico

Ubicación:  
```
%AppData%\DeepSeek Chat\logs\app.log
```
Cada entrada incluye fecha, tipo de evento y detalle técnico (status, código, stacktrace).

Ejemplo:
```
2025-11-07T14:12:22.180Z [chat:enviar:error] { requestId: 'req_83fa1d', status: 401, code: 'INVALID_API_KEY', message: 'API key no autorizada' }
```

---

## 🖥️ Interfaz y uso

- **Pantalla principal (index):** listado de conversaciones, creación y eliminación.
- **Pantalla de chat:** envío de mensajes, cambio de modelo, exportación.
- **Alertas:** banners o modales SweetAlert2 según el tipo de error o aviso.

---

## 🧠 Modelos soportados

| Modelo              | Descripción |
|---------------------|-------------|
| `deepseek-chat`     | Modelo estándar de diálogo |
| `deepseek-reasoner` | Modelo R1 de razonamiento estructurado |

---

## 🧾 Licencia

Proyecto licenciado bajo la **MIT License**.  
© 2025 Starsoft — Todos los derechos reservados.
