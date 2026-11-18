import dotenv from 'dotenv';

dotenv.config({ path: new URL('../../.env', import.meta.url) });
const { getProviderConfig, META_MAX_COMPLETION_TOKENS } = await import('../src/services/laboChat.js');
const config = getProviderConfig();
const maskedKey = config.apiKey.length > 6
  ? config.apiKey.slice(0, 4) + '…' + config.apiKey.slice(-2)
  : '(missing or too short to mask)';
console.log('AI_PROVIDER:', config.provider);
console.log('API key:', maskedKey);
console.log('Model:', config.model);

try {
  const response = await fetch(config.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: 'Say hello.' }],
      max_tokens: config.provider === 'meta' ? META_MAX_COMPLETION_TOKENS : 800,
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const body = await response.text();
  console.log('HTTP status:', response.status);
  console.log('Raw response (first 500 characters):');
  console.log((config.apiKey ? body.replaceAll(config.apiKey, '[REDACTED]') : body).slice(0, 500));
  if (!response.ok) process.exitCode = 1;
} catch (error) {
  console.log('HTTP status: unavailable');
  console.log('Request error:', error.cause?.code || error.code || error.name);
  process.exitCode = 1;
}
