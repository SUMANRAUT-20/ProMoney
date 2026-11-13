import { Router } from 'express';
import { budgetsController } from '../controllers/budgetsController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);
router.get('/', budgetsController.list);
router.post('/', budgetsController.upsert);
router.patch('/', budgetsController.upsert);
router.put('/:id', budgetsController.updateById);
router.delete('/:id', budgetsController.remove);

export default router;
