import express from 'express';
import { scanTokensController } from './token.controller.js';

const router = express.Router();

/**
 * @route   GET /api/v1/tokens/scan
 * @desc    Deep scan and categorize tokens
 */
router.get('/scan', scanTokensController);

export const routeConfig = {
  path: '/v1/tokens',
  router: router,
  isPublic: false
};
