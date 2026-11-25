import { useState } from 'react';
import { apiClient } from '../../services/api';
import { makeId } from '../../utils/formatters';
import { isRecordAction } from './laboIntent';
import { actionEntities } from './chatActionFields';
import { chatActionLabel, confirmChatAction, makeChatProposal } from './chatActionProposal';

export function useChatActions({ finance, setMessages, setBusy, setError }) {
  const [pending, setPending] = useState(null);
  const [clarification, setClarification] = useState('');
  const reply = (text) => setMessages((previous) => [...previous, { id: makeId('msg'), role: 'ai', text }]);

  const cancel = () => {
    setPending(null);
    setClarification('');
    reply('Action cancelled.');
  };

  async function preview(question, replyToPreview) {
    if (clarification && /^cancel[.!]?$/i.test(question)) return cancel();
    if (pending) return replyToPreview('Confirm or cancel the current action first.');
    const text = isRecordAction(question) || !clarification ? question : `${clarification}\nClarification: ${question}`;
    if (text.length > 500) {
      setClarification('');
      return replyToPreview('Can you restate the action and the record details in one short message?');
    }
    const { data } = await apiClient.previewLaboAction(text);
    const result = makeChatProposal(data.action, finance);
    if (result.question) {
      setClarification(text);
      return replyToPreview(result.question);
    }
    setClarification('');
    setPending({ ...result.proposal, id: makeId('action') });
    return replyToPreview('Review the proposed change below.');
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

  return { pending, matches: (question) => Boolean(clarification) || isRecordAction(question), preview, confirm, cancel };
}
