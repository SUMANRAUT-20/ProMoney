/**
 * ProMoney LA-BO Controller (Phase 5, module 1: AI Chat Assistant).
 * Joint Owners: Arpan Khatiwada & Suman Raut
 *
 * POST /api/labo/chat — body: { question, snapshot }.
 * The snapshot is calculated by the app's own finance math on the client;
 * this controller never reads or writes financial tables itself.
 */
import { askGroq, parseTransactionWithGroq } from '../services/laboChat.js';

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
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: 'AI is not configured yet (GROQ_API_KEY is missing on the server).',
          status: 503
        });
      }
      const answer = await askGroq({ question: question.trim(), snapshot, apiKey });
      return res.json({ status: 'ok', data: { answer } });
    } catch (err) {
      if (err.code === 'GROQ_UPSTREAM') {
        return res.status(502).json({ error: 'The AI service is busy right now. Please try again.', status: 502 });
      }
      if (err.code === 'LABO_NOT_CONFIGURED') {
        return res.status(503).json({ error: 'AI is not configured yet.', status: 503 });
      }
      return next(err);
    }
  },

  // POST /api/labo/parse — reads an "add transaction" sentence in any
  // language and returns a PROPOSAL. Nothing is saved here: the client
  // shows the proposal and only saves after the user confirms.
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
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: 'AI is not configured yet (GROQ_API_KEY is missing on the server).',
          status: 503
        });
      }
      const todayISO = /^\d{4}-\d{2}-\d{2}$/.test(String(today)) ? String(today) : new Date().toISOString().slice(0, 10);
      const proposal = await parseTransactionWithGroq({
        text: text.trim(),
        categories: cleanCategories,
        today: todayISO,
        apiKey
      });
      return res.json({ status: 'ok', data: { proposal } });
    } catch (err) {
      if (err.code === 'GROQ_UPSTREAM') {
        return res.status(502).json({ error: 'The AI service is busy right now. Please try again.', status: 502 });
      }
      if (err.code === 'LABO_NOT_CONFIGURED') {
        return res.status(503).json({ error: 'AI is not configured yet.', status: 503 });
      }
      return next(err);
    }
  }
};
