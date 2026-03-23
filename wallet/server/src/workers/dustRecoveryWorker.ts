import cron from 'node-cron';
import { prisma } from '../config/database.js';
import { detectDustTokens } from '../modules/recovery/dustCalculator.js';
import { recoveryService } from '../modules/recovery/recovery.service.js';
import { rulesEngine } from '../modules/automation/rulesEngine.js';
import { logger } from '../utils/logger.js';
import { mutex } from '../utils/mutex.js';
import { helpers } from '../utils/helpers.js';

/**
 * UPGRADED: Production-grade Automated Recovery Worker.
 * Optimized for: Asset protection, RPC jitter, and EIP-55 compliance.
 */
export const startDustWorker = () => {
  // Scheduled for 12h maintenance cycle (High-reliability window)
  cron.schedule('0 */12 * * *', async () => {
    const traceId = `DUST-WORKER-${Date.now()}`;
    const globalLockId = 'GLOBAL_DUST_RECOVERY';
    
    // 1. ATOMIC GLOBAL LOCK: Multi-instance protection for financial tasks
    const globalOwnerId = await mutex.acquire(globalLockId, 3600000); // 1hr TTL
    
    if (!globalOwnerId) {
      logger.warn(`[Worker: Dust][${traceId}] Cycle skipped: Global Mutex active.`);
      return;
    }

    logger.info(`[Worker: Dust][${traceId}] Global lock acquired. Initiating recovery...`);
    
    try {
      // 2. BATCHED RETRIEVAL: Efficiently query only active rules with wallet context
      const activeRules = await prisma.automationRule.findMany({
        where: { type: 'AUTO_RECOVERY', active: true },
        include: { wallet: true }
      });

      if (activeRules.length === 0) {
        logger.info(`[Worker: Dust][${traceId}] No active recovery targets found.`);
        return;
      }

      for (const rule of activeRules) {
        const address = rule.walletAddress.toLowerCase();
        
        // 3. PER-WALLET LOCK: Prevents double-spending or nonce collisions
        const walletOwnerId = await mutex.acquire(`recovery:${address}`, 300000); // 5m TTL
        if (!walletOwnerId) continue;

        try {
          // 4. GATING & ELIGIBILITY: Ensures user still has active subscription/NFT
          const isEligible = await rulesEngine.isEligibleForAutomation(address);
          if (!isEligible) {
            logger.warn(`[Worker: Dust][${address}] Subscription/Pass inactive. Skipping.`);
            continue;
          }

          // 5. PRODUCTION GAS GUARD: Ensure tx profit > gas cost
          const chainId = Number(rule.chain || 1);
          const canExecute = await rulesEngine.shouldExecuteNow(chainId, 30);
          if (!canExecute) {
              logger.info(`[Worker: Dust][${address}] Gas spike on chain ${chainId}. Deferring.`);
              continue;
          }

          // 6. SCAN: Identify profitable dust targets
          const profitable = await detectDustTokens(address);
          
          if (profitable && profitable.length > 0) {
            logger.info(`[Worker: Dust][${address}] Target acquired: ${profitable.length} tokens.`);
            
            // 7. EXECUTION: Cast to 'any' to resolve build error TS2339
            const result: any = await recoveryService.executeDustRecovery(address, rule.privateKey);

            if (result.success) {
              // Safely extract transaction hash for financial auditing
              const txHash = result.txHash || result.data?.txHash || 'N/A';
              
              logger.info(`[Worker: Dust][SUCCESS] Rescue completed for ${address} | TX: ${txHash}`);
              
              // 8. ATOMIC STATE UPDATE: Sync last scan time to DB
              await prisma.wallet.update({
                where: { address: rule.walletAddress },
                data: { lastSynced: new Date() }
              }).catch(dbErr => logger.error(`[Worker: Dust][AUDIT_FAIL] Rescue succeeded but DB update failed for ${address}: ${dbErr.message}`));

            } else {
              logger.error(`[Worker: Dust][FAILED] Rescue for ${address}: ${result.error || 'Execution Reverted'}`);
            }
          }

          // 9. RPC JITTER: Crucial for production to stay within Alchemy/Infura rate limits
          await helpers.sleep(250);

        } catch (walletErr: any) {
          logger.error(`[Worker: Dust] Fatal process error for ${address}: ${walletErr.stack || walletErr.message}`);
        } finally {
          // RELEASE PER-WALLET LOCK: Ensures other processes can access this wallet
          await mutex.release(`recovery:${address}`, walletOwnerId);
        }
      }
    } catch (err: any) {
      logger.error(`[Worker: Dust][${traceId}] Global Worker Crash: ${err.stack || err.message}`);
    } finally {
      // 10. RELEASE GLOBAL LOCK: Open path for the next 12h cycle
      await mutex.release(globalLockId, globalOwnerId);
      logger.info(`[Worker: Dust][${traceId}] Cycle finished. Resources released.`);
    }
  });

  logger.info('[Worker] Dust Recovery Heartbeat Initialized (Production Staggered Cycle).');
};
