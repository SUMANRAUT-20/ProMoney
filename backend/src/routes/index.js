import { Router } from 'express';
import authRoutes from './authRoutes.js';
import transactionsRoutes from './transactionsRoutes.js';
import goalsRoutes from './goalsRoutes.js';
import budgetsRoutes from './budgetsRoutes.js';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/transactions', transactionsRoutes);
apiRouter.use('/goals', goalsRoutes);
apiRouter.use('/budgets', budgetsRoutes);

export default apiRouter;
