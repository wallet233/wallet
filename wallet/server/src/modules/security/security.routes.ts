import express from 'express';
import { scanSecurityController } from './security.controller.js';
import { validator } from '../../utils/validator.js';

const router = express.Router();

/**
 * 2026 CONCURRENCY SHIELD:
 * Ensures JSON parsing is scoped to this router to handle heavy 
 * security payloads without interfering with global middleware.
 */
router.use(express.json());

/**
 * 2026 UNIFIED INPUT ADAPTER:
 * Normalizes 'address' and 'network' from either Query (GET) or Body (POST).
 * This allows the stress script to hit the endpoint using various methods
 * while keeping the Controller logic clean and focused.
 */
const normalizeInput = (req: any, res: any, next: any) => {
  req.body = {
    ...req.body,
    address: req.body.address || req.query.address,
    network: req.body.network || req.query.network || 'ethereum'
  };
  next();
};

/**
 * SECURITY ENDPOINTS:
 * 1. GET: Useful for quick browser-based audits or status checks.
 * 2. POST: The primary "Battle Route" for heavy, authenticated scans.
 */
router.get('/scan', normalizeInput, validator.validateRequestBody, scanSecurityController);
router.post('/scan', normalizeInput, validator.validateRequestBody, scanSecurityController);

export const routeConfig = {
  path: '/v1/security',
  router: router,
  isPublic: false,
  isCritical: true
};
