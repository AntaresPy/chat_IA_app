// srv/ai.js
const axios = require('axios');

const DEEPSEEK_ENDPOINT =
  process.env.DEEPSEEK_URL || 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY; // <-- setear en entorno

if (!DEEPSEEK_API_KEY) {
  // No arrojamos excepción aquí para no romper dev,
  // pero en producción deberías fallar temprano.
  console.warn('[WARN] DEEPSEEK_API_KEY no está definido.');
}

async function completarDeepseek(messages) {
  // messages: [{role:'system'|'user'|'assistant', content:'...'}, ...]
  const payload = {
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    messages,
    temperature: 0.3,
    stream: false,
  };

  const res = await axios.post(DEEPSEEK_ENDPOINT, payload, {
    headers: {
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
    maxBodyLength: 512 * 1024,
  });

  const msg = res?.data?.choices?.[0]?.message?.content ?? '';
  return msg;
}

module.exports = { completarDeepseek };
