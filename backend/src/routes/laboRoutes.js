import { raw, Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { laboController } from '../controllers/laboController.js';
import { previewStatement } from '../controllers/statementImportController.js';
import { exportLaboReport } from '../controllers/laboInsights.js';
import { loans, whatIf } from '../controllers/laboSimulators.js';
import { previewMemory } from '../controllers/memoryController.js';

const router = Router();

router.post('/chat', requireAuth, laboController.chat);
router.post('/memory/preview', requireAuth, previewMemory);
router.post('/report/export', requireAuth, exportLaboReport);
router.post('/what-if', requireAuth, whatIf);
router.get('/loans', requireAuth, loans);
router.post('/loans', requireAuth, loans);
router.post('/parse', requireAuth, laboController.parse);
router.post('/scan', requireAuth, laboController.scan);
router.post('/import', requireAuth, raw({ limit: '8mb', inflate: false }), previewStatement);

export default router;
