import { AccountModel } from '../models/accountModel.js';
import { ASSET_ACCOUNT_KINDS, LIABILITY_ACCOUNT_KINDS } from '../services/financeMath.js';

const VALID_ACCOUNT_KINDS = [...ASSET_ACCOUNT_KINDS, ...LIABILITY_ACCOUNT_KINDS];

function parseNonNegYen(val) {
  const num = Number(val);
  if (!Number.isSafeInteger(num) || num < 0 || num > 1000000000) return null;
  return num;
}

/**
 * Accounts Controller — Phase 2 Layer 1 Engine
 * Enforces Constitution B1–B6, A5 (user isolation), and L3 (no orphan deletion).
 */
export const accountsController = {
  async list(req, res, next) {
    try {
      const rows = await AccountModel.findByUser(req.user.id);
      return res.json({ status: 'ok', data: rows });
    } catch (err) {
      return next(err);
    }
  },

  async create(req, res, next) {
    try {
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      const kind = String(req.body?.kind || 'cash').toLowerCase();
      const manualBalance = parseNonNegYen(req.body?.manual_balance ?? 0);
      const uiDetails =
        req.body?.ui_details && typeof req.body.ui_details === 'object' ? req.body.ui_details : null;

      if (!name || name.length > 100) {
        return res.status(400).json({ error: 'name is required (1–100 characters)', status: 400 });
      }
      if (!VALID_ACCOUNT_KINDS.includes(kind)) {
        return res.status(400).json({
          error: `kind must be one of: ${VALID_ACCOUNT_KINDS.join(', ')}`,
          status: 400,
        });
      }
      if (manualBalance === null) {
        return res.status(400).json({
          error: 'manual_balance must be a non-negative whole JPY integer',
          status: 400,
        });
      }

      const created = await AccountModel.create({
        userId: req.user.id,
        name,
        kind,
        manualBalance,
        currency: 'JPY',
        uiDetails,
      });
      return res.status(201).json({ status: 'ok', data: created });
    } catch (err) {
      return next(err);
    }
  },

  async update(req, res, next) {
    try {
      const existing = await AccountModel.findByIdAndUser(req.params.id, req.user.id);
      if (!existing) {
        return res.status(404).json({ error: 'Account not found', status: 404 });
      }

      const updates = {};
      if (req.body?.name !== undefined) {
        const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
        if (!name || name.length > 100) {
          return res.status(400).json({ error: 'name must be 1–100 characters', status: 400 });
        }
        updates.name = name;
      }
      if (req.body?.kind !== undefined) {
        const kind = String(req.body.kind).toLowerCase();
        if (!VALID_ACCOUNT_KINDS.includes(kind)) {
          return res.status(400).json({
            error: `kind must be one of: ${VALID_ACCOUNT_KINDS.join(', ')}`,
            status: 400,
          });
        }
        updates.kind = kind;
      }
      if (req.body?.manual_balance !== undefined) {
        const bal = parseNonNegYen(req.body.manual_balance);
        if (bal === null) {
          return res.status(400).json({
            error: 'manual_balance must be a non-negative whole JPY integer',
            status: 400,
          });
        }
        updates.manualBalance = bal;
      }
      if (req.body?.ui_details !== undefined) {
        updates.uiDetails =
          req.body.ui_details && typeof req.body.ui_details === 'object' ? req.body.ui_details : null;
      }

      const updated = await AccountModel.update(req.params.id, req.user.id, updates);
      return res.json({ status: 'ok', data: updated });
    } catch (err) {
      return next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const deleted = await AccountModel.delete(req.params.id, req.user.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Account not found', status: 404 });
      }
      return res.json({ status: 'ok', data: { deleted: true } });
    } catch (err) {
      if (err.code === 'ACCOUNT_HAS_RECORDS') {
        return res.status(409).json({ error: err.message, status: 409 });
      }
      return next(err);
    }
  },
};
