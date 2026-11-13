import { Router } from 'express';
import { accountsController } from '../controllers/accountsController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);
router.get('/', accountsController.list);
router.post('/', accountsController.create);
router.put('/:id', accountsController.update);
router.delete('/:id', accountsController.remove);

export default router;
