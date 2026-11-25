const WONDER = 'muse-wonder-1.0';
const UNVERIFIED = "I couldn't verify those figures in ProMoney. Please check the Home or Transactions page.";
const CLARIFY = 'Tell me a little more about what you want to do so I can prepare the right review.';
const numeric = /(?<![\p{Script=Latin}\d])[-−]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?![\p{Script=Latin}\d])/gu;

function mentionedNumbers(text) {
  return [...text.normalize('NFKC').replace(/(?:JPY|USD|EUR)(?=\d)|(?<=\d)(?:JPY|USD|EUR|yen)/gi, ' ')
    .replace(/([−-])\s*¥\s*(?=\d)/g, '$1').matchAll(numeric)]
    .map(([value]) => Number(value.replaceAll(',', '').replace('−', '-')));
}

function collectNumbers(data, allow) {
  if (typeof data === 'number' && Number.isFinite(data)) allow.add(data);
  else if (typeof data === 'string' && /^\d{4}-\d{2}(?:-\d{2})?$/.test(data)) {
    mentionedNumbers(data).forEach((value) => allow.add(value));
  }
  else if (data && typeof data === 'object') Object.values(data).forEach((value) => collectNumbers(value, allow));
}

export function verifyAnswerNumbers(answer, data) {
  const allowed = new Set();
  collectNumbers(data, allowed);
  const text = answer.normalize('NFKC');
  const mismatchedNumbers = mentionedNumbers(text).filter((value) => !allowed.has(value));
  const spelledAmount = /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\w+teen|\w+ty|hundred|thousand|million|billion)[\s-]+(?:yen|dollars|percent|per cent|hundred|thousand|million|billion)\b|[〇零一二三四五六七八九十百千万億兆]+(?:円|パーセント)|\d\s*(?:[kmb]\b|万|億|兆)/iu;
  return { valid: !mismatchedNumbers.length && !spelledAmount.test(text), mismatchedNumbers };
}

function groundReply(answer, data) {
  return verifyAnswerNumbers(answer, data).valid ? answer : UNVERIFIED;
}

function jsonReply(content) {
  let result;
  try {
    result = JSON.parse(content);
  } catch {
    throw Object.assign(new Error('Invalid Meta structured reply.'), { code: 'META_UPSTREAM' });
  }
  const answer = typeof result?.answer === 'string' ? result.answer : '';
  const calls = typeof result?.tool?.name === 'string'
    ? [{ function: { name: result.tool.name, arguments: JSON.stringify(result.tool.arguments) } }] : [];
  if (!answer.trim() && !calls.length) throw Object.assign(new Error('Empty Meta structured reply.'), { code: 'META_UPSTREAM' });
  return { answer, calls };
}

async function requestTurn(complete, messages, options, tools) {
  try {
    return await complete(messages, { ...options, tools });
  } catch (error) {
    if (![400, 422, 501].includes(error.status)) throw error;
    const system = messages[0];
    const instructions = 'Return JSON only: {"answer":"reply in the user language","tool":null}. To request a tool, put {"name":"tool name","arguments":{}} in tool. Use at most one. Tool definitions: ';
    const structured = [{ ...system, content: system.content + '\n\n' + instructions + JSON.stringify(tools.map((tool) => tool.function)) }, ...messages.slice(1)];
    return jsonReply(await complete(structured, { ...options, json: true }));
  }
}

async function modelTurn(complete, messages, tools, model, logUsage) {
  const usage = { model, inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  const onUsage = (counts) => {
    if (!counts) return;
    const input = counts.prompt_tokens ?? counts.input_tokens ?? 0;
    const output = counts.completion_tokens ?? counts.output_tokens ?? 0;
    usage.inputTokens += input;
    usage.outputTokens += output;
    usage.totalTokens += counts.total_tokens ?? input + output;
  };
  try {
    return await requestTurn(complete, messages, { model, onUsage }, tools);
  } finally {
    logUsage('[Nidhi chat usage]', usage);
  }
}

async function getModelReply(complete, messages, tools, ember, logUsage) {
  try {
    return { ...await modelTurn(complete, messages, tools, WONDER, logUsage), model: WONDER };
  } catch (error) {
    logUsage('[Nidhi chat fallback]', { from: WONDER, to: ember, reason: error.status ?? error.code ?? error.name });
    try {
      return { ...await modelTurn(complete, messages, tools, ember, logUsage), model: ember };
    } catch (fallbackError) {
      if (fallbackError.code === 'LABO_NOT_CONFIGURED') throw fallbackError;
      throw Object.assign(new Error('Meta conversation unavailable.'), { code: 'META_UPSTREAM' });
    }
  }
}

export async function completeWonderTurn({
  messages, snapshot, tools = [], resolveTool, logUsage = console.info, ember, complete,
}) {
  const { answer, calls, model } = await getModelReply(complete, messages, tools, ember, logUsage);
  const scope = { provider: 'meta', model };
  if (!calls.length) return { ...scope, answer: groundReply(answer, snapshot) };
  const call = calls.length === 1 && calls[0]?.function;
  if (!call || !tools.some((tool) => tool.function.name === call.name)) return { ...scope, answer: CLARIFY };
  let args;
  try { args = JSON.parse(call.arguments); } catch { return { ...scope, answer: CLARIFY }; }
  const result = await resolveTool?.(call.name, args);
  return { ...scope, ...(result ?? { answer: CLARIFY }) };
}
