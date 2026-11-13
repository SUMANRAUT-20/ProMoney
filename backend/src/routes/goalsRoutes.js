import { Router } from 'express';
import { goalsController } from '../controllers/goalsController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);
router.get('/', goalsController.list);
router.post('/', goalsController.create);
router.put('/:id', goalsController.update);
router.patch('/:id/contribute', goalsController.contribute);
router.patch('/:id/withdraw', goalsController.withdraw);
router.delete('/:id', goalsController.remove);

export default router;
