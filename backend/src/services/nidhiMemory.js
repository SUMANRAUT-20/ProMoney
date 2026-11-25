import { accountLabelKey } from './statementAccounts.js';

const secretWords = /\b(?:pass(?:word|code)(?:[ _-]*(?:value|code))?|p\.?i\.?n\.?(?:[ _-]*(?:code|number))?|cvv|cvc|(?:credit |debit )?card[ _-]*(?:no\.?|number)|api[ _-]*key|otp)\b|パスワード|暗証番号|カード番号/i;
const secretKey = /password|passcode|pincode|pinnumber|cardnumber|cvv|cvc|apikey|onepassword|^pin$/i;
const cardDigits = /(?:\d[\s\p{Pd}.·・]*){13}/u;

export function memoryKey(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').trim();
}

export function containsMemorySecret(text) {
  const normalized = String(text).normalize('NFKC');
  return secretWords.test(normalized) || cardDigits.test(normalized);
}

function safeText(value, max = 120) {
  if (typeof value !== 'string') return '';
  const text = value.normalize('NFKC').trim();
  return text && !containsMemorySecret(text) ? text.slice(0, max) : '';
}

function safeKey(value) {
  const text = safeText(value, 160);
  return secretKey.test(text.replace(/[^a-z]/gi, '')) ? '' : memoryKey(text);
}

function cleanMap(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  return Object.fromEntries(Object.entries(source).flatMap(([key, value]) => {
    const cleanKey = safeKey(key);
    const clean = safeText(value);
    return cleanKey && clean ? [[cleanKey, clean]] : [];
  }));
}

function cleanAccountMap(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  return Object.fromEntries(Object.entries(source).flatMap(([label, value]) => {
    const key = accountLabelKey(label);
    const id = String(value ?? '');
    return key.length <= 160 && safeKey(key) && /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id))
      ? [[key, id]] : [];
  }));
}

export function cleanMemory(source = {}) {
  const style = {};
  const languageMix = safeText(source?.style?.languageMix, 80);
  const messageLength = safeText(source?.style?.messageLength, 60);
  if (languageMix) style.languageMix = languageMix;
  if (messageLength) style.messageLength = messageLength;
  const facts = new Map();
  for (const fact of Array.isArray(source?.facts) ? source.facts : []) {
    const key = safeKey(fact?.key);
    const value = safeText(fact?.value);
    if (key && value) facts.set(key, { key, value });
  }
  const patterns = {};
  const payday = Number(source?.patterns?.payday);
  const regularSpends = cleanMap(source?.patterns?.regularSpends);
  if (Number.isInteger(payday) && payday >= 1 && payday <= 31) patterns.payday = payday;
  if (Object.keys(regularSpends).length) patterns.regularSpends = regularSpends;
  const summary = safeText(source?.summary, 300);
  return {
    style, facts: [...facts.values()], wordMap: cleanMap(source?.wordMap),
    merchantMap: cleanMap(source?.merchantMap), accountMap: cleanAccountMap(source?.accountMap),
    patterns, ...(summary && { summary }),
  };
}

export function mergeMemory(current, proposed) {
  const before = cleanMemory(current);
  const update = cleanMemory(proposed);
  return cleanMemory({
    ...before, ...update,
    style: { ...before.style, ...update.style },
    facts: [...before.facts, ...update.facts],
    wordMap: { ...before.wordMap, ...update.wordMap },
    merchantMap: { ...before.merchantMap, ...update.merchantMap },
    accountMap: { ...before.accountMap, ...update.accountMap },
    patterns: {
      ...before.patterns, ...update.patterns,
      regularSpends: { ...before.patterns.regularSpends, ...update.patterns.regularSpends },
    },
  });
}

function entries(section, values, label) {
  return Object.entries(values ?? {}).map(([key, value]) => ({ section, key, label: label(key), value }));
}

export function memoryEntries(memory) {
  return [
    ...entries('style', memory.style, (key) => key === 'languageMix' ? 'Language mix' : 'Message length'),
    ...(memory.facts ?? []).map(({ key, value }) => ({ section: 'facts', key, label: key, value })),
    ...entries('wordMap', memory.wordMap, (key) => `Word · ${key}`),
    ...entries('merchantMap', memory.merchantMap, (key) => `Merchant · ${key}`),
    ...entries('accountMap', memory.accountMap, (key) => `File account · ${key}`),
    ...(memory.patterns?.payday ? [{ section: 'patterns', key: 'payday', label: 'Payday', value: memory.patterns.payday }] : []),
    ...entries('regularSpends', memory.patterns?.regularSpends, (key) => `Regular spend · ${key}`),
    ...(memory.summary ? [{ section: 'summary', key: 'summary', label: 'Summary', value: memory.summary }] : []),
  ];
}

export function forgetMemoryEntry(memory, section, key) {
  if (!memoryEntries(memory).some((entry) => entry.section === section && entry.key === key)) return null;
  if (section === 'facts') memory.facts = memory.facts.filter((fact) => fact.key !== key);
  else if (section === 'summary') delete memory.summary;
  else if (section === 'regularSpends') delete memory.patterns.regularSpends[key];
  else delete memory[section][key];
  return cleanMemory(memory);
}

export function memoryCategory(text, kind, categories, dictionary = {}) {
  const title = memoryKey(text);
  const keys = Object.keys(dictionary).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const matches = ` ${title} `.includes(` ${key} `) || (/[\p{Script=Han}\p{Script=Katakana}\p{Script=Hiragana}]/u.test(key) && title.startsWith(key));
    if (!matches) continue;
    const label = memoryKey(dictionary[key]);
    if (label === 'uncategorized') return { id: null, name: null };
    const category = categories.find((item) => item.kind === kind && memoryKey(item.name) === label);
    if (category) return category;
  }
  return null;
}

export function aboutThisUser(memory) {
  return memoryEntries({ ...memory, accountMap: {} }).map(({ label, value }) => `${label}: ${value}`).join('\n').slice(0, 1500);
}
