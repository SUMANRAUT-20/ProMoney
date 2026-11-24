import { Router } from 'express';
import { settingsController } from '../controllers/settingsController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { clearMemory, forget, listMemory, remember } from '../controllers/memoryController.js';

const router = Router();

router.use(requireAuth);
router.get('/', settingsController.getSettings);
router.get('/memory', listMemory);
router.patch('/memory', remember);
router.delete('/memory', clearMemory);
router.delete('/memory/:section/:key', forget);
router.put('/preferences', settingsController.updatePreferences);
router.put('/profile', settingsController.updateProfile);
router.put('/avatar', settingsController.updateAvatar);
router.put('/password', settingsController.changePassword);

export default router;
