import express from 'express';
import rateLimit from 'express-rate-limit';
import { recoverDustController } from './recovery.controller.js';
import { logger } from '../../utils/logger.js';

const router = express.Router();

/**
 * UPGRADED: Financial-Grade Recovery Routing.
 * Features: Brute-force protection, Strict rate-limiting, and Audit-logging.
 */

// 1. DYNAMIC RATE LIMITER: Prevents attackers from spamming the recovery engine.
// Allowing only 5 recovery attempts per 15 minutes per IP.
const recoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, 
  message: { 
    success: false, 
    error: 'TOO_MANY_REQUESTS', 
    message: 'Security Limit: Too many recovery attempts. Please try again in 15 minutes.' 
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn(`[RateLimit] Recovery attempt blocked for IP: ${req.ip}`);
    res.status(options.statusCode).send(options.message);
  }
});

/**
 * @route   POST /api/v1/recovery/dust
 * @desc    Initialize a high-priority dust rescue mission.
 * Security: Rate-limited and requires verified membership.
 */
router.post('/dust', recoveryLimiter, recoverDustController);

export const routeConfig = {
  path: '/v1/recovery',
  router: router,
  isPublic: false // Ensures this is wrapped in Auth Middleware in index.ts
};
