import { detectDustTokens, DustReport } from './dustCalculator.js';
import { swapExecutor } from './swapExecutor.js';
import { rulesEngine } from '../automation/rulesEngine.js';
import { feeCalculator } from '../../pricing/feeCalculator.js';
import { flashbotsExecution } from '../../blockchain/flashbotsExecution.js';
import { EVM_CHAINS } from '../../blockchain/chains.js';
import { logger } from '../../utils/logger.js';
import { prisma } from '../../config/database.js';

/**
 * Tier 1 Recovery Intelligence Service
 * Orchestrates: Discovery -> Risk Profiling -> Fee Optimization -> Execution.
 */
export const recoveryService = {
  /**
   * Heavy-Duty Recovery Logic
   * Dynamically adjusts fees based on user tier and asset health.
   * @param walletAddress User's public address
   * @param privateKey Required for automated execution (Optional for pure quoting)
   */
  async executeDustRecovery(walletAddress: string, privateKey?: string) {
    if (!walletAddress) throw new Error('Wallet address is required');
    
    const startTime = Date.now();
    const safeAddr = walletAddress.toLowerCase();

    try {
      logger.info(`[Recovery] Starting intelligence-driven rescue scan: ${safeAddr}`);

      // 1. DYNAMIC INTELLIGENCE GATHERING
      const [dustReports, isNftHolder] = await Promise.all([
        detectDustTokens(safeAddr),
        rulesEngine.isEligibleForAutomation(safeAddr)
      ]);

      const profitableTokens = dustReports.filter(t => t.isProfitable);

      if (profitableTokens.length === 0) {
        return { 
          success: true, 
          message: 'Wallet Healthy: No profitable dust found.', 
          data: { tokensFound: 0, plans: [] } 
        };
      }

      // 2. INTELLIGENCE: Calculate Global Recovery Context
      const totalGrossUsd = profitableTokens.reduce((sum, t) => sum + (t.asset?.usdValue || 0), 0);
      const avgRiskScore = profitableTokens.length > 0 ? 
        profitableTokens.reduce((sum, t) => sum + (t.asset?.score || 100), 0) / profitableTokens.length : 100;

      // 3. DYNAMIC FEE CALCULATION
      const feeContext = {
        amountUsd: totalGrossUsd,
        isGasless: true,
        isNftHolder,
        riskScore: 100 - avgRiskScore 
      };

      const feeReport = feeCalculator.calculateRescueFee(feeContext);

      if (!feeReport.isProfitable) {
        logger.warn(`[Recovery] Skipping low-value rescue for ${safeAddr}: $${totalGrossUsd} value.`);
        return { success: false, error: 'Low Value', message: 'Dust value does not cover execution costs.' };
      }

      // 4. STRATEGY ORCHESTRATION: Get Quote
      const rescuePlans = await swapExecutor.getSmartRescueQuote(safeAddr, profitableTokens);
      const executionResults = [];

      // 5. DYNAMIC EXECUTION: If privateKey is provided, trigger the Flashbots Bridge
      if (privateKey && rescuePlans.length > 0) {
        logger.info(`[Recovery] Initiating Automated Execution for ${safeAddr}`);
        
        for (const plan of rescuePlans) {
          const chain = EVM_CHAINS.find(c => c.name === plan.chain);
          
          // Only execute if strategy requires shielding or if it is a protected chain
          if (chain && (plan.strategy === 'RELAYED' || plan.securityStatus === 'PROTECTED')) {
             const result = await flashbotsExecution.executeBundle(
               privateKey,
               chain.rpc,
               plan.payloads || [],
               chain.id
             );
             
             executionResults.push({
               chain: plan.chain,
               success: result.success,
               txHash: result.txHash,
               error: result.error
             });
          }
        }
      }

      // 6. ANALYTICS & DB LOGGING
      prisma.recoveryAttempt.create({
        data: {
          walletAddress: safeAddr,
          tokenCount: profitableTokens.length,
          estimatedTotalUsd: totalGrossUsd.toFixed(2),
          status: executionResults.some(r => r.success) ? 'SUCCESS' : 'PENDING'
        }
      }).catch((err: any) => logger.warn(`[Recovery DB] Sync skipped: ${err.message}`));

      const duration = (Date.now() - startTime) / 1000;

      // 7. PREMIUM INTELLIGENCE RESPONSE
      return {
        success: true,
        wallet: safeAddr,
        latency: `${duration}s`,
        tier: feeReport.tier,
        pricing: {
          totalGrossUsd: totalGrossUsd.toFixed(2),
          protocolFeeUsd: feeReport.feeUsd.toFixed(2),
          userNetUsd: feeReport.userShareUsd.toFixed(2),
          feePercentage: feeReport.percentage
        },
        summary: {
          totalTokensFound: profitableTokens.length,
          activeChains: [...new Set(profitableTokens.map(t => t.asset.chain))],
          executionsPerformed: executionResults.length
        },
        plans: rescuePlans,
        executionDetails: executionResults,
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      logger.error(`[Recovery] Critical failure for ${safeAddr}: ${error.message}`);
      return { 
        success: false, 
        error: 'Recovery engine failed', 
        message: error.message 
      };
    }
  }
};
