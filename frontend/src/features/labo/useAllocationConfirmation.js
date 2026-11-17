import { useRef } from 'react';
import { apiClient } from '../../services/api';
import { makeId } from '../../utils/formatters';

export function useAllocationConfirmation({ finance, busy, setBusy, setError, setMessages }) {
  const saving = useRef(false);

  return async (messageId, proposal) => {
    if (busy || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError('');
    const closeCard = () => setMessages((previous) => previous.map((message) =>
      message.id === messageId ? { ...message, allocationClosed: true } : message));
    try {
      const { data } = await apiClient.laboChat({ question: 'What can I do with my money?' });
      const current = data.allocation?.proposals.some((item) => JSON.stringify(item) === JSON.stringify(proposal));
      if (!current) {
        closeCard();
        setError('Your plan changed. Ask for a fresh allocation before recording it.');
        return;
      }
      const saved = proposal.kind === 'goal'
        ? await finance.contributeGoal(proposal.id, proposal.amount)
        : await finance.addTransaction({
          kind: 'transfer', account_id: proposal.sourceId, to_account_id: proposal.id,
          amount: proposal.amount, transaction_date: proposal.date, note: `Payment to ${proposal.name}`,
        });
      closeCard();
      setMessages((previous) => [...previous, {
        id: makeId('msg'), role: 'ai',
        text: proposal.kind === 'goal' ? 'I recorded your goal contribution.' : 'I recorded your debt payment.',
        savedIds: proposal.kind === 'debt' ? [saved.id] : [],
      }]);
    } catch (error) {
      closeCard();
      setError(error.message || 'Check your records before requesting another allocation.');
    } finally {
      setBusy(false);
      saving.current = false;
    }
  };
}
