import cron from 'node-cron';
import { prisma } from '../config/database.js';
import { tokenService } from '../modules/tokens/token.service.js';
import { securityService } from '../modules/security/security.service.js';
import { logger } from '../utils/logger.js';

/**
 * Tier 1 Wallet Health Engine
 * Runs every hour to calculate a 0-100% Security Score for every user.
 */
export const startHealthWorker = () => {
  cron.schedule('0 * * * *', async () => {
    logger.info('[Worker: Health] Recalculating global security scores...');
    
    try {
      const wallets = await prisma.wallet.findMany();

      for (const w of wallets) {
        try {
          // 1. Get Token Data (Spam vs Clean)
          const tokenData = await tokenService.fetchWalletTokens(w.address);
          
          // 2. Get Security Data (Open Approvals)
          const securityData = await securityService.scanApprovals(w.address);

          // 3. LOGIC: Scoring Algorithm
          // Start at 100%. Deduct 5% per Spam token. Deduct 20% per Infinite Approval.
          let score = 100;
          score -= (tokenData.summary.spamCount * 5);
          score -= (securityData.filter(a => a.riskLevel === 'HIGH').length * 20);

          // Bound the score between 0 and 100
          const finalScore = Math.max(0, Math.min(100, score));
          
          // Determine Risk Label
          let risk = 'LOW';
          if (finalScore < 80) risk = 'MEDIUM';
          if (finalScore < 50) risk = 'HIGH';

          // 4. PERSISTENCE: Save the new Health State
          await prisma.wallet.update({
            where: { address: w.address },
            data: { 
              healthScore: finalScore,
              riskLevel: risk,
              lastSynced: new Date()
            }
          });

          logger.info(`[Worker: Health] ${w.address} | Score: ${finalScore}% | Risk: ${risk}`);
        } catch (singleErr: any) {
          logger.warn(`[Worker: Health] Skip ${w.address}: ${singleErr.message}`);
          continue;
        }
      }
      logger.info('[Worker: Health] Global recalculation finished.');
    } catch (err: any) {
      logger.error(`[Worker: Health] Global System Error: ${err.message}`);
    }
  });

  logger.info('[Worker] Wallet Health Heartbeat Initialized.');
};
