import { getProviderConfig, metaComplete, META_EMBER_MODEL } from './laboChat.js';

export function createStatementMeta({ env = process.env, fetchImpl = fetch } = {}) {
  const { apiKey, url } = getProviderConfig({ ...env, AI_PROVIDER: 'meta' });
  const usage = { requests: 0, responsesWithUsage: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  function onUsage(tokens) {
    if (!tokens) return;
    const input = Number(tokens.prompt_tokens ?? tokens.input_tokens) || 0;
    const output = Number(tokens.completion_tokens ?? tokens.output_tokens) || 0;
    usage.responsesWithUsage += 1;
    usage.inputTokens += input;
    usage.outputTokens += output;
    usage.totalTokens += Number(tokens.total_tokens) || input + output;
  }
  return {
    usage,
    complete: (messages) => metaComplete(messages, {
      apiKey, url, model: META_EMBER_MODEL, temperature: 0, maxTokens: 16_000, privateInput: true, onUsage,
      fetchImpl: (target, init) => {
        usage.requests += 1;
        return fetchImpl(target, { ...init, signal: AbortSignal.timeout(60_000) });
      },
    }),
  };
}
