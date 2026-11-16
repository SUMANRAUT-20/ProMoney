/**
 * ProMoney LA-BO Controller (Phase 4 & Phase 6 Branch 1: Multi-Add Parse).
 * Joint Owners: Arpan Khatiwada & Suman Raut
 *
 * Uses `askLabo` and `parseTransactionWithLabo`, which route to Meta
 * Model API (`muse-ember-1.0`, primary) or Groq (`openai/gpt-oss-120b`,
 * fallback) based on `AI_PROVIDER` in root `.env`.
 */
import { askLabo, parseTransactionWithLabo } from '../services/laboChat.js';

export const laboController = {
  async chat(req, res, next) {
    try {
      const { question, snapshot } = req.body ?? {};
      if (typeof question !== 'string' || !question.trim()) {
        return res.status(400).json({ error: 'question is required', status: 400 });
      }
      if (question.length > 500) {
        return res.status(400).json({ error: 'question is too long (max 500 characters)', status: 400 });
      }
      if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
        return res.status(400).json({ error: 'snapshot (finance data) is required', status: 400 });
      }
      const { answer, provider, model } = await askLabo({
        question: question.trim(),
        snapshot,
      });
      return res.json({ status: 'ok', data: { answer, provider, model } });
    } catch (err) {
      if (err.code === 'GROQ_UPSTREAM' || err.code === 'META_UPSTREAM') {
        return res.status(502).json({ error: 'The AI service is busy right now. Please try again.', status: 502 });
      }
      if (err.code === 'LABO_NOT_CONFIGURED') {
        return res.status(503).json({ error: err.message || 'AI is not configured yet.', status: 503 });
      }
      return next(err);
    }
  },

  // POST /api/labo/parse — reads a single or multi-item "add transaction"
  // sentence in any language and returns PROPOSALS (`proposal` + `proposals`).
  // Nothing is saved here: the client shows the confirm card and only saves
  // after the user confirms (Constitution K2, Feature Spec F5).
  async parse(req, res, next) {
    try {
      const { text, categories, today } = req.body ?? {};
      if (typeof text !== 'string' || !text.trim() || text.length > 500) {
        return res.status(400).json({ error: 'text is required (max 500 characters)', status: 400 });
      }
      if (!Array.isArray(categories) || categories.length === 0) {
        return res.status(400).json({ error: 'categories are required', status: 400 });
      }
      const cleanCategories = categories
        .filter((c) => c && (c.kind === 'income' || c.kind === 'expense') && typeof c.name === 'string')
        .slice(0, 40)
        .map((c) => ({ id: c.id, name: c.name.slice(0, 60), kind: c.kind }));
      const todayISO = /^\d{4}-\d{2}-\d{2}$/.test(String(today)) ? String(today) : new Date().toISOString().slice(0, 10);
      const { proposal, proposals, provider, model } = await parseTransactionWithLabo({
        text: text.trim(),
        categories: cleanCategories,
        today: todayISO,
      });
      return res.json({ status: 'ok', data: { proposal, proposals, provider, model } });
    } catch (err) {
      if (err.code === 'GROQ_UPSTREAM' || err.code === 'META_UPSTREAM') {
        return res.status(502).json({ error: 'The AI service is busy right now. Please try again.', status: 502 });
      }
      if (err.code === 'LABO_NOT_CONFIGURED') {
        return res.status(503).json({ error: err.message || 'AI is not configured yet.', status: 503 });
      }
      return next(err);
    }
  }
};
