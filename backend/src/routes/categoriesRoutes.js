import { Router } from 'express';
import { categoriesController } from '../controllers/categoriesController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);
router.get('/', categoriesController.list);
router.post('/', categoriesController.create);
router.put('/:id', categoriesController.rename);
router.delete('/:id', categoriesController.remove);

export default router;
