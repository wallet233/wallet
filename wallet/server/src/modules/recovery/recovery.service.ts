import { detectDustTokens } from './dustCalculator.js';
import { swapExecutor } from './swapExecutor.js';
import { rulesEngine } from '../automation/rulesEngine.js';
import { feeCalculator } from '../../pricing/feeCalculator.js';
import { flashbotsExecution } from '../../blockchain/flashbotsExecution.js';
import { EVM_CHAINS } from '../../blockchain/chains.js';
import { logger } from '../../utils/logger.js';
import { prisma } from '../../config/database.js';
import crypto from 'crypto';

/**
 * UPGRADED: High-Reliability Recovery Intelligence Service.
 * Features: Atomic Traceability, MEV-Shielded Execution, and Strict Fee Auditing.
 */
export const recoveryService = {
  /**
   * Orchestrates the migration of profitable "dust" assets to safety.
   */
  async executeDustRecovery(walletAddress: string, encryptedPrivateKey?: string) {
    if (!walletAddress) throw new Error('VALID_WALLET_REQUIRED');
    
    const startTime = Date.now();
    const safeAddr = walletAddress.toLowerCase();
    const traceId = `REC-${crypto.randomUUID?.() || Date.now()}`;

    try {
      logger.info(`[Recovery][${traceId}] Initiating high-value rescue: ${safeAddr}`);

      // 1. INTELLIGENCE GATHERING & ELIGIBILITY
      const [dustReports, isNftHolder] = await Promise.all([
        detectDustTokens(safeAddr),
        rulesEngine.isEligibleForAutomation(safeAddr)
      ]);

      const profitableTokens = dustReports.filter(t => t.isProfitable);

      if (profitableTokens.length === 0) {
        return { 
          success: true, 
          traceId,
          message: 'No profitable recovery targets found.', 
          data: { tokensFound: 0, plans: [] } 
        };
      }

      // 2. FINANCIAL PROFILING
      const totalGrossUsd = profitableTokens.reduce((sum, t) => sum + (Number(t.asset?.usdValue) || 0), 0);
      const avgRiskScore = profitableTokens.reduce((sum, t) => sum + (Number(t.asset?.score) || 100), 0) / profitableTokens.length;

      // 3. DYNAMIC FEE ENGINE
      const feeContext = {
        amountUsd: totalGrossUsd,
        isGasless: true, 
        isNftHolder,
        riskScore: 100 - avgRiskScore 
      };

      const feeReport = feeCalculator.calculateRescueFee(feeContext);

      // Real Money Guard: Don't execute if the protocol fee + gas consumes too much of the value
      if (!feeReport.isProfitable) {
        logger.warn(`[Recovery][${traceId}] Rescue aborted: Unprofitable for user after fees.`);
        return { success: false, traceId, error: 'INSUFFICIENT_VALUE', message: 'Dust value below fee threshold.' };
      }

      // 4. STRATEGY ORCHESTRATION
      const rescuePlans = await swapExecutor.getSmartRescueQuote(safeAddr, profitableTokens);
      const executionResults = [];

      // 5. ATOMIC EXECUTION (Flashbots Bridge)
      if (encryptedPrivateKey && rescuePlans.length > 0) {
        for (const plan of rescuePlans) {
          const chain = EVM_CHAINS.find(c => c.name.toLowerCase() === plan.chain.toLowerCase());
          
          if (chain && (plan.strategy === 'RELAYED' || plan.securityStatus === 'PROTECTED')) {
             logger.info(`[Recovery][${traceId}] Executing private bundle on ${plan.chain}...`);
             
             const result = await flashbotsExecution.executeBundle(
               encryptedPrivateKey,
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

      // 6. PERSISTENCE & AUDIT TRAIL
      // We store the traceId to link the DB record to the logs permanently
      const hasSuccess = executionResults.some(r => r.success);
      const primaryTxHash = hasSuccess ? executionResults.find(r => r.success)?.txHash : undefined;

      await prisma.recoveryAttempt.create({
        data: {
          traceId,
          walletAddress: safeAddr,
          tokenCount: profitableTokens.length,
          estimatedTotalUsd: totalGrossUsd.toFixed(2),
          status: hasSuccess ? 'SUCCESS' : 'FAILED'
        }
      }).catch((err: any) => logger.error(`[Recovery][${traceId}] Audit Log Failed: ${err.message}`));

      const duration = (Date.now() - startTime) / 1000;

      return {
        success: hasSuccess,
        txHash: primaryTxHash,
        traceId,
        wallet: safeAddr,
        latency: `${duration}s`,
        tier: feeReport.tier,
        pricing: {
          totalGrossUsd: totalGrossUsd.toFixed(2),
          protocolFeeUsd: feeReport.feeUsd.toFixed(2),
          userNetUsd: feeReport.userShareUsd.toFixed(2)
        },
        summary: {
          totalTokensFound: profitableTokens.length,
          successfulExecutions: executionResults.filter(r => r.success).length
        },
        plans: rescuePlans,
        executionDetails: executionResults,
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      logger.error(`[Recovery][${traceId}] Critical failure: ${error.stack}`);
      return { 
        success: false, 
        traceId,
        error: 'RECOVERY_ENGINE_CRASH', 
        message: error.message 
      };
    }
  }
};
