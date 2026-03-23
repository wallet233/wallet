import { scanGlobalWallet } from '../../blockchain/walletScanner.js';
import { classifyToken } from './spamDetector.js';
import { logger } from '../../utils/logger.js';
import crypto from 'crypto';

/**
 * UPGRADED: Production-grade Token Service for High-Value Assets.
 * Features: Size-limited caching (Anti-OOM), Type-safe Error Handling, and Audit Traceability.
 */
export const tokenService = {
  // 1. MEMORY SAFETY: Size-limited cache to prevent server crashes on large datasets
  cache: new Map<string, { data: any, timestamp: number }>(),
  CACHE_TTL: 1000 * 60 * 60,
  MAX_CACHE_SIZE: 5000, // Prevents memory leaks in production

  /**
   * High-Performance Pipeline: Scan -> Classify -> Group
   */
  async fetchWalletTokens(address: string, forceRefresh = false) {
    const safeAddr = address.toLowerCase();
    const traceId = `TOKEN-SCAN-${crypto.randomUUID?.() || Date.now()}`;
    
    // Check Cache first for production speed
    if (!forceRefresh && this.cache.has(safeAddr)) {
      const cached = this.cache.get(safeAddr)!;
      if (Date.now() - cached.timestamp < this.CACHE_TTL) {
        logger.info(`[TokenService][${traceId}] Returning cached assets for ${safeAddr}`);
        return cached.data;
      }
    }

    try {
      logger.info(`[TokenService][${traceId}] Live-scanning on-chain assets: ${safeAddr}`);
      
      // 1. Get raw on-chain data from our multi-chain scanner
      const rawAssets = await scanGlobalWallet(safeAddr);

      // 2. Perform categorization on the fetched assets
      const categorized = await this.categorizeAssets(rawAssets);

      // 3. Update Cache with Size Management
      if (this.cache.size >= this.MAX_CACHE_SIZE) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey) this.cache.delete(firstKey); // FIFO eviction
      }

      this.cache.set(safeAddr, { data: categorized, timestamp: Date.now() });

      return { ...categorized, traceId };
    } catch (err: any) {
      logger.error(`[TokenService][${traceId}] Fetch failed for ${safeAddr}: ${err.message}`);
      throw err;
    }
  },

  /**
   * Universal Categorization Engine
   * Enhanced for "Real Money" safety:
   * - Filters out known phishing/zero-value transfer attacks.
   * - Validates token metadata before inclusion.
   */
  async categorizeAssets(rawAssets: any[]) {
    // 1. Parallel Classification (Speed-optimized for large portfolios)
    const results = await Promise.all(
      rawAssets.map(async (asset) => {
        try {
          const analysis = await classifyToken(asset);
          
          // ANTI-PHISHING GUARD: Flag suspicious zero-balance or unverified contracts
          const isSuspicious = analysis.status === 'spam' && (asset.balance === '0' || !asset.symbol);
          
          return { 
            ...asset, 
            ...analysis,
            isSuspicious,
            lastVerified: new Date().toISOString()
          };
        } catch (e: any) {
          // FIXED: Explicitly cast 'e' to any to resolve TS18046 'unknown' error
          const errorMsg = e instanceof Error ? e.message : String(e);
          logger.warn(`[TokenService] Classification failed for ${asset.symbol || 'Unknown'}: ${errorMsg}`);
          return { ...asset, status: 'unverified', usdValue: 0, error: errorMsg };
        }
      })
    );

    // 2. Structured Data Categorization
    // We separate 'verified' from 'clean' to highlight high-confidence assets
    return {
      summary: {
        totalAssets: results.length,
        totalUsdValue: Number(results.reduce((sum, a) => sum + (a.usdValue || 0), 0).toFixed(2)),
        dustCount: results.filter(a => a.status === 'dust').length,
        spamCount: results.filter(a => a.status === 'spam').length,
        riskScore: results.some(a => a.isSuspicious) ? 'ELEVATED' : 'LOW'
      },
      groups: {
        // High-confidence assets only
        clean: results.filter(a => (a.status === 'verified' || a.status === 'clean') && !a.isSuspicious),
        dust: results.filter(a => a.status === 'dust'),
        // Include everything flagged as spam or suspicious
        spam: results.filter(a => a.status === 'spam' || a.isSuspicious)
      },
      all: results
    };
  }
};
