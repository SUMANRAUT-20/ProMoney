import { BillModel } from '../models/billModel.js';
import { addMonthsISO, iso, positiveYen } from '../services/financeMath.js';

const VALID_FREQUENCIES = ['monthly', 'yearly', 'one_time'];

/**
 * Bills Controller — Phase 2 Layer 1 Engine
 * Enforces Constitution Part G (G1–G5) and A5 (per-user isolation).
 */
export const billsController = {
  async list(req, res, next) {
    try {
      const rows = await BillModel.findByUser(req.user.id);
      return res.json({ status: 'ok', data: rows });
    } catch (err) {
      return next(err);
    }
  },

  async create(req, res, next) {
    try {
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      if (!name || name.length > 100) {
        return res.status(400).json({ error: 'name is required (1–100 characters)', status: 400 });
      }

      let amount;
      try {
        amount = positiveYen(req.body?.amount);
      } catch (err) {
        return res.status(400).json({ error: err.message, status: 400 });
      }

      let dueDate;
      try {
        dueDate = iso(String(req.body?.due_date || ''));
      } catch (err) {
        return res.status(400).json({ error: err.message, status: 400 });
      }

      const frequency = req.body?.frequency || 'monthly';
      if (!VALID_FREQUENCIES.includes(frequency)) {
        return res.status(400).json({
          error: `frequency must be one of: ${VALID_FREQUENCIES.join(', ')}`,
          status: 400,
        });
      }

      const created = await BillModel.create({
        userId: req.user.id,
        name,
        amount,
        dueDate,
        category: req.body?.category || 'Utilities',
        frequency,
        isPaid: Boolean(req.body?.is_paid),
        notes: req.body?.notes || '',
      });
      return res.status(201).json({ status: 'ok', data: created });
    } catch (err) {
      return next(err);
    }
  },

  async update(req, res, next) {
    try {
      const existing = await BillModel.findByIdAndUser(req.params.id, req.user.id);
      if (!existing) {
        return res.status(404).json({ error: 'Bill not found', status: 404 });
      }

      const updates = {};
      if (req.body?.name !== undefined) {
        const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
        if (!name || name.length > 100) {
          return res.status(400).json({ error: 'name must be 1–100 characters', status: 400 });
        }
        updates.name = name;
      }
      if (req.body?.amount !== undefined) {
        try {
          updates.amount = positiveYen(req.body.amount);
        } catch (err) {
          return res.status(400).json({ error: err.message, status: 400 });
        }
      }
      if (req.body?.due_date !== undefined) {
        try {
          updates.dueDate = iso(String(req.body.due_date));
        } catch (err) {
          return res.status(400).json({ error: err.message, status: 400 });
        }
      }
      if (req.body?.category !== undefined) updates.category = req.body.category;
      if (req.body?.frequency !== undefined) {
        if (!VALID_FREQUENCIES.includes(req.body.frequency)) {
          return res.status(400).json({
            error: `frequency must be one of: ${VALID_FREQUENCIES.join(', ')}`,
            status: 400,
          });
        }
        updates.frequency = req.body.frequency;
      }
      if (req.body?.is_paid !== undefined) updates.isPaid = Boolean(req.body.is_paid);
      if (req.body?.notes !== undefined) updates.notes = req.body.notes;

      const updated = await BillModel.update(req.params.id, req.user.id, updates);
      return res.json({ status: 'ok', data: updated });
    } catch (err) {
      return next(err);
    }
  },

  async togglePaid(req, res, next) {
    try {
      const existing = await BillModel.findByIdAndUser(req.params.id, req.user.id);
      if (!existing) {
        return res.status(404).json({ error: 'Bill not found', status: 404 });
      }
      const updated = await BillModel.update(req.params.id, req.user.id, {
        isPaid: !existing.is_paid,
      });
      return res.json({ status: 'ok', data: updated });
    } catch (err) {
      return next(err);
    }
  },

  async advanceCycle(req, res, next) {
    try {
      const existing = await BillModel.findByIdAndUser(req.params.id, req.user.id);
      if (!existing) {
        return res.status(404).json({ error: 'Bill not found', status: 404 });
      }
      const months = existing.frequency === 'yearly' ? 12 : 1;
      const updated = await BillModel.update(req.params.id, req.user.id, {
        dueDate: addMonthsISO(existing.due_date, months),
        isPaid: false,
      });
      return res.json({ status: 'ok', data: updated });
    } catch (err) {
      return next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const deleted = await BillModel.delete(req.params.id, req.user.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Bill not found', status: 404 });
      }
      return res.json({ status: 'ok', data: { deleted: true } });
    } catch (err) {
      return next(err);
    }
  },
};
