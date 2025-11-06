// srv/ai.js
const axios = require('axios');

/**
 * .env:
 * - DEEPSEEK_API_KEY (obligatorio)
 * - DEEPSEEK_MODEL (fallback: deepseek-chat)
 * - DEEPSEEK_URL (opcional)
 * - DEEPSEEK_REASONING_EFFORT (low|medium|high) -> solo R1
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

function isReasoningModel(name) {
  const m = String(name || '').toLowerCase();
  return m.includes('deepseek-r1') || m.includes('deepseek-reasoner');
}

/**
 * Completa con DeepSeek. Si se pasa `modelOverride`, se usa ese modelo.
 */
async function completarDeepseek(messages, modelOverride) {
  const model = modelOverride || DEFAULT_MODEL;

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

  const res = await axios.post(ENDPOINT, payload, {
    headers: {
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
    maxBodyLength: 512 * 1024,
  });

  return res?.data?.choices?.[0]?.message?.content ?? '';
}

module.exports = { completarDeepseek };
