/**
 * Transactions Controller Foundation
 * Joint Owners: Arpan Khatiwada & Suman Raut (Coordinated with Rajesh Mishra)
 *
 * Uses snake_case JSON fields per docs/INTEGRATION_CONTRACT.md.
 */
export const transactionsController = {
  async list(_req, res, next) {
    try {
      return res.json({ status: 'ok', data: [] });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const { amount, title, kind, transaction_date } = req.body;
      if (!amount || !title || !kind || !transaction_date) {
        return res.status(400).json({
          error: 'amount, title, kind, and transaction_date are required',
          status: 400
        });
      }
      return res.status(501).json({
        error: 'Feature not implemented yet. Transaction persistence will be enabled in Phase 2.',
        status: 501
      });
    } catch (err) {
      next(err);
    }
  },

  async remove(_req, res, next) {
    try {
      return res.status(501).json({
        error: 'Feature not implemented yet. Transaction deletion will be enabled in Phase 2.',
        status: 501
      });
    } catch (err) {
      next(err);
    }
  }
};
