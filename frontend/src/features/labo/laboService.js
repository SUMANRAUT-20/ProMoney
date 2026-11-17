import { apiClient } from '../../services/api';
import { currentMonthISO, makeId, todayISO } from '../../utils/formatters';
import { buildFinanceSnapshot } from './buildSnapshot.js';

/**
 * LA-BO Frontend Service Module (Phase 4 & Phase 6 Branch 1: Voice, Multi-Add, Undo)
 *
 * All LA-BO network, snapshot, Web Speech API (recognition + synthesis),
 * and intent-detection operations live here so React components only
 * render state and invoke hook callbacks.
 */

export const QUICK_QUESTIONS = [
  'How much did I spend this month?',
  'What is my biggest expense category?',
  'How much can I safely spend per day?',
  'Am I over budget anywhere?',
  'Spending by category this month',
  'Last month vs this month',
  'Show my income vs expenses',
];

const VOICE_MUTE_STORAGE_KEY = 'pm_labo_voice_muted_v1';
const VOICE_LANG_STORAGE_KEY = 'pm_labo_voice_lang_v1';

export function loadVoiceMuted() {
  try {
    return localStorage.getItem(VOICE_MUTE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveVoiceMuted(muted) {
  try {
    localStorage.setItem(VOICE_MUTE_STORAGE_KEY, muted ? 'true' : 'false');
  } catch {
    // Ignore storage errors
  }
}

export function loadVoiceLang() {
  try {
    const saved = localStorage.getItem(VOICE_LANG_STORAGE_KEY);
    return saved === 'ja-JP' ? 'ja-JP' : 'en-US';
  } catch {
    return 'en-US';
  }
}

export function saveVoiceLang(lang) {
  try {
    localStorage.setItem(VOICE_LANG_STORAGE_KEY, lang === 'ja-JP' ? 'ja-JP' : 'en-US');
  } catch {
    // Ignore storage errors
  }
}

export function isSpeechRecognitionSupported() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function detectSpeechLang(text, preferredLang = 'en-US') {
  if (/[\u3040-\u30ff\u4e00-\u9faf]/.test(String(text || ''))) {
    return 'ja-JP';
  }
  return preferredLang || 'en-US';
}

export function stopLaboSpeech() {
  try {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  } catch {
    // Ignore speech synthesis errors
  }
}

export function speakLaboReply(text, { muted = false, preferredLang = 'en-US', onStart, onEnd, verbatim = false } = {}) {
  if (muted || typeof window === 'undefined' || !window.speechSynthesis || !window.SpeechSynthesisUtterance) {
    if (onEnd) onEnd();
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const cleanText = verbatim ? text : String(text || '').replace(/[*_`#]/g, '').trim();
    if (!cleanText) {
      if (onEnd) onEnd();
      return;
    }
    const utterance = new window.SpeechSynthesisUtterance(cleanText);
    utterance.lang = detectSpeechLang(cleanText, preferredLang);
    utterance.rate = 1.0;
    if (onStart) utterance.onstart = onStart;
    if (onEnd) {
      utterance.onend = onEnd;
      utterance.onerror = onEnd;
    }
    window.speechSynthesis.speak(utterance);
  } catch {
    if (onEnd) onEnd();
  }
}

export function createSpeechRecognizer({ lang = 'en-US', onTranscript, onEnd, onError }) {
  if (!isSpeechRecognitionSupported()) return null;
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognitionCtor();
  recognition.lang = lang;
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.onresult = (event) => {
    let transcript = '';
    let isFinal = false;
    for (let i = 0; i < event.results.length; i += 1) {
      transcript += event.results[i][0].transcript;
      if (event.results[i].isFinal) isFinal = true;
    }
    if (onTranscript) onTranscript(transcript.trim(), isFinal);
  };

  recognition.onerror = (event) => {
    if (onError) onError(event?.error || 'speech_error');
  };

  recognition.onend = () => {
    if (onEnd) onEnd();
  };

  return recognition;
}

/**
 * Detects whether a user message is asking to undo the last LA-BO save (F6).
 */
export function isUndoCommand(text) {
  const clean = String(text || '').trim().toLowerCase();
  return clean === 'undo' || clean === 'undo that' || clean === '取り消し' || clean === '元に戻す';
}

/**
 * Heuristic check for whether a user message might be adding one or more
 * transactions (e.g. "spent 500 on lunch and 1200 on train", "khana 800, bus 220").
 */
export function looksLikeAddIntent(text) {
  const str = String(text || '').trim();
  if (!str || str.endsWith('?') || str.endsWith('？')) return false;
  if (!/\d{2,}/.test(str)) return false;
  const lower = str.toLowerCase();
  if (/^(how|what|why|when|where|am i|can i|do i|show|tell)\b/.test(lower)) return false;
  if (/\b(by category|category breakdown|category spending|report|monthly comparison)\b|\bincome\b.*\bexpenses?\b|\bexpenses?\b.*\bincome\b|カテゴリ別|レポート|収入.*支出/.test(lower)) return false;
  if (
    /\b(spent|spend|paid|pay|bought|buy|add|record|received|got|salary|baito|khana|kharcha|aayo|lunch|dinner|coffee|bus|train|groceries|rent)\b/i.test(
      str
    )
  ) {
    return true;
  }
  if (/(払った|買った|使った|給料|バイト|追加)/.test(str)) {
    return true;
  }
  // Also match comma/and-separated "word number" pairs like "tea 300, snack 450"
  return /[a-zA-Z\u3040-\u9faf]+\s+[¥￥]?\d{2,}/.test(str);
}

export async function sendLaboQuestion({ question, finance }) {
  const snapshot = buildFinanceSnapshot(finance, currentMonthISO(), todayISO());
  const payload = await apiClient.laboChat({ question, snapshot });
  return {
    answer: payload?.data?.answer || "I don't have that in your data yet.",
    provider: payload?.data?.provider || 'meta',
    model: payload?.data?.model || null,
    report: payload?.data?.report,
    signature: payload?.data?.signature,
    warnings: payload?.data?.warnings,
  };
}

export async function parseLaboTransaction({ text, categories }) {
  const payload = await apiClient.laboParse({
    text,
    categories,
    today: todayISO(),
  });
  const rawList = Array.isArray(payload?.data?.proposals)
    ? payload.data.proposals
    : payload?.data?.proposal
      ? [payload.data.proposal]
      : [];
  const proposals = rawList.map((item) => ({
    ...item,
    itemId: item.itemId || makeId('prop'),
  }));
  return {
    proposal: proposals[0] || null,
    proposals,
    provider: payload?.data?.provider || 'meta',
    model: payload?.data?.model || null,
  };
}

/**
 * Downscales and compresses a receipt/bill photo on the client so the
 * base64 payload sent to `/api/labo/scan` stays compact (~40–120KB).
 */
export async function compressReceiptImage(file, { maxDimension = 1024, quality = 0.78 } = {}) {
  if (!file) throw new Error('Please choose an image file.');
  if (!String(file.type || '').startsWith('image/')) {
    throw new Error('Please select a valid image file (JPEG, PNG, or WebP).');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Could not decode the selected image.'));
      img.src = objectUrl;
    });

    const srcW = img.naturalWidth || img.width || 800;
    const srcH = img.naturalHeight || img.height || 600;
    const scale = Math.min(1, maxDimension / Math.max(srcW, srcH, 1));
    const targetW = Math.max(1, Math.round(srcW * scale));
    const targetH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function scanLaboReceiptPhoto({
  imageDataUrl,
  categories,
  language = 'en-US',
  userHint = '',
}) {
  const payload = await apiClient.laboScan({
    image: imageDataUrl,
    categories,
    today: todayISO(),
    language,
    userHint,
  });
  const data = payload?.data || {};
  const rawList = Array.isArray(data.proposals)
    ? data.proposals
    : data.proposal
      ? [data.proposal]
      : [];
  const proposals = rawList.map((item) => ({
    ...item,
    itemId: item.itemId || makeId('prop'),
  }));
  return {
    proposal: proposals[0] || null,
    proposals,
    unreadable: Boolean(data.unreadable || proposals.length === 0),
    requiresMetaProvider: Boolean(data.requiresMetaProvider),
    message:
      data.message ||
      (proposals.length > 0
        ? `I read ${proposals[0].note} for ¥${Number(proposals[0].amount).toLocaleString('ja-JP')}.`
        : "I couldn't read a clear receipt or bill from that photo."),
    provider: data.provider || 'meta',
    model: data.model || null,
  };
}
