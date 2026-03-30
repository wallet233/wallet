import express from 'express';
import { scanSecurityController } from './security.controller.js';
import { validator } from '../../utils/validator.js';

const router = express.Router();

/**
 * 2026 CONCURRENCY SHIELD:
 * Force JSON parsing at the start of this router. 
 * This ensures the 'Standard POST' and 'Burst' tests have a body 
 * before the Validator runs.
 */
router.use(express.json());

// Apply Validator AFTER the local body-parser
router.get('/scan', validator.validateRequestBody, scanSecurityController);
router.post('/scan', validator.validateRequestBody, scanSecurityController);

export const routeConfig = {
  path: '/v1/security',
  router: router,
  isPublic: false,
  isCritical: true
};
