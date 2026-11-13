import { Router } from 'express';
import { transactionsController } from '../controllers/transactionsController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);
router.get('/', transactionsController.list);
router.post('/', transactionsController.create);
router.put('/:id', transactionsController.update);
router.delete('/:id', transactionsController.remove);

export default router;
