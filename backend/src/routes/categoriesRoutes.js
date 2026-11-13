import { Router } from 'express';
import { categoriesController } from '../controllers/categoriesController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);
router.get('/', categoriesController.list);
router.post('/', categoriesController.create);

export default router;
