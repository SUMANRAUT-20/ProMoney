import { CategoryModel } from '../models/categoryModel.js';

/**
 * Categories Controller — Phase 2 Layer 1 Engine
 * Every endpoint requires authentication (requireAuth).
 */
export const categoriesController = {
  async list(req, res, next) {
    try {
      const rows = await CategoryModel.findByUser(req.user.id);
      return res.json({ status: 'ok', data: rows });
    } catch (err) {
      return next(err);
    }
  },

  async create(req, res, next) {
    try {
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      const kind = req.body?.kind;
      if (!name || name.length > 60) {
        return res.status(400).json({ error: 'name is required (1–60 characters)', status: 400 });
      }
      if (!['income', 'expense'].includes(kind)) {
        return res.status(400).json({ error: 'kind must be income or expense', status: 400 });
      }
      const created = await CategoryModel.create({ userId: req.user.id, name, kind });
      return res.status(201).json({ status: 'ok', data: created });
    } catch (err) {
      return next(err);
    }
  },
};
