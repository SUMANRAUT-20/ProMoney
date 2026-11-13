import { GoalModel } from '../models/goalModel.js';
import { calculateGoalProgress, iso, positiveYen, yen } from '../services/financeMath.js';

function withProgress(goal) {
  if (!goal) return null;
  const prog = calculateGoalProgress(goal);
  return {
    ...goal,
    progress_percent: prog.progress_percent,
    bar_percent: prog.bar_percent,
    completed: prog.completed,
    progress_label: prog.label || `${prog.progress_percent}%`,
  };
}

/**
 * Goals Controller — Phase 2 Layer 1 Engine
 * Enforces Constitution Part H (including H3 ¥0-target guard) and A5.
 */
export const goalsController = {
  async list(req, res, next) {
    try {
      const rows = await GoalModel.findByUser(req.user.id);
      return res.json({ status: 'ok', data: rows.map(withProgress) });
    } catch (err) {
      return next(err);
    }
  },

  async create(req, res, next) {
    try {
      const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
      if (!title || title.length > 100) {
        return res.status(400).json({ error: 'title is required (1–100 characters)', status: 400 });
      }
      if (req.body?.target_amount === undefined) {
        return res.status(400).json({ error: 'title and target_amount are required', status: 400 });
      }

      let targetAmount;
      let savedAmount;
      let monthlyPlan;
      try {
        targetAmount = yen(req.body.target_amount);
        savedAmount = yen(req.body?.saved_amount ?? 0);
        monthlyPlan = yen(req.body?.monthly_plan ?? 0);
      } catch (err) {
        return res.status(400).json({ error: err.message, status: 400 });
      }

      let targetDate = null;
      if (req.body?.target_date) {
        try {
          targetDate = iso(String(req.body.target_date));
        } catch (err) {
          return res.status(400).json({ error: err.message, status: 400 });
        }
      }

      const created = await GoalModel.create({
        userId: req.user.id,
        title,
        icon: req.body?.icon || null,
        targetAmount,
        savedAmount,
        monthlyPlan,
        targetDate,
      });
      return res.status(201).json({ status: 'ok', data: withProgress(created) });
    } catch (err) {
      return next(err);
    }
  },

  async update(req, res, next) {
    try {
      const existing = await GoalModel.findByIdAndUser(req.params.id, req.user.id);
      if (!existing) {
        return res.status(404).json({ error: 'Goal not found', status: 404 });
      }

      const updates = {};
      if (req.body?.title !== undefined) {
        const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
        if (!title || title.length > 100) {
          return res.status(400).json({ error: 'title must be 1–100 characters', status: 400 });
        }
        updates.title = title;
      }
      if (req.body?.target_amount !== undefined) {
        try {
          updates.targetAmount = yen(req.body.target_amount);
        } catch (err) {
          return res.status(400).json({ error: err.message, status: 400 });
        }
      }
      if (req.body?.saved_amount !== undefined) {
        try {
          updates.savedAmount = yen(req.body.saved_amount);
        } catch (err) {
          return res.status(400).json({ error: err.message, status: 400 });
        }
      }
      if (req.body?.monthly_plan !== undefined) {
        try {
          updates.monthlyPlan = yen(req.body.monthly_plan);
        } catch (err) {
          return res.status(400).json({ error: err.message, status: 400 });
        }
      }
      if (req.body?.target_date !== undefined) {
        if (req.body.target_date === null || req.body.target_date === '') {
          updates.targetDate = null;
        } else {
          try {
            updates.targetDate = iso(String(req.body.target_date));
          } catch (err) {
            return res.status(400).json({ error: err.message, status: 400 });
          }
        }
      }

      const updated = await GoalModel.update(req.params.id, req.user.id, updates);
      return res.json({ status: 'ok', data: withProgress(updated) });
    } catch (err) {
      return next(err);
    }
  },

  async contribute(req, res, next) {
    try {
      let amount;
      try {
        amount = positiveYen(req.body?.amount);
      } catch (err) {
        return res.status(400).json({ error: 'amount is required and must be a positive integer JPY', status: 400 });
      }
      const updated = await GoalModel.contribute(req.params.id, req.user.id, amount);
      if (!updated) {
        return res.status(404).json({ error: 'Goal not found', status: 404 });
      }
      return res.json({ status: 'ok', data: withProgress(updated) });
    } catch (err) {
      return next(err);
    }
  },

  async withdraw(req, res, next) {
    try {
      let amount;
      try {
        amount = positiveYen(req.body?.amount);
      } catch {
        return res.status(400).json({ error: 'amount is required and must be a positive integer JPY', status: 400 });
      }
      const updated = await GoalModel.withdraw(req.params.id, req.user.id, amount);
      if (!updated) {
        return res.status(404).json({ error: 'Goal not found', status: 404 });
      }
      return res.json({ status: 'ok', data: withProgress(updated) });
    } catch (err) {
      return next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const deleted = await GoalModel.delete(req.params.id, req.user.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Goal not found', status: 404 });
      }
      return res.json({ status: 'ok', data: { deleted: true } });
    } catch (err) {
      return next(err);
    }
  },
};
