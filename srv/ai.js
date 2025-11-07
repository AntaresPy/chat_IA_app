// srv/ai.js
const axios = require('axios');

/**
 * .env:
 * - DEEPSEEK_API_KEY (obligatorio)
 * - DEEPSEEK_MODEL (fallback: deepseek-chat)
 * - DEEPSEEK_URL (opcional) -> por defecto: https://api.deepseek.com/v1/chat/completions
 * - DEEPSEEK_REASONING_EFFORT (low|medium|high) -> solo para reasoner
 * - DEEPSEEK_MAX_TOKENS, DEEPSEEK_TEMPERATURE
 */
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEFAULT_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const ENDPOINT = process.env.DEEPSEEK_URL || 'https://api.deepseek.com/v1/chat/completions';
const REASONING_EFFORT = process.env.DEEPSEEK_REASONING_EFFORT || 'medium';
const MAX_TOKENS = Number(process.env.DEEPSEEK_MAX_TOKENS || 1024);
const TEMPERATURE = Number(process.env.DEEPSEEK_TEMPERATURE ?? 0.3);

if (!DEEPSEEK_API_KEY) {
  console.warn('[WARN] DEEPSEEK_API_KEY no está definido.');
}

// Normaliza alias comunes a los nombres reales de DeepSeek
function normalizeModel(name) {
  const n = String(name || '').toLowerCase().trim();
  if (n === 'deepseek-r1' || n === 'r1' || n === 'reasoner' || n === 'deepseek_reasoner') {
    return 'deepseek-reasoner';
  }
  if (n === 'chat' || n === 'deepseek_chat') return 'deepseek-chat';
  return name;
}

function isReasoningModel(name) {
  const m = String(name || '').toLowerCase();
  return m.includes('deepseek-reasoner');
}

function httpError(message, { status, code, data, requestId } = {}) {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  e.data = { requestId, status, code, response: data };
  return e;
}

/**
 * Completa con DeepSeek.
 * @param {Array<{role:'system'|'user'|'assistant', content:string}>} messages
 * @param {string} [modelOverride]
 * @param {{ requestId?: string, timeoutMs?: number }} [options]
 */
async function completarDeepseek(messages, modelOverride, options = {}) {
  const model = normalizeModel(modelOverride || DEFAULT_MODEL);
  const { requestId, timeoutMs = 30000 } = options;

  const payload = {
    model,
    messages,
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
    stream: false,
  };

  if (isReasoningModel(model)) {
    payload.reasoning = { effort: REASONING_EFFORT };
  }

  // AbortController para controlar timeout/abort con mensaje claro
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await axios.post(ENDPOINT, payload, {
      headers: {
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Request-Id': requestId || undefined,
      },
      signal: controller.signal,
      maxBodyLength: 512 * 1024,
      timeout: 0,              // manejamos timeout nosotros
      validateStatus: () => true, // no lanzar por status http aquí
    });

    if (res.status < 200 || res.status >= 300) {
      // DeepSeek suele devolver { error: { code, message } }
      const msg = res.data?.error?.message || `HTTP ${res.status}`;
      const code = res.data?.error?.code || 'HTTP_ERROR';
      throw httpError(msg, { status: res.status, code, data: res.data, requestId });
    }

    return res?.data?.choices?.[0]?.message?.content ?? '';

  } catch (err) {
    if (err?.name === 'AbortError') {
      throw httpError('La solicitud fue abortada', { status: 499, code: 'ABORTED', requestId });
    }
    if (err?.code === 'ECONNABORTED') {
      throw httpError('La solicitud excedió el tiempo de espera', { status: 408, code: 'TIMEOUT', requestId });
    }
    if (err?.response) {
      const status = err.response.status;
      const code = err.response.data?.error?.code || err.code || 'HTTP_ERROR';
      const msg = err.response.data?.error?.message || err.message || `HTTP ${status}`;
      throw httpError(msg, { status, code, data: err.response.data, requestId });
    }
    const code = err?.code || 'NETWORK_ERROR';
    const msg = err?.message || 'Fallo de red';
    throw httpError(msg, { status: 502, code, requestId });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { completarDeepseek };