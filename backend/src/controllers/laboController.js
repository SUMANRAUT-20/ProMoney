/**
 * ProMoney LA-BO Controller (Phase 4 & Phase 6 Branch 1: Multi-Add Parse).
 * Joint Owners: Arpan Khatiwada & Suman Raut
 *
 * Chat uses Muse Wonder with Ember fallback. Photo extraction uses Ember.
 */
import { parseTransactionWithLabo, scanReceiptWithLabo } from '../services/laboChat.js';
import { getLaboShortcut } from './laboInsights.js';
import { MemoryModel } from '../models/memoryModel.js';
import { memoryCategory } from '../services/nidhiMemory.js';
import { requestedImportGuidance } from '../services/nidhiTools.js';
import { chatForUser } from './nidhiChatContext.js';

export const laboController = {
  async chat(req, res, next) {
    try {
      const { question, history } = req.body ?? {};
      if (typeof question !== 'string' || !question.trim()) {
        return res.status(400).json({ error: 'question is required', status: 400 });
      }
      if (question.length > 500) {
        return res.status(400).json({ error: 'question is too long (max 500 characters)', status: 400 });
      }
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Sign in to chat with Nidhi.', status: 401 });
      const text = question.trim();
      const guidance = requestedImportGuidance(text);
      const data = guidance ? { answer: guidance }
        : await getLaboShortcut(text, userId) || await chatForUser({ userId, question: text, history });
      return res.set('Cache-Control', 'no-store').json({ status: 'ok', data });
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
      const { wordMap } = await MemoryModel.findByUser(req.user?.id);
      const { proposals, provider, model } = await parseTransactionWithLabo({
        text: text.trim(),
        categories: cleanCategories,
        today: todayISO,
        wordMap,
      });
      const classified = proposals.map((proposal) => {
        const category = memoryCategory(proposal.note, proposal.kind, cleanCategories, wordMap)
          || (proposals.length === 1 && memoryCategory(text, proposal.kind, cleanCategories, wordMap));
        return category ? { ...proposal, category_id: category.id, category_name: category.name } : proposal;
      });
      return res.json({ status: 'ok', data: { proposal: classified[0] ?? null, proposals: classified, provider, model } });
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

  // POST /api/labo/scan — Feature Spec F3: reads a downscaled bill/receipt
  // photo via Muse Ember vision and returns a proposal for the confirm card.
  // Never saves any transaction by itself (Constitution K2).
  async scan(req, res, next) {
    try {
      const { image, categories, today, language, userHint } = req.body ?? {};
      if (typeof image !== 'string' || !/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(image)) {
        return res.status(400).json({
          error: 'image must be a base64 data:image/(jpeg|png|webp) URL',
          status: 400,
        });
      }
      if (image.length > 1800000) {
        return res.status(400).json({
          error: 'image payload is too large (max ~1.3MB compressed)',
          status: 400,
        });
      }
      if (!Array.isArray(categories) || categories.length === 0) {
        return res.status(400).json({ error: 'categories are required', status: 400 });
      }
      const cleanCategories = categories
        .filter((c) => c && (c.kind === 'income' || c.kind === 'expense') && typeof c.name === 'string')
        .slice(0, 40)
        .map((c) => ({ id: c.id, name: c.name.slice(0, 60), kind: c.kind }));
      const todayISO = /^\d{4}-\d{2}-\d{2}$/.test(String(today))
        ? String(today)
        : new Date().toISOString().slice(0, 10);

      const scanResult = await scanReceiptWithLabo({
        imageDataUrl: image.trim(),
        categories: cleanCategories,
        today: todayISO,
        language: typeof language === 'string' ? language : 'en-US',
        userHint: typeof userHint === 'string' ? userHint.slice(0, 200) : '',
      });

      return res.json({ status: 'ok', data: scanResult });
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
};
