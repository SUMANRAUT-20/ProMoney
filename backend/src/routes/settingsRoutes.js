import { Router } from 'express';
import { settingsController } from '../controllers/settingsController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);
router.get('/', settingsController.getSettings);
router.put('/preferences', settingsController.updatePreferences);
router.put('/profile', settingsController.updateProfile);
router.put('/avatar', settingsController.updateAvatar);
router.put('/password', settingsController.changePassword);

export default router;
