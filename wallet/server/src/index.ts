import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { env, validateEnv } from './config/env.js';
import { logger } from './utils/logger.js';
import { loadRoutes } from './core/routeLoader.js';
import { connectDB } from './config/database.js';

// ─── WORKER & OBSERVER IMPORTS ─────────────────
import { startAutoBurnWorker } from './workers/autoBurnWorker.js';
import { startDustWorker } from './workers/dustRecoveryWorker.js';
import { startSpamWorker } from './workers/spamSweepWorker.js';
import { startHealthWorker } from './workers/walletHealthWorker.js';
import { startPaymentListener } from './modules/payment/payment.listener.js';

(async () => {
  // 1. Pre-flight Checks
  validateEnv();
  await connectDB();

  const app = express();

  // 2. Global Middleware
  app.use(cors());
  app.use(helmet());
  app.use(express.json());
  app.use(morgan('dev'));

  // 3. Heartbeats & Observers (The "Live" Engine)
  startAutoBurnWorker();
  startDustWorker();
  startSpamWorker();
  startHealthWorker();
  startPaymentListener(); // This watches for your 5% / 7.5% revenue

  // 4. Dynamic Route Loading
  await loadRoutes(app);

  // 5. Root Health Check
  app.get('/', (_, res) => {
    res.json({ 
      status: 'ONLINE', 
      version: '1.1.1-HEAVY',
      timestamp: new Date().toISOString() 
    });
  });

  // 6. Global Error Boundary
  app.use((err: any, _req: any, res: any, _next: any) => {
    logger.error(`[Fatal] ${err.message}`);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  });

  // 7. Boot
  app.listen(env.port, () => {
    logger.info(`🚀 WIP Backend Live on Port ${env.port}`);
  });
})();
