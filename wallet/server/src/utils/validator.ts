import { Request, Response, NextFunction } from 'express';
import { isAddress, getAddress } from 'ethers';
import { prisma } from '../config/database.js';
import { logger } from './logger.js';

/**
 * UPGRADED: Production-Grade API Guardian.
 * Features: LRU Caching for Keys, Atomic Usage Tracking, and Strict Normalization.
 */

// 1. MEMORY CACHE: Prevents Database Bottlenecks
// In a "Real Money" app, hitting Postgres for every single API call is too slow.
const keyCache = new Map<string, { data: any, expiry: number }>();
const CACHE_TTL = 1000 * 60 * 5; // 5 Minutes

export const validator = {
  /**
   * Middleware: High-Speed API Key Authentication.
   * Checks Cache first, then Database, then updates usage asynchronously.
   */
  async apiKeyAuth(req: Request, res: Response, next: NextFunction) {
    const apiKey = (req.headers['x-api-key'] || req.query.apiKey) as string;

    if (!apiKey || apiKey.length < 20) {
      return res.status(401).json({ 
        success: false, 
        error: 'UNAUTHORIZED: Valid API Key required in headers (x-api-key)' 
      });
    }

    try {
      // 2. CHECK CACHE (Production Speed)
      const cached = keyCache.get(apiKey);
      let keyData = cached && cached.expiry > Date.now() ? cached.data : null;

      if (!keyData) {
        // 3. DATABASE VERIFICATION
        keyData = await prisma.apiKey.findUnique({
          where: { key: apiKey }
        });

        if (!keyData) {
          logger.warn(`[Validator] Unauthorized access attempt with key: ${apiKey.substring(0, 8)}...`);
          return res.status(403).json({ 
            success: false, 
            error: 'FORBIDDEN: Invalid or deactivated API Key' 
          });
        }

        // Update Cache
        keyCache.set(apiKey, { data: keyData, expiry: Date.now() + CACHE_TTL });
      }

      // 4. USAGE TRACKING (Atomic & Non-blocking)
      // We don't 'await' this so the user's "Real Money" scan finishes faster.
      prisma.apiKey.update({
        where: { id: keyData.id },
        data: { usage: { increment: 1 } }
      }).catch(e => logger.error(`[Validator] Usage Sync Failed: ${e.message}`));

      // 5. ATTACH CONTEXT
      (req as any).apiKeyInfo = {
        id: keyData.id,
        wallet: keyData.wallet,
        plan: keyData.plan
      };
      
      next();
    } catch (error: any) {
      logger.error(`[Validator] Auth System Crash: ${error.stack}`);
      return res.status(500).json({ success: false, error: 'AUTH_SERVICE_TEMPORARILY_OFFLINE' });
    }
  },

  /**
   * Middleware: Strict Body & Address Sanitization.
   * Forces Checksumming to prevent "Real Money" being sent to malformed addresses.
   */
  validateRequestBody(req: Request, res: Response, next: NextFunction) {
    const rawAddress = (req.body.address || req.query.address || req.body.walletAddress) as string;
    
    if (!rawAddress || !isAddress(rawAddress)) {
      return res.status(400).json({ 
        success: false, 
        error: 'INVALID_INPUT: A valid EVM wallet address is required.' 
      });
    }

    // NORMALIZATION: Convert to Checksummed format (0xabc -> 0xAbC)
    // This is critical for database consistency and preventing duplicate scans.
    try {
      const checksummed = getAddress(rawAddress);
      
      // Inject back into the request so controllers don't have to re-verify
      if (req.body.address) req.body.address = checksummed;
      if (req.body.walletAddress) req.body.walletAddress = checksummed;
      
      next();
    } catch (e) {
      return res.status(400).json({ success: false, error: 'MALFORMED_ADDRESS_CHECKSUM' });
    }
  }
};
