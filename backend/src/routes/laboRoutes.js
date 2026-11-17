import { raw, Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { laboController } from '../controllers/laboController.js';
import { previewStatement } from '../controllers/statementImportController.js';

const router = Router();

router.post('/chat', requireAuth, laboController.chat);
router.post('/parse', requireAuth, laboController.parse);
router.post('/scan', requireAuth, laboController.scan);
router.post('/import', requireAuth, raw({ limit: '8mb', inflate: false }), previewStatement);

export default router;
