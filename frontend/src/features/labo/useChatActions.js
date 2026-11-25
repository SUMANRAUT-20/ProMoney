import { useState } from 'react';
import { apiClient } from '../../services/api';
import { makeId } from '../../utils/formatters';
import { actionEntities } from './chatActionFields';
import { chatActionLabel, confirmChatAction, makeChatProposal } from './chatActionProposal';

export function useChatActions({ finance, setMessages, setBusy, setError }) {
  const [pending, setPending] = useState(null);
  const reply = (text) => setMessages((previous) => [...previous, { id: makeId('msg'), role: 'ai', text }]);

  const cancel = () => {
    setPending(null);
    reply('Action cancelled.');
  };

  function preview(action) {
    if (pending) return 'Confirm or cancel the current action first.';
    const result = makeChatProposal(action, finance);
    if (result.question) return result.question;
    setPending({ ...result.proposal, id: makeId('action') });
    return null;
  }

  async function confirm(draft, step) {
    setBusy(true);
    setError('');
    try {
      const result = await confirmChatAction(pending, draft, finance, async (payload) => {
        await apiClient.createCategory(payload);
        await finance.refreshFinanceData();
      }, step);
      if (result.saved) {
        const verb = { create: 'Created', edit: 'Updated', delete: 'Deleted' }[pending.operation];
        reply(`${verb} ${actionEntities[pending.entity].label} “${chatActionLabel(pending, draft)}”.`);
        setPending(null);
      }
      return result;
    } finally {
      setBusy(false);
    }
  }

  return { pending, preview, confirm, cancel };
}
