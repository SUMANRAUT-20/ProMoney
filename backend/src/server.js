import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import apiRouter from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const port = Number(process.env.PORT) || 4000;

app.disable('x-powered-by');
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '100kb' }));

// Health Check Endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    app: 'ProMoney API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Modular Feature Routes
app.use('/api', apiRouter);

// 404 Fallback
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Central Error Handler
app.use(errorHandler);

app.listen(port, () => {
  console.log(`ProMoney API Server running at http://localhost:${port}/api/health`);
});
