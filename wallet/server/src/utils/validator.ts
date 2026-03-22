import { Request, Response, NextFunction } from 'express';
import { isAddress } from 'ethers';
import { prisma } from '../config/database.js';
import { logger } from './logger.js';

/**
 * Premium API Validator Middleware
 * 1. Validates Wallet Address Format
 * 2. Authenticates API Keys from Headers
 * 3. Tracks Usage Analytics in Postgres
 */
export const validator = {
  /**
   * Middleware: Ensure the request has a valid 'x-api-key'
   */
  async apiKeyAuth(req: Request, res: Response, next: NextFunction) {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized: Missing API Key in headers (x-api-key)' 
      });
    }

    try {
      // 1. Verify Key in Database
      const keyData = await prisma.apiKey.findUnique({
        where: { key: apiKey }
      });

      if (!keyData) {
        return res.status(403).json({ 
          success: false, 
          error: 'Forbidden: Invalid or expired API Key' 
        });
      }

      // 2. Track Usage (Async increment - don't block the request)
      prisma.apiKey.update({
        where: { id: keyData.id },
        data: { usage: { increment: 1 } }
      }).catch(e => logger.warn(`[Validator] Usage tracking failed: ${e.message}`));

      // 3. Attach key info to request for downstream controllers
      (req as any).apiKeyInfo = keyData;
      
      next();
    } catch (error: any) {
      logger.error(`[Validator] Auth System Failure: ${error.message}`);
      return res.status(500).json({ success: false, error: 'Internal Auth Error' });
    }
  },

  /**
   * Helper: Strict Wallet Address Validator
   */
  validateAddress(address: string): boolean {
    if (!address || !isAddress(address)) {
      logger.debug(`[Validator] Rejected invalid address: ${address}`);
      return false;
    }
    return true;
  },

  /**
   * Middleware: Dynamic Body Validation
   * Ensures 'address' is present and valid in POST/PUT requests
   */
  validateRequestBody(req: Request, res: Response, next: NextFunction) {
    const address = req.body.address || req.query.address;
    
    if (!address || !isAddress(address as string)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid Request: A valid EVM wallet address is required.' 
      });
    }
    
    next();
  }
};
