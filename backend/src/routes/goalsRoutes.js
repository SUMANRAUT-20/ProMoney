import { Router } from 'express';
import { goalsController } from '../controllers/goalsController.js';

const router = Router();

router.get('/', goalsController.list);
router.post('/', goalsController.create);
router.patch('/:id/contribute', goalsController.contribute);
router.delete('/:id', goalsController.remove);

export default router;
