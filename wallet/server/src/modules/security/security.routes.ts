import express from 'express';
import { scanSecurityController } from './security.controller.js';

const router = express.Router();

/**
 * @route   GET /api/v1/security/scan
 * @desc    Scans for risky contract approvals (scam detection)
 */
router.get('/scan', scanSecurityController);

export const routeConfig = {
  path: '/v1/security',
  router: router,
  isPublic: false
};
