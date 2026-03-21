import express from 'express';
import { recoverDust } from './recovery.controller.js';

const recoveryRouter = express.Router();

// POST /api/v1/recovery/dust { "walletAddress": "0x..." }
recoveryRouter.post('/dust', recoverDust);

export const recoveryRoutes = {
  path: '/recovery',
  router: recoveryRouter,
};
