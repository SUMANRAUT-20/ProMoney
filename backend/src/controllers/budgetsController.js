/**
 * Budgets Controller Foundation
 * Joint Owners: Arpan Khatiwada & Suman Raut (Coordinated with Roshan Khanal)
 *
 * Uses snake_case JSON fields per docs/INTEGRATION_CONTRACT.md.
 */
export const budgetsController = {
  async list(_req, res, next) {
    try {
      return res.json({ status: 'ok', data: [] });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const { category_id, budget_month, amount_limit } = req.body;
      if (!category_id || !budget_month || !amount_limit) {
        return res.status(400).json({
          error: 'category_id, budget_month, and amount_limit are required',
          status: 400
        });
      }
      return res.status(501).json({
        error: 'Feature not implemented yet. Budget updates will be enabled in Phase 3.',
        status: 501
      });
    } catch (err) {
      next(err);
    }
  }
};
