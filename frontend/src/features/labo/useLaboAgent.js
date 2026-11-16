import { useCallback, useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { QUICK_QUESTIONS, parseLaboTransaction, sendLaboQuestion } from './laboService';

/**
 * useLaboAgent Hook (Phase 4 Rule 4)
 *
 * Encapsulates all LA-BO behaviour (chat send, transaction parse ->
 * confirm -> save per Constitution K2, and error handling) so LaboView
 * only renders state and invokes callbacks.
 */
export function useLaboAgent() {
  const finance = useFinance();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pendingProposal, setPendingProposal] = useState(null);

  const ask = useCallback(
    async (questionText) => {
      const question = (questionText ?? input).trim();
      if (!question || busy) return;
      setError('');
      setInput('');
      setBusy(true);
      setMessages((prev) => [...prev, { role: 'user', text: question }]);
      try {
        const { answer } = await sendLaboQuestion({ question, finance });
        setMessages((prev) => [...prev, { role: 'ai', text: answer }]);
      } catch (err) {
        if (err.status === 503) {
          setError('AI is not switched on yet — the server needs its AI API key in backend/.env.');
        } else if (err.status === 401) {
          setError('Please log in again, then ask LA-BO.');
        } else {
          setError('LA-BO could not answer just now. Please try again.');
        }
      } finally {
        setBusy(false);
      }
    },
    [input, busy, finance]
  );

  const parseEntry = useCallback(
    async (rawText) => {
      const text = (rawText ?? input).trim();
      if (!text || busy) return null;
      setError('');
      setBusy(true);
      try {
        const { proposal } = await parseLaboTransaction({
          text,
          categories: finance.categories || [],
        });
        setPendingProposal(proposal);
        return proposal;
      } catch (err) {
        setError(err.message || 'Could not parse transaction proposal.');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [input, busy, finance.categories]
  );

  const confirmProposal = useCallback(async () => {
    if (!pendingProposal) return null;
    const saved = await finance.addTransaction({
      ...pendingProposal,
      title: pendingProposal.note || pendingProposal.category_name,
    });
    setPendingProposal(null);
    return saved;
  }, [pendingProposal, finance]);

  const dismissProposal = useCallback(() => {
    setPendingProposal(null);
  }, []);

  return {
    messages,
    input,
    setInput,
    busy,
    error,
    pendingProposal,
    quickQuestions: QUICK_QUESTIONS,
    ask,
    parseEntry,
    confirmProposal,
    dismissProposal,
  };
}
