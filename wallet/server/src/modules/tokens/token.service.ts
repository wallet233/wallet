import { scanGlobalWallet } from '../../blockchain/walletScanner.js';
import { classifyToken } from './spamDetector.js';
import { logger } from '../../utils/logger.js';

export const tokenService = {
  /**
   * High-Performance Pipeline: Scan -> Classify -> Group
   */
  async fetchWalletTokens(address: string) {
    try {
      // 1. Get raw on-chain data
      const rawAssets = await scanGlobalWallet(address);

      // 2. Classify every asset in parallel (Real-time prices)
      const results = await Promise.all(
        rawAssets.map(async (asset) => {
          const analysis = await classifyToken(asset);
          return { ...asset, ...analysis };
        })
      );

      // 3. Heavy Data Categorization
      return {
        summary: {
          totalAssets: results.length,
          totalUsdValue: results.reduce((sum, a) => sum + (a.usdValue || 0), 0),
          dustCount: results.filter(a => a.status === 'dust').length,
          spamCount: results.filter(a => a.status === 'spam').length
        },
        groups: {
          clean: results.filter(a => a.status === 'verified' || a.status === 'clean'),
          dust: results.filter(a => a.status === 'dust'),
          spam: results.filter(a => a.status === 'spam')
        },
        all: results
      };
    } catch (err: any) {
      logger.error(`[TokenService] Fetch failed for ${address}: ${err.message}`);
      throw err;
    }
  }
};
