const personal = /\b(?:your|you|my|i|me)\b|あなた|自分|\b(?:tapai|timro|mero)\b/i;
const moneyTopic = /\b(?:how much|spend(?:ing)?|spent|earn(?:ed|ings)?|paid|owe|owed|income|expenses?|balances?|savings?|saved|bills?|budgets?|cash|rent|debt|total|yen)\b|支出|収入|残高|貯金|予算|円|kharcha/i;
const ownedMoney = /\byour\s+(?:[\w-]+\s+){0,3}(?:money|income|expenses?|spending|balance|savings?|bills?|budgets?|cash|rent|debt|total|account)\b|\byou(?:['’]ve| have)?\s+(?:spent|paid|saved|earned|received|owe|owed|had|have(?! to\b)|can safely spend)\b|あなたの|^(?:今月|先月|今日|今年)の|\b(?:tapai|timro|mero)\b.*kharcha/i;
const moneySummary = /^(?:[−+-]?\s*¥|JPY\b|\d|(?:this month|last month|today)[,:]?\s+¥|(?:total\s+)?(?:total|spending|expenses?|income|balance|savings?|rent|safe[- ]to[- ]spend)\b|支出|収入|残高|貯金)/i;
const hypothetical = /\b(?:if|for example|example|suppose|imagine|hypothetically|let's say|(?:could|can|should|might|would) (?:set|budget|choose|aim|start|save|put|add|enter|spend))\b|例えば|仮に|たとえば|もし/i;
const figure = String.raw`[−+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:\s*(?:[kmb]\b|[万億兆]))?(?!\d|[,.]\d)`;
const namedYen = new RegExp(String.raw`(?:[−-]\s*)?(?:¥|\bJPY)\s*(${figure})|(?<![\w.,])(${figure})\s*(?:yen\b|JPY\b|円)`, 'giu');
const bareMoney = new RegExp(String.raw`(?:\b(?:spent|earned|paid|saved|owe|owed)\s+(?:a total of\s+)?|(?:\b(?:balance|income|expenses?|spending|savings|rent|total)\b|支出|収入|残高|貯金)\s*(?:is|was|were|are|total(?:led|ed|s)|came to|[:=：]|は)\s*)(${figure})(?!\s*(?:[%％]|-\d|days?\b|weeks?\b|months?\b|hours?\b|minutes?\b|times?\b|transactions?\b|accounts?\b|bills?\b|steps?\b|people\b))`, 'giu');
const scales = { k: 1000, m: 1e6, b: 1e9, 万: 1e4, 億: 1e8, 兆: 1e12 };
const small = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
const tens = 'zero ten twenty thirty forty fifty sixty seventy eighty ninety'.split(' ');
const wordScales = { hundred: 100, thousand: 1000, million: 1e6, billion: 1e9 };
const kanjiScales = { 十: 10, 百: 100, 千: 1000, ...scales };
const word = [...small, ...tens.slice(2), ...Object.keys(wordScales)].join('|');
const wordsYen = new RegExp(String.raw`\b((?:${word})(?:(?:[ -]+(?:and )?)(?:${word}))*)\s+(?:yen|JPY)\b`, 'gi');
const kanjiYen = /(?<![\d〇零一二三四五六七八九十百千万億兆])([〇零一二三四五六七八九十百千万億兆]+)\s*円/g;

function numericAmount(value) {
  const unit = value.at(-1).toLowerCase();
  const multiplier = scales[unit] ?? 1;
  const digits = multiplier === 1 ? value : value.slice(0, -1);
  return Number(digits.replaceAll(',', '').replace('−', '-')) * multiplier;
}

function spokenAmount(value) {
  let total = 0;
  let group = 0;
  for (const part of value.toLowerCase().split(/[ -]+/)) {
    const scale = wordScales[part];
    if (scale >= 1000) {
      total += (group || 1) * scale;
      group = 0;
    } else if (scale) group = (group || 1) * scale;
    else if (small.includes(part)) group += small.indexOf(part);
    else if (tens.includes(part)) group += tens.indexOf(part) * 10;
  }
  return total + group;
}

function kanjiAmount(value) {
  let total = 0;
  let group = 0;
  let digits = 0;
  for (const char of value.replaceAll('零', '〇')) {
    const scale = kanjiScales[char];
    if (!scale) digits = digits * 10 + '〇一二三四五六七八九'.indexOf(char);
    else if (scale < 1e4) {
      group += (digits || 1) * scale;
      digits = 0;
    } else {
      total += (group + digits || 1) * scale;
      group = digits = 0;
    }
  }
  return total + group + digits;
}

function claimedAmounts(answer, question) {
  const ownMoneyQuestion = personal.test(question) && moneyTopic.test(question);
  const text = answer.normalize('NFKC').replace(/^[ \t]*[-*+][ \t]+/gm, '')
    .replace(/[*_`]+/g, '').replace(/\be\.g\./gi, 'for example');
  const amounts = new Set();
  for (const clause of text.split(/[\n!?。！？;；]|\.(?!\d)/)) {
    // Evaluate claims before an example or hypothetical separately from its amounts.
    const actual = clause.split(hypothetical, 1)[0].trim();
    if (!ownedMoney.test(actual) && !(ownMoneyQuestion && moneySummary.test(actual))) continue;
    for (const match of actual.matchAll(namedYen)) {
      const outsideSign = /^[−-]/.test(match[0]) && match[1] && !/^[−-]/.test(match[1]) ? '-' : '';
      amounts.add(numericAmount(outsideSign + (match[1] ?? match[2])));
    }
    for (const match of actual.matchAll(bareMoney)) amounts.add(numericAmount(match[1]));
    for (const match of actual.matchAll(wordsYen)) amounts.add(spokenAmount(match[1]));
    for (const match of actual.matchAll(kanjiYen)) amounts.add(kanjiAmount(match[1]));
  }
  return amounts;
}

function collectAmounts(data, amounts) {
  for (const [key, value] of Object.entries(data ?? {})) {
    if (typeof value === 'number' && Number.isFinite(value) && /_jpy$/.test(key)) amounts.add(value);
    else if (value && typeof value === 'object') collectAmounts(value, amounts);
  }
}

export function verifyAnswerNumbers(answer, snapshot, question = '') {
  const allowed = new Set();
  collectAmounts(snapshot, allowed);
  const mismatchedNumbers = [...claimedAmounts(answer, question)].filter((value) => !allowed.has(value));
  return { valid: mismatchedNumbers.length === 0, mismatchedNumbers };
}
