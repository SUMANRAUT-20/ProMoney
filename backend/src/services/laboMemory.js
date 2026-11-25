import { completeLaboExtraction } from './laboChat.js';
import { cleanMemory, containsMemorySecret, memoryEntries, mergeMemory } from './nidhiMemory.js';

const rules = [
  'Extract durable user preferences or facts explicitly stated in the user message. Return JSON only.',
  'Allowed shape: { "style": { "languageMix": "", "messageLength": "" }, "facts": [{ "key": "", "value": "" }], "wordMap": {}, "patterns": { "payday": 25, "regularSpends": {} }, "summary": "" }.',
  'Omit fields without new information. Return {} if there is nothing durable. Only use the answer for conversational context, never as evidence of a user fact.',
  'Keep fact keys stable when correcting a fact. Map a user word to a category only if the user makes that association. Do not infer spending amounts or balances.',
  'Never include passwords, PINs, full card numbers, one-time codes, or API keys.',
].join('\n');

export async function proposeMemoryUpdate({ question, answer, current }, options) {
  if (containsMemorySecret(question) || containsMemorySecret(answer)) return null;
  const response = await completeLaboExtraction([
    { role: 'system', content: rules },
    { role: 'user', content: JSON.stringify({ question, answer, remembered: memoryEntries({ ...current, accountMap: {} }).slice(0, 12) }) },
  ], options);
  let parsed;
  try {
    parsed = JSON.parse(response.slice(response.indexOf('{'), response.lastIndexOf('}') + 1));
  } catch {
    return null;
  }
  const patch = cleanMemory(parsed);
  patch.merchantMap = {};
  patch.accountMap = {};
  const next = mergeMemory(current, patch);
  if (JSON.stringify(current) === JSON.stringify(next)) return null;
  return { patch, entries: memoryEntries(patch) };
}
