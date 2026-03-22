import { batchBurnTokens } from './batchBurnEngine.js';
import { tokenService } from '../tokens/token.service.js';
import { scanGlobalWallet } from '../../blockchain/walletScanner.js';
import { flashbotsExecution } from '../../blockchain/flashbotsExecution.js';
import { EVM_CHAINS } from '../../blockchain/chains.js';
import { logger } from '../../utils/logger.js';
import { prisma } from '../../config/database.js';

/**
 * Premium Burn Service - Tier 1 
 * Integrated with MEV-Shielding and Intelligence-driven batching.
 */
export const burnService = {
  /**
   * Dynamically handles spam burning. 
   * @param walletAddress The user's address
   * @param privateKey Required for signing Flashbots bundles
   * @param preScannedTokens Optional pre-filtered list
   */
  async executeSpamBurn(walletAddress: string, privateKey: string, preScannedTokens?: any[]) {
    const startTime = Date.now();
    const safeAddr = walletAddress.toLowerCase();

    try {
      logger.info(`[BurnService] Initiating Sanitization: ${safeAddr}`);

      let spamTokens = preScannedTokens;

      // 1. INTELLIGENCE: Scan if not provided
      if (!spamTokens) {
        const rawAssets = await scanGlobalWallet(safeAddr);
        const categorized = await tokenService.categorizeAssets(rawAssets);
        spamTokens = categorized.groups.spam;
      }

      if (!spamTokens || spamTokens.length === 0) {
        return {
          success: true,
          message: 'Wallet is clean! No spam tokens detected.',
          data: { burnedCount: 0, plans: [] }
        };
      }

      // 2. BATCH PLANNING: Build the payloads
      const burnPlans = await batchBurnTokens(safeAddr, spamTokens);
      const executionResults = [];

      // 3. DYNAMIC EXECUTION: Loop through plans and execute via Flashbots Bridge
      for (const plan of burnPlans) {
        const chain = EVM_CHAINS.find(c => c.name === plan.chain);
        
        if (chain && plan.status === 'PROTECTED' && plan.payloads.length > 0) {
          logger.info(`[BurnService] Sending private bundle to ${plan.chain}...`);
          
          const result = await flashbotsExecution.executeBundle(
            privateKey,
            chain.rpc,
            plan.payloads,
            chain.id
          );
          
          executionResults.push({
            chain: plan.chain,
            success: result.success,
            error: result.error,
            txHash: result.txHash
          });
        }
      }

      // 4. PERSISTENCE & ANALYTICS: Update Health Score
      await prisma.wallet.update({
        where: { address: safeAddr },
        data: { 
          lastSynced: new Date(),
          healthScore: 100,
          riskLevel: 'LOW'
        }
      }).catch((err: any) => logger.warn(`[BurnService] DB Sync skipped: ${err.message}`));

      const duration = (Date.now() - startTime) / 1000;

      return {
        success: true,
        wallet: safeAddr,
        latency: `${duration}s`,
        summary: {
          spamTokensFound: spamTokens.length,
          totalChainsProcessed: executionResults.length,
          successfulChains: executionResults.filter(r => r.success).length
        },
        executionResults,
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      logger.error(`[BurnService] Critical failure for ${safeAddr}: ${error.message}`);
      return {
        success: false,
        error: 'Spam Burn Engine encountered an error',
        message: error.message
      };
    }
  }
};
