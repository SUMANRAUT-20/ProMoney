import { CategoryModel } from '../models/categoryModel.js';

const categoryName = (req) => typeof req.body?.name === 'string' ? req.body.name.trim() : '';
const invalidName = (name) => !name || name.length > 60;

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
      const name = categoryName(req);
      const kind = req.body?.kind;
      if (invalidName(name)) {
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

  async rename(req, res, next) {
    try {
      const name = categoryName(req);
      if (invalidName(name)) {
        return res.status(400).json({ error: 'name is required (1–60 characters)', status: 400 });
      }
      const renamed = await CategoryModel.rename(req.params.id, req.user.id, name);
      return res.json({ status: 'ok', data: renamed });
    } catch (err) {
      return next(err);
    }
  },

  async remove(req, res, next) {
    try {
      await CategoryModel.delete(req.params.id, req.user.id);
      return res.json({ status: 'ok', data: { deleted: true } });
    } catch (err) {
      return next(err);
    }
  },
};
