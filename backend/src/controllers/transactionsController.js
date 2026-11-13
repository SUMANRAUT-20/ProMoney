import { TransactionModel } from '../models/transactionModel.js';
import { AccountModel } from '../models/accountModel.js';
import { CategoryModel } from '../models/categoryModel.js';
import {
  REFUND_KINDS,
  TRANSFER_KINDS,
  iso,
  normalizeSalaryAmount,
  positiveYen,
  tokyoTodayISO,
} from '../services/financeMath.js';

const VALID_TX_KINDS = [
  'income',
  'expense',
  ...REFUND_KINDS,
  ...TRANSFER_KINDS,
  'adjustment',
];

async function resolveUserCategory(userId, { category_id, category_name, kind }) {
  const catKind = kind === 'income' ? 'income' : 'expense';
  if (category_id !== undefined && category_id !== null && category_id !== '') {
    const numId = Number(category_id);
    if (Number.isSafeInteger(numId) && numId > 0) {
      const owned = await CategoryModel.findByIdAndUser(numId, userId);
      if (!owned) return { error: 'Category not found or does not belong to user' };
      return { category: owned };
    }
  }
  if (typeof category_name === 'string' && category_name.trim()) {
    const byName = await CategoryModel.findByNameAndUser(category_name.trim(), catKind, userId);
    if (byName) return { category: byName };
    const created = await CategoryModel.create({
      userId,
      name: category_name.trim(),
      kind: catKind,
    });
    return { category: created };
  }
  return { category: null };
}

/**
 * Transactions Controller — Phase 2 Layer 1 Engine
 * Enforces Constitution C1–C9, F1–F6, M1–M3, L1–L2, and A5 (user isolation).
 */
export const transactionsController = {
  async list(req, res, next) {
    try {
      const rows = await TransactionModel.findByUser(req.user.id);
      return res.json({ status: 'ok', data: rows });
    } catch (err) {
      return next(err);
    }
  },

  async create(req, res, next) {
    try {
      const body = req.body || {};
      const userId = req.user.id;

      // Constitution C6 Quick Add support: if only amount + category_id/category_name are provided,
      // default kind to 'expense', date to today (Asia/Tokyo), and account to user's Cash account.
      const isQuickAdd =
        !body.kind &&
        !body.transaction_date &&
        body.amount !== undefined &&
        (body.category_id !== undefined || body.category_name !== undefined);

      const kind = isQuickAdd ? 'expense' : String(body.kind || '').toLowerCase();
      if (!VALID_TX_KINDS.includes(kind)) {
        return res.status(400).json({
          error: `kind must be one of: ${VALID_TX_KINDS.join(', ')}`,
          status: 400,
        });
      }

      // Constitution L1 & M1: positive whole-yen integer amount (net salary if gross + deductions given)
      let amount;
      try {
        amount =
          kind === 'income' && body.gross_amount !== undefined
            ? normalizeSalaryAmount({
                amount: body.amount,
                gross_amount: body.gross_amount,
                deductions: body.deductions,
              })
            : positiveYen(body.amount);
      } catch (err) {
        return res.status(400).json({ error: err.message, status: 400 });
      }

      let transactionDate;
      try {
        transactionDate = iso(isQuickAdd ? tokyoTodayISO() : String(body.transaction_date || ''));
      } catch (err) {
        return res.status(400).json({ error: err.message, status: 400 });
      }

      // Validate account ownership (Constitution A5, L1, B4)
      let accountId = body.account_id || null;
      if (isQuickAdd && !accountId) {
        const userAccounts = await AccountModel.findByUser(userId);
        const cashAcc = userAccounts.find((a) => a.kind === 'cash') || userAccounts[0];
        if (cashAcc) accountId = cashAcc.id;
      } else if (!accountId && body.payment_method === 'debit') {
        // Constitution B4: debit payment = bank payment
        const userAccounts = await AccountModel.findByUser(userId);
        const bankAcc = userAccounts.find((a) => a.kind === 'bank');
        if (bankAcc) accountId = bankAcc.id;
      }

      if (accountId !== null && accountId !== '') {
        const acc = await AccountModel.findByIdAndUser(accountId, userId);
        if (!acc) {
          return res.status(400).json({ error: 'Account not found or does not belong to user', status: 400 });
        }
        accountId = acc.id;
      } else {
        accountId = null;
      }

      // Constitution L2: Transfer / card payment accounts must differ and both belong to the user
      let toAccountId = body.to_account_id || null;
      if (kind === 'transfer' || kind === 'card_payment') {
        if (!accountId || !toAccountId) {
          return res.status(400).json({
            error: 'Transfer and card payment require both account_id and to_account_id (Constitution L2)',
            status: 400,
          });
        }
        if (String(accountId) === String(toAccountId)) {
          return res.status(400).json({
            error: 'Transfer source and destination accounts must differ (Constitution L2)',
            status: 400,
          });
        }
        const toAcc = await AccountModel.findByIdAndUser(toAccountId, userId);
        if (!toAcc) {
          return res.status(400).json({
            error: 'Destination account not found or does not belong to user (Constitution L2)',
            status: 400,
          });
        }
        toAccountId = toAcc.id;
      } else if (toAccountId !== null && toAccountId !== '') {
        const toAcc = await AccountModel.findByIdAndUser(toAccountId, userId);
        if (!toAcc) {
          return res.status(400).json({
            error: 'Destination account not found or does not belong to user',
            status: 400,
          });
        }
        toAccountId = toAcc.id;
      } else {
        toAccountId = null;
      }

      // Validate or resolve category ownership (Constitution L1)
      const { category, error: catError } = await resolveUserCategory(userId, {
        category_id: body.category_id,
        category_name: body.category_name,
        kind,
      });
      if (catError) {
        return res.status(400).json({ error: catError, status: 400 });
      }

      const rawNote = String(body.note ?? body.title ?? '').trim();
      const fallbackTitle = isQuickAdd ? category?.name || 'Quick Expense' : '';
      const finalTitle = (rawNote || fallbackTitle).slice(0, 150);
      if (!finalTitle) {
        return res.status(400).json({ error: 'title or note is required', status: 400 });
      }

      const created = await TransactionModel.create({
        userId,
        accountId,
        toAccountId,
        categoryId: category ? category.id : null,
        kind,
        title: finalTitle,
        note: rawNote || finalTitle,
        amount,
        transactionDate,
      });
      return res.status(201).json({ status: 'ok', data: created });
    } catch (err) {
      return next(err);
    }
  },

  async update(req, res, next) {
    try {
      const userId = req.user.id;
      const existing = await TransactionModel.findByIdAndUser(req.params.id, userId);
      if (!existing) {
        return res.status(404).json({ error: 'Transaction not found', status: 404 });
      }

      const body = req.body || {};
      const nextKind = body.kind !== undefined ? String(body.kind).toLowerCase() : existing.kind;
      if (!VALID_TX_KINDS.includes(nextKind)) {
        return res.status(400).json({
          error: `kind must be one of: ${VALID_TX_KINDS.join(', ')}`,
          status: 400,
        });
      }

      let nextAmount = existing.amount;
      if (body.amount !== undefined) {
        try {
          nextAmount = positiveYen(body.amount);
        } catch (err) {
          return res.status(400).json({ error: err.message, status: 400 });
        }
      }

      let nextDate = existing.transaction_date;
      if (body.transaction_date !== undefined) {
        try {
          nextDate = iso(String(body.transaction_date));
        } catch (err) {
          return res.status(400).json({ error: err.message, status: 400 });
        }
      }

      let nextAccountId = existing.account_id;
      if (body.account_id !== undefined) {
        if (!body.account_id) {
          nextAccountId = null;
        } else {
          const acc = await AccountModel.findByIdAndUser(body.account_id, userId);
          if (!acc) {
            return res.status(400).json({ error: 'Account not found or does not belong to user', status: 400 });
          }
          nextAccountId = acc.id;
        }
      }

      let nextToAccountId = existing.to_account_id;
      if (body.to_account_id !== undefined) {
        if (!body.to_account_id) {
          nextToAccountId = null;
        } else {
          const toAcc = await AccountModel.findByIdAndUser(body.to_account_id, userId);
          if (!toAcc) {
            return res.status(400).json({
              error: 'Destination account not found or does not belong to user',
              status: 400,
            });
          }
          nextToAccountId = toAcc.id;
        }
      }

      if (
        (nextKind === 'transfer' || nextKind === 'card_payment') &&
        (!nextAccountId || !nextToAccountId || String(nextAccountId) === String(nextToAccountId))
      ) {
        return res.status(400).json({
          error: 'Transfer accounts must differ and both belong to the user (Constitution L2)',
          status: 400,
        });
      }

      let nextCategoryId = existing.category_id;
      if (body.category_id !== undefined || body.category_name !== undefined) {
        const { category, error: catError } = await resolveUserCategory(userId, {
          category_id: body.category_id,
          category_name: body.category_name,
          kind: nextKind,
        });
        if (catError) return res.status(400).json({ error: catError, status: 400 });
        nextCategoryId = category ? category.id : null;
      }

      const rawNote = body.note !== undefined || body.title !== undefined
        ? String(body.note ?? body.title ?? '').trim()
        : existing.note;
      if (!rawNote) {
        return res.status(400).json({ error: 'title or note is required', status: 400 });
      }

      const updated = await TransactionModel.update(req.params.id, userId, {
        accountId: nextAccountId,
        toAccountId: nextToAccountId,
        categoryId: nextCategoryId,
        kind: nextKind,
        title: rawNote.slice(0, 150),
        note: rawNote.slice(0, 255),
        amount: nextAmount,
        transactionDate: nextDate,
      });
      return res.json({ status: 'ok', data: updated });
    } catch (err) {
      return next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const deleted = await TransactionModel.delete(req.params.id, req.user.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Transaction not found', status: 404 });
      }
      return res.json({ status: 'ok', data: { deleted: true } });
    } catch (err) {
      return next(err);
    }
  },
};
