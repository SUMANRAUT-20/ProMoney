import { apiClient } from '../../services/api';
import { currentMonthISO, todayISO } from '../../utils/formatters';
import { buildFinanceSnapshot } from './buildSnapshot';

/**
 * LA-BO Frontend Service Module (Phase 4 Rule 4)
 *
 * All LA-BO network and snapshot operations live here (send, parse,
 * confirm, and future voice/import/report hooks) so React view components
 * never perform direct API or fetch calls.
 */

export const QUICK_QUESTIONS = [
  'How much did I spend this month?',
  'What is my biggest expense category?',
  'How much can I safely spend per day?',
  'Am I over budget anywhere?',
];

export async function sendLaboQuestion({ question, finance }) {
  const snapshot = buildFinanceSnapshot(finance, currentMonthISO(), todayISO());
  const payload = await apiClient.laboChat({ question, snapshot });
  return {
    answer: payload?.data?.answer || "I don't have that in your data yet.",
    provider: payload?.data?.provider || 'meta',
    model: payload?.data?.model || null,
  };
}

export async function parseLaboTransaction({ text, categories }) {
  const payload = await apiClient.laboParse({
    text,
    categories,
    today: todayISO(),
  });
  return {
    proposal: payload?.data?.proposal || null,
    provider: payload?.data?.provider || 'meta',
    model: payload?.data?.model || null,
  };
}
