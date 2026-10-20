/**
 * Auth Controller Foundation
 * Joint Owners: Arpan Khatiwada & Suman Raut (Coordinated with Renuka Karmacharya)
 *
 * Uses snake_case JSON fields per docs/INTEGRATION_CONTRACT.md.
 * Does NOT return fake JWT tokens or pretend authentication is complete.
 */
export const authController = {
  async register(req, res, next) {
    try {
      const { email, password, display_name } = req.body;
      if (!email || !password || !display_name) {
        return res.status(400).json({
          error: 'display_name, email, and password are required',
          status: 400
        });
      }
      return res.status(501).json({
        error: 'Feature not implemented yet. Registration will be connected to MySQL in Phase 1.',
        status: 501
      });
    } catch (err) {
      next(err);
    }
  },

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({
          error: 'email and password are required',
          status: 400
        });
      }
      return res.status(501).json({
        error: 'Feature not implemented yet. Login and JWT issuance will be implemented in Phase 1.',
        status: 501
      });
    } catch (err) {
      next(err);
    }
  }
};
