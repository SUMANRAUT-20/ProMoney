import { Router } from 'express';
import { billsController } from '../controllers/billsController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);
router.get('/', billsController.list);
router.post('/', billsController.create);
router.put('/:id', billsController.update);
router.patch('/:id/toggle-paid', billsController.togglePaid);
router.patch('/:id/advance-cycle', billsController.advanceCycle);
router.delete('/:id', billsController.remove);

export default router;
