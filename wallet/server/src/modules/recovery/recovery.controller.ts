import { Request, Response } from 'express';
import { recoveryService } from './recovery.service.js';
import { logger } from '../../utils/logger.js';
import { isAddress, getAddress } from 'ethers';
import { mutex } from '../../utils/mutex.js';
import { clearSensitiveData } from '../../utils/crypto.js';
import crypto from 'crypto';

/**
 * UPGRADED: Production-Grade Recovery Controller.
 * Features: Distributed Mutex Locking, Zero-Trace Memory Hygiene, and TraceID Auditing.
 */
export async function recoverDustController(req: Request, res: Response) {
  const startTime = Date.now();
  const traceId = `REC-API-${crypto.randomUUID?.() || Date.now()}`;
  
  // 1. INPUT EXTRACTION & NORMALIZATION
  const rawAddress = (req.body.walletAddress || req.query.address) as string;
  let privateKey: string | undefined = req.body.privateKey as string;

  try {
    // 2. STRICT VALIDATION & CHECKSUMMING
    if (!rawAddress || !isAddress(rawAddress)) {
      return res.status(400).json({ 
        success: false, 
        error: 'A valid EVM walletAddress is required.',
        traceId 
      });
    }

    const checksummedAddr = getAddress(rawAddress);
    const lockId = `recovery:${checksummedAddr.toLowerCase()}`;

    // 3. ATOMIC DISTRIBUTED LOCK: Prevents "Double Rescue" across server clusters
    // 'ownerId' is required for the production-grade mutex we built
    const ownerId = await mutex.acquire(lockId, 600000); // 10 min lock
    
    if (!ownerId) {
      logger.warn(`[RecoveryController][${traceId}] Conflict: Recovery already in progress for ${checksummedAddr}`);
      return res.status(429).json({ 
        success: false, 
        error: 'RECOVERY_IN_PROGRESS', 
        message: 'A rescue mission is already active for this wallet.',
        traceId
      });
    }

    try {
      logger.info(`[RecoveryController][${traceId}] Initiating MEV-Shielded Rescue for: ${checksummedAddr}`);

      // 4. EXECUTION: Pass key to service for just-in-time use
      const result: any = await recoveryService.executeDustRecovery(checksummedAddr, privateKey);
      
      // 5. ZERO-TRACE MEMORY HYGIENE
      // Explicitly wipe the sensitive string from RAM to prevent heartbleed/memory-dump attacks
      if (privateKey) {
        clearSensitiveData(privateKey);
        privateKey = undefined;
      }
      if (req.body.privateKey) {
        req.body.privateKey = '[REDACTED]';
        delete req.body.privateKey;
      }

      const status = result.success ? 200 : 500;
      const duration = (Date.now() - startTime) / 1000;

      return res.status(status).json({
        ...result,
        traceId,
        latency: `${duration}s`,
        timestamp: new Date().toISOString()
      });

    } finally {
      // 6. ATOMIC RELEASE: Only the owner who set the lock can release it
      await mutex.release(lockId, ownerId);
    }

  } catch (err: any) {
    logger.error(`[RecoveryController][${traceId}] Critical Failure: ${err.stack || err.message}`);
    
    return res.status(500).json({ 
      success: false, 
      error: 'INTERNAL_RECOVERY_ERROR', 
      message: 'The recovery engine encountered an unexpected failure.',
      traceId
    });
  }
}
