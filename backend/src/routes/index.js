import { Router } from 'express';
import authRoutes from './authRoutes.js';
import settingsRoutes from './settingsRoutes.js';
import categoriesRoutes from './categoriesRoutes.js';
import accountsRoutes from './accountsRoutes.js';
import transactionsRoutes from './transactionsRoutes.js';
import budgetsRoutes from './budgetsRoutes.js';
import goalsRoutes from './goalsRoutes.js';
import billsRoutes from './billsRoutes.js';
import laboRoutes from './laboRoutes.js';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/settings', settingsRoutes);
apiRouter.use('/categories', categoriesRoutes);
apiRouter.use('/accounts', accountsRoutes);
apiRouter.use('/transactions', transactionsRoutes);
apiRouter.use('/budgets', budgetsRoutes);
apiRouter.use('/goals', goalsRoutes);
apiRouter.use('/bills', billsRoutes);
apiRouter.use('/labo', laboRoutes);

export default apiRouter;
