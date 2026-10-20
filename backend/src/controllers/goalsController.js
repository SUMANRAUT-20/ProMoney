/**
 * Goals Controller Foundation
 * Joint Owners: Arpan Khatiwada & Suman Raut (Coordinated with Roshan Khanal)
 *
 * Uses snake_case JSON fields per docs/INTEGRATION_CONTRACT.md.
 */
export const goalsController = {
  async list(_req, res, next) {
    try {
      return res.json({ status: 'ok', data: [] });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const { title, target_amount } = req.body;
      if (!title || !target_amount) {
        return res.status(400).json({
          error: 'title and target_amount are required',
          status: 400
        });
      }
      return res.status(501).json({
        error: 'Feature not implemented yet. Goal creation will be enabled in Phase 3.',
        status: 501
      });
    } catch (err) {
      next(err);
    }
  },

  async contribute(req, res, next) {
    try {
      const { amount } = req.body;
      if (!amount) {
        return res.status(400).json({
          error: 'amount is required',
          status: 400
        });
      }
      return res.status(501).json({
        error: 'Feature not implemented yet. Goal contributions will be enabled in Phase 3.',
        status: 501
      });
    } catch (err) {
      next(err);
    }
  },

  async remove(_req, res, next) {
    try {
      return res.status(501).json({
        error: 'Feature not implemented yet. Goal deletion will be enabled in Phase 3.',
        status: 501
      });
    } catch (err) {
      next(err);
    }
  }
};
