import { Router } from 'express';
import { budgetsController } from '../controllers/budgetsController.js';

const router = Router();

router.get('/', budgetsController.list);
router.patch('/', budgetsController.update);

export default router;
