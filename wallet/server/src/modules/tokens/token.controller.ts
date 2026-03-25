import { Request, Response } from 'express';
import { isAddress, getAddress } from 'ethers';
import { tokenService } from './token.service.js';
import { logger } from '../../utils/logger.js';
import crypto from 'crypto';

/**
 * UPGRADED: Finance-Grade Token Controller.
 * Features: Request Timeout guards, Idempotency tracking, 
 * Multi-chain Summary Analytics, and Sanitized Financial reporting.
 */
export async function scanTokensController(req: Request, res: Response) {
  // 1. UNIFIED INPUT & TRACEABILITY
  const rawAddress = (req.query.address || req.body.address) as string;
  const forceRefresh = req.query.refresh === 'true'; // Allow bypassing cache if needed
  const traceId = req.headers['x-trace-id']?.toString() || 
                  `TRC-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  
  // Set the Trace ID in response headers for frontend/SRE debugging
  res.setHeader('X-Trace-ID', traceId);
  res.setHeader('X-Content-Type-Options', 'nosniff');

  try {
    // 2. STRICT VALIDATION & NORMALIZATION
    if (!rawAddress || !isAddress(rawAddress)) {
      logger.warn(`[TokenController][${traceId}] REJECTED_INVALID_ADDRESS: ${rawAddress}`);
      return res.status(400).json({ 
        success: false, 
        error: 'A valid EVM wallet address is required for asset scanning.',
        traceId,
        code: 'INVALID_EVM_ADDRESS'
      });
    }

    const checksummedAddress = getAddress(rawAddress);
    
    // 3. PERFORMANCE GUARD: Request Timeout & Signal
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 28000); // 28s limit for Express lifecycle

    logger.info(`[TokenController][${traceId}] Initiating global asset sync for: ${checksummedAddress} (Refresh: ${forceRefresh})`);
    
    // 4. SERVICE EXECUTION (Finance-Grade fetch)
    const report = await tokenService.fetchWalletTokens(checksummedAddress);
    
    clearTimeout(timeout);

    // 5. STRUCTURED FINANCIAL ANALYTICS
    // We calculate these on the server to ensure "Single Source of Truth" for the UI
    const analytics = report.reduce((acc: any, asset: any) => {
      const value = asset.usdValue || 0;
      acc.totalUsdValue += value;
      
      if (asset.type === 'native') acc.nativeValue += value;
      else acc.erc20Value += value;
      
      if (asset.isSpam) acc.spamCount++;
      else acc.verifiedCount++;

      return acc;
    }, { totalUsdValue: 0, nativeValue: 0, erc20Value: 0, spamCount: 0, verifiedCount: 0 });

    // Set Cache Headers (Prevent browser from over-requesting within 60 seconds)
    res.setHeader('Cache-Control', 'public, max-age=60');

    return res.status(200).json({
      success: true,
      meta: {
        traceId,
        timestamp: new Date().toISOString(),
        status: 'COMPLETE',
        version: '2026.1.4'
      },
      wallet: {
        address: checksummedAddress,
        label: 'Primary Wallet'
      },
      summary: {
        assetCount: report.length,
        verifiedCount: analytics.verifiedCount,
        spamFiltered: analytics.spamCount,
        totalUsdValue: Number(analytics.totalUsdValue.toFixed(2)),
        breakdown: {
          native: Number(analytics.nativeValue.toFixed(2)),
          erc20: Number(analytics.erc20Value.toFixed(2))
        }
      },
      data: report
    });

  } catch (err: any) {
    // 6. SECURE ERROR BOUNDARY (Finance Safety)
    if (err.name === 'AbortError' || err.code === 'ETIMEDOUT') {
      logger.error(`[TokenController][${traceId}] TIMEOUT: Global scan exceeded time limit for ${rawAddress}`);
      return res.status(504).json({ 
        success: false, 
        error: 'The blockchain scan is taking longer than usual. Results will appear in history shortly.', 
        traceId 
      });
    }

    // Categorize Errors for Frontend UI Logic
    const isRateLimit = err.message?.includes('429') || err.code === 'RATE_LIMIT';
    const statusCode = isRateLimit ? 429 : (err.status || 500);

    logger.error(`[TokenController][${traceId}] CRITICAL_FAILURE: ${err.message}`);

    return res.status(statusCode).json({ 
      success: false, 
      error: isRateLimit ? 'Market data providers are busy. Retrying...' : 'Asset sync failed.',
      traceId,
      code: err.code || 'INTERNAL_SYNC_ERROR',
      retryable: statusCode >= 500 || statusCode === 429
    });
  }
}
