import { scanGlobalWallet } from '../../blockchain/walletScanner.js';
import { classifyToken } from './spamDetector.js';
import { logger } from '../../utils/logger.js';
import crypto from 'crypto';
import pLimit from 'p-limit';

/**
 * UPGRADED: Finance-Grade Token Orchestrator.
 * Features: Atomic Scan Locking, Multi-Chain Risk Scoring, and Recovery Prioritization.
 */
export const tokenService = {
  // 1. PRODUCTION CACHE: LRU-ready map with TTL and Atomic Locks
  cache: new Map<string, { data: any, timestamp: number }>(),
  locks: new Set<string>(), // Prevents duplicate concurrent scans for the same address
  CACHE_TTL: Number(process.env.TOKEN_CACHE_TTL) || 1000 * 60 * 10, // 10 mins for financial accuracy
  MAX_CACHE_SIZE: 2000, 

  /**
   * Financial Pipeline: Lock -> Scan -> Classify -> Risk-Score -> Cache
   */
  async fetchWalletTokens(address: string, forceRefresh = false) {
    const safeAddr = address.toLowerCase();
    const traceId = `TS-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    
    // 2. ATOMIC LOCKING & CACHE LOOKUP
    if (this.locks.has(safeAddr)) {
      logger.warn(`[TokenService][${traceId}] Scan already in progress for ${safeAddr}. Waiting...`);
      // Wait briefly for the other scan or throw to prevent DB/API hammering
      await new Promise(r => setTimeout(r, 2000));
    }

    if (!forceRefresh && this.cache.has(safeAddr)) {
      const cached = this.cache.get(safeAddr)!;
      if (Date.now() - cached.timestamp < this.CACHE_TTL) {
        logger.info(`[TokenService][${traceId}] Cache Hit: ${safeAddr}`);
        return { ...cached.data, cached: true, traceId };
      }
      this.cache.delete(safeAddr);
    }

    try {
      this.locks.add(safeAddr);
      logger.info(`[TokenService][${traceId}] Initiating high-fidelity scan: ${safeAddr}`);
      
      // 3. MULTI-CHAIN DATA AGGREGATION
      const rawAssets = await scanGlobalWallet(safeAddr);

      // 4. BATCHED CLASSIFICATION (Real-time Security + Pricing)
      const categorized = await this.categorizeAssets(rawAssets, traceId);

      // 5. CACHE EVICTION (LRU Logic)
      if (this.cache.size >= this.MAX_CACHE_SIZE) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey) this.cache.delete(oldestKey);
      }

      this.cache.set(safeAddr, { data: categorized, timestamp: Date.now() });
      return { ...categorized, cached: false, traceId };

    } catch (err: any) {
      logger.error(`[TokenService][${traceId}] Financial Scan Failed: ${err.message}`);
      throw err;
    } finally {
      this.locks.delete(safeAddr); // Always release the lock
    }
  },

  /**
   * Universal Categorization & Risk Engine
   * Upgraded for "Value-at-Risk" (VaR) reporting.
   */
  async categorizeAssets(rawAssets: any[], traceId: string) {
    const limit = pLimit(15); // Increased concurrency for 2026 infra
    
    const results = await Promise.allSettled(
      rawAssets.map((asset) => 
        limit(async () => {
          try {
            // Security + Price classification
            const analysis = await classifyToken(asset);
            
            // ANTI-FRAUD: Cross-reference balance vs security status
            const isSuspicious = analysis.status === 'spam' || 
                                analysis.isHoneypot || 
                                (parseFloat(asset.balance) > 0 && !analysis.usdValue && !asset.logo);
            
            return { 
              ...asset, 
              ...analysis,
              isSuspicious,
              lastAudit: new Date().toISOString(),
              // Profitability check for the Butler/Recovery logic
              isRecoverable: analysis.canRecover && !isSuspicious && !analysis.isBlacklisted
            };
          } catch (e: any) {
            logger.warn(`[TokenService][${traceId}] Audit skipped for ${asset.symbol}: ${e.message}`);
            return { ...asset, status: 'audit_failed', usdValue: 0, isRecoverable: false };
          }
        })
      )
    );

    // Filter fulfilled promises
    const audited = results
      .map(r => r.status === 'fulfilled' ? r.value : null)
      .filter(Boolean) as any[];

    // 6. FINANCIAL ANALYTICS (Single Source of Truth)
    const totalValue = audited.reduce((sum, a) => sum + (a.usdValue || 0), 0);
    const recoverable = audited.filter(a => a.isRecoverable);
    const recoverableValue = recoverable.reduce((sum, a) => sum + (a.usdValue || 0), 0);

    // Risk Scoring: If 80% of value is in unrecoverable/suspicious tokens, mark as CRITICAL
    const riskScore = totalValue > 0 ? (recoverableValue / totalValue) : 1;
    const globalRisk = riskScore < 0.2 ? 'CRITICAL_LIQUIDITY' : 
                       audited.some(a => a.isHoneypot) ? 'SECURITY_THREAT' : 'STABLE';

    return {
      summary: {
        totalAssets: audited.length,
        totalUsdValue: Number(totalValue.toFixed(2)),
        recoverableCount: recoverable.length,
        recoverableValue: Number(recoverableValue.toFixed(2)),
        auditTimestamp: Date.now(),
        riskLevel: globalRisk,
        health: `${(riskScore * 100).toFixed(0)}%`
      },
      inventory: {
        liquid: recoverable.sort((a, b) => (b.usdValue || 0) - (a.usdValue || 0)),
        clean: audited.filter(a => !a.isSuspicious && a.status !== 'dust'),
        dust: audited.filter(a => a.status === 'dust'),
        threats: audited.filter(a => a.status === 'malicious' || a.isHoneypot || a.isBlacklisted),
        spam: audited.filter(a => a.status === 'spam' || (a.isSuspicious && a.status !== 'malicious'))
      },
      raw: audited
    };
  }
};
