import { Router } from 'express';
import { transactionsController } from '../controllers/transactionsController.js';

const router = Router();

router.get('/', transactionsController.list);
router.post('/', transactionsController.create);
router.delete('/:id', transactionsController.remove);

export default router;
