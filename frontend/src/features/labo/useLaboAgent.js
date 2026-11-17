import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFinance } from '../../context/FinanceContext';
import { makeId, money } from '../../utils/formatters';
import { useStatementImport } from './useStatementImport';
import {
  QUICK_QUESTIONS,
  compressReceiptImage,
  createSpeechRecognizer,
  isSpeechRecognitionSupported,
  isUndoCommand,
  loadVoiceLang,
  loadVoiceMuted,
  looksLikeAddIntent,
  parseLaboTransaction,
  saveVoiceLang,
  saveVoiceMuted,
  scanLaboReceiptPhoto,
  sendLaboQuestion,
  speakLaboReply,
  stopLaboSpeech,
} from './laboService';

/**
 * useLaboAgent Hook (Phase 4 & Phase 6 Branch 1: Voice, Multi-Add, Undo)
 *
 * Owns all LA-BO state and actions:
 * - Chat Q&A (`ask`) with spoken replies via Web Speech Synthesis (`voiceMuted` toggle)
 * - Voice recognition (`toggleListening`, `voiceLang`) via Web Speech Recognition
 * - Multi-add transaction parsing (`pendingProposals`, `removeProposalItem`)
 * - Confirm-before-save (`confirmProposal`) — voice or text alone never saves (K2)
 * - One-tap Undo (`undoSave`) deleting the exact saved record IDs via the API (F6)
 */
export function useLaboAgent() {
  const finance = useFinance();
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pendingProposals, setPendingProposals] = useState([]);
  const statement = useStatementImport({ busy, setBusy, setError, setMessages, finance });

  const [voiceMuted, setVoiceMuted] = useState(loadVoiceMuted);
  const [voiceLang, setVoiceLangState] = useState(loadVoiceLang);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const recognizerRef = useRef(null);
  const initialQueryHandledRef = useRef(false);
  const speechSupported = isSpeechRecognitionSupported();

  const toggleVoiceMuted = useCallback(() => {
    setVoiceMuted((prev) => {
      const next = !prev;
      saveVoiceMuted(next);
      if (next) {
        stopLaboSpeech();
        setIsSpeaking(false);
      }
      return next;
    });
  }, []);

  const setVoiceLang = useCallback((lang) => {
    const next = lang === 'ja-JP' ? 'ja-JP' : 'en-US';
    setVoiceLangState(next);
    saveVoiceLang(next);
  }, []);

  const speak = useCallback(
    (text) => {
      speakLaboReply(text, {
        muted: voiceMuted,
        preferredLang: voiceLang,
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
      });
    },
    [voiceMuted, voiceLang]
  );

  // Undo a specific saved message (or the latest saved message if no id passed)
  const undoSave = useCallback(
    async (targetMessageId = null) => {
      const targetMsg = targetMessageId
        ? messages.find((m) => m.id === targetMessageId && m.savedIds?.length && !m.undone)
        : [...messages].reverse().find((m) => m.savedIds?.length && !m.undone);

      if (!targetMsg) {
        const noUndoText = 'There is no recent LA-BO save to undo.';
        setMessages((prev) => [...prev, { id: makeId('msg'), role: 'ai', text: noUndoText }]);
        speak(noUndoText);
        return false;
      }

      setBusy(true);
      setError('');
      try {
        for (const txId of targetMsg.savedIds) {
          await finance.removeTransaction(txId);
        }
        setMessages((prev) =>
          prev.map((m) => (m.id === targetMsg.id ? { ...m, undone: true } : m))
        );
        const undoneReply = `Undone — removed ${targetMsg.savedIds.length} ${
          targetMsg.savedIds.length === 1 ? 'record' : 'records'
        }.`;
        speak(undoneReply);
        return true;
      } catch (err) {
        setError(err.message || 'Could not undo the saved transaction(s).');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [messages, finance, speak]
  );

  const ask = useCallback(
    async (questionText) => {
      const question = (questionText ?? input).trim();
      if (!question || busy) return;
      setError('');
      setInput('');

      setMessages((prev) => [...prev, { id: makeId('msg'), role: 'user', text: question }]);

      if (isUndoCommand(question)) {
        await undoSave(null);
        return;
      }

      setBusy(true);
      try {
        // Check if the message is adding one or more transactions (F1 / F5)
        if (looksLikeAddIntent(question)) {
          const { proposals } = await parseLaboTransaction({
            text: question,
            categories: finance.categories || [],
          });
          if (proposals.length > 0) {
            setPendingProposals(proposals);
            const totalYen = proposals.reduce((sum, p) => sum + Number(p.amount || 0), 0);
            const summaryText =
              proposals.length === 1
                ? `I prepared 1 ${proposals[0].kind} proposal: ${money(proposals[0].amount)} for ${proposals[0].category_name} (${proposals[0].note}). Tap "Confirm & Save" below to record it.`
                : `I prepared ${proposals.length} proposals totaling ${money(totalYen)}. You can remove any item below before tapping "Confirm & Save".`;
            setMessages((prev) => [...prev, { id: makeId('msg'), role: 'ai', text: summaryText }]);
            speak(summaryText);
            return;
          }
        }

        const { answer } = await sendLaboQuestion({ question, finance });
        setMessages((prev) => [...prev, { id: makeId('msg'), role: 'ai', text: answer }]);
        speak(answer);
      } catch (err) {
        if (err.status === 503) {
          setError('AI is not switched on yet — the server needs its AI API key in the root .env.');
        } else if (err.status === 401) {
          setError('Please log in again, then ask LA-BO.');
        } else {
          setError('LA-BO could not answer just now. Please try again.');
        }
      } finally {
        setBusy(false);
      }
    },
    [input, busy, finance, speak, undoSave]
  );

  const parseEntry = useCallback(
    async (rawText) => {
      const text = (rawText ?? input).trim();
      if (!text || busy) return [];
      setError('');
      setBusy(true);
      try {
        const { proposals } = await parseLaboTransaction({
          text,
          categories: finance.categories || [],
        });
        setPendingProposals(proposals);
        return proposals;
      } catch (err) {
        setError(err.message || 'Could not parse transaction proposal.');
        return [];
      } finally {
        setBusy(false);
      }
    },
    [input, busy, finance.categories]
  );

  const removeProposalItem = useCallback((itemId) => {
    setPendingProposals((prev) => prev.filter((item) => item.itemId !== itemId));
  }, []);

  const updateProposalItem = useCallback(
    (itemId, patch) => {
      setPendingProposals((prev) =>
        prev.map((item) => {
          if (item.itemId !== itemId) return item;
          const next = { ...item, ...patch };
          if (patch.kind !== undefined && patch.category_id === undefined) {
            const firstCat = (finance.categories || []).find((c) => c.kind === patch.kind);
            if (firstCat) {
              next.category_id = firstCat.id;
              next.category_name = firstCat.name;
            }
          } else if (patch.category_id !== undefined) {
            const matchedCat = (finance.categories || []).find(
              (c) => String(c.id) === String(patch.category_id)
            );
            if (matchedCat) {
              next.category_id = matchedCat.id;
              next.category_name = matchedCat.name;
            }
          }
          return next;
        })
      );
    },
    [finance.categories]
  );

  const scanPhoto = useCallback(
    async (file) => {
      if (!file || busy) return null;
      setError('');
      const hint = input.trim();
      setInput('');
      setMessages((prev) => [
        ...prev,
        {
          id: makeId('msg'),
          role: 'user',
          text: `📷 Attached receipt/bill photo: ${file.name || 'photo.jpg'}${hint ? ` (${hint})` : ''}`,
        },
      ]);
      setBusy(true);
      try {
        const imageDataUrl = await compressReceiptImage(file);
        const result = await scanLaboReceiptPhoto({
          imageDataUrl,
          categories: finance.categories || [],
          language: voiceLang,
          userHint: hint,
        });

        if (!result.unreadable && result.proposals.length > 0) {
          setPendingProposals(result.proposals);
        } else {
          setPendingProposals([]);
        }
        setMessages((prev) => [...prev, { id: makeId('msg'), role: 'ai', text: result.message }]);
        speak(result.message);
        return result;
      } catch (err) {
        if (err.status === 503) {
          setError('AI is not switched on yet — the server needs its META_API_KEY in the root .env.');
        } else {
          setError(err.message || 'Could not scan that photo right now. Please try again.');
        }
        return null;
      } finally {
        setBusy(false);
      }
    },
    [busy, input, finance.categories, voiceLang, speak]
  );

  const confirmProposal = useCallback(async () => {
    if (pendingProposals.length === 0 || busy) return [];
    for (const item of pendingProposals) {
      const amt = Math.round(Number(item.amount));
      if (!Number.isSafeInteger(amt) || amt <= 0) {
        setError('Every proposed item must have a positive whole-yen JPY amount.');
        return [];
      }
      if (!String(item.note || '').trim()) {
        setError('Every proposed item needs a short payee or title.');
        return [];
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(item.transaction_date || ''))) {
        setError('Every proposed item must have a valid YYYY-MM-DD date.');
        return [];
      }
    }
    setBusy(true);
    setError('');
    try {
      const savedRecords = [];
      const defaultAccId = finance.accounts?.[0]?.id ? String(finance.accounts[0].id) : null;
      for (const item of pendingProposals) {
        const cleanAmt = Math.round(Number(item.amount));
        const cleanNote = String(item.note || item.category_name).trim().slice(0, 120);
        const created = await finance.addTransaction({
          kind: item.kind,
          amount: cleanAmt,
          category_id: item.category_id,
          category_name: item.category_name,
          account_id: defaultAccId,
          transaction_date: item.transaction_date,
          note: cleanNote,
          title: cleanNote,
        });
        if (created?.id !== undefined) savedRecords.push(created);
      }
      const totalAmt = pendingProposals.reduce((s, p) => s + Math.round(Number(p.amount || 0)), 0);
      const label =
        pendingProposals.length === 1
          ? `Added ${money(Math.round(Number(pendingProposals[0].amount)))} ${pendingProposals[0].category_name} (${String(pendingProposals[0].note).trim()})`
          : `Added ${pendingProposals.length} transactions (${money(totalAmt)} total)`;

      setPendingProposals([]);
      setMessages((prev) => [
        ...prev,
        {
          id: makeId('msg'),
          role: 'ai',
          text: label,
          savedIds: savedRecords.map((r) => r.id),
          undone: false,
        },
      ]);
      speak(label);
      return savedRecords;
    } catch (err) {
      setError(err.message || 'Could not save confirmed transactions.');
      return [];
    } finally {
      setBusy(false);
    }
  }, [pendingProposals, busy, finance, speak]);

  const dismissProposal = useCallback(() => {
    setPendingProposals([]);
  }, []);

  const toggleListening = useCallback(() => {
    if (!speechSupported) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }
    if (isListening && recognizerRef.current) {
      recognizerRef.current.stop();
      setIsListening(false);
      return;
    }
    setError('');
    const recognizer = createSpeechRecognizer({
      lang: voiceLang,
      onTranscript: (transcript) => {
        if (transcript) setInput(transcript);
      },
      onEnd: () => {
        setIsListening(false);
      },
      onError: (errCode) => {
        setIsListening(false);
        if (errCode !== 'no-speech' && errCode !== 'aborted') {
          setError(`Microphone error (${errCode}). Check browser mic permissions.`);
        }
      },
    });
    if (recognizer) {
      recognizerRef.current = recognizer;
      setIsListening(true);
      recognizer.start();
    }
  }, [speechSupported, isListening, voiceLang]);

  useEffect(() => {
    return () => {
      stopLaboSpeech();
      if (recognizerRef.current) {
        try {
          recognizerRef.current.abort();
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, []);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q && !initialQueryHandledRef.current) {
      initialQueryHandledRef.current = true;
      setSearchParams({}, { replace: true });
      ask(q);
    }
  }, [searchParams, setSearchParams, ask]);

  return {
    messages,
    input,
    setInput,
    busy,
    error,
    pendingProposal: pendingProposals[0] || null,
    pendingProposals,
    quickQuestions: QUICK_QUESTIONS,
    voiceMuted,
    toggleVoiceMuted,
    voiceLang,
    setVoiceLang,
    isListening,
    isSpeaking,
    speechSupported,
    toggleListening,
    ask,
    parseEntry,
    scanPhoto,
    updateProposalItem,
    removeProposalItem,
    confirmProposal,
    dismissProposal,
    undoSave,
    categories: finance.categories || [],
    statement,
  };
}
