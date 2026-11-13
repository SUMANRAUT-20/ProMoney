import { BudgetModel } from '../models/budgetModel.js';
import { CategoryModel } from '../models/categoryModel.js';
import { positiveYen } from '../services/financeMath.js';

/**
 * Budgets Controller — Phase 2 Layer 1 Engine
 * Enforces Constitution Part E and A5 (per-user isolation).
 */
export const budgetsController = {
  async list(req, res, next) {
    try {
      const month = req.query?.month ? String(req.query.month) : null;
      const rows = await BudgetModel.findByUser(req.user.id, month);
      return res.json({ status: 'ok', data: rows });
    } catch (err) {
      return next(err);
    }
  },

  async upsert(req, res, next) {
    try {
      const userId = req.user.id;
      const { category_id, category_name, budget_month, amount_limit } = req.body || {};

      if ((!category_id && !category_name) || !budget_month || amount_limit === undefined) {
        return res.status(400).json({
          error: 'category_id (or category_name), budget_month, and amount_limit are required',
          status: 400,
        });
      }

      const monthDate = BudgetModel.normalizeMonthDate(budget_month);
      if (!monthDate) {
        return res.status(400).json({
          error: 'budget_month must be YYYY-MM or YYYY-MM-DD',
          status: 400,
        });
      }

      let limit;
      try {
        limit = positiveYen(amount_limit);
      } catch (err) {
        return res.status(400).json({ error: err.message, status: 400 });
      }

      let category = null;
      if (category_id !== undefined && category_id !== null && category_id !== '') {
        const numId = Number(category_id);
        if (Number.isSafeInteger(numId) && numId > 0) {
          category = await CategoryModel.findByIdAndUser(numId, userId);
          if (!category) {
            return res.status(400).json({
              error: 'Category not found or does not belong to user',
              status: 400,
            });
          }
        }
      }
      if (!category && typeof category_name === 'string' && category_name.trim()) {
        category = await CategoryModel.findByNameAndUser(category_name.trim(), 'expense', userId);
        if (!category) {
          category = await CategoryModel.create({
            userId,
            name: category_name.trim(),
            kind: 'expense',
          });
        }
      }
      if (!category) {
        return res.status(400).json({ error: 'Valid expense category is required', status: 400 });
      }

      const saved = await BudgetModel.upsert({
        userId,
        categoryId: category.id,
        budgetMonth: monthDate,
        amountLimit: limit,
      });
      return res.json({ status: 'ok', data: saved });
    } catch (err) {
      return next(err);
    }
  },

  async updateById(req, res, next) {
    try {
      let limit;
      try {
        limit = positiveYen(req.body?.amount_limit);
      } catch (err) {
        return res.status(400).json({ error: err.message, status: 400 });
      }
      const updated = await BudgetModel.updateById(req.params.id, req.user.id, { amountLimit: limit });
      if (!updated) {
        return res.status(404).json({ error: 'Budget not found', status: 404 });
      }
      return res.json({ status: 'ok', data: updated });
    } catch (err) {
      return next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const deleted = await BudgetModel.delete(req.params.id, req.user.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Budget not found', status: 404 });
      }
      return res.json({ status: 'ok', data: { deleted: true } });
    } catch (err) {
      return next(err);
    }
  },
};
