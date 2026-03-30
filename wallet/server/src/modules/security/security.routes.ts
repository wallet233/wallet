import express from 'express';
import { scanSecurityController } from './security.controller.js';
import { validator } from '../../utils/validator.js';

const router = express.Router();

/**
 * 2026 PRODUCTION MIDDLEWARE ORDER:
 * 1. Global JSON Parser (index.ts)
 * 2. Global Auth Gate (routeLoader.ts)
 * 3. Local Body/Param Sanitization (Checksumming)
 * 4. Controller
 */

/**
 * @route   GET /api/v1/security/scan
 * @desc    Scans for risky contract approvals (URL-based lookup)
 */
router.get('/scan', 
  validator.validateRequestBody, 
  scanSecurityController
);

/**
 * @route   POST /api/v1/security/scan
 * @desc    Institutional Security Audit (JSON-body based)
 */
router.post('/scan', 
  validator.validateRequestBody, 
  scanSecurityController
);

export const routeConfig = {
  path: '/v1/security',
  router: router,
  isPublic: false,
  isCritical: true
};
