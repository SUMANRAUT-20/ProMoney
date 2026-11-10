import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { laboController } from '../controllers/laboController.js';

const router = Router();

router.post('/chat', requireAuth, laboController.chat);
router.post('/parse', requireAuth, laboController.parse);

export default router;
