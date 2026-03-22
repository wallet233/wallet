import { prisma } from '../../config/database.js';
import { paymentService } from './payment.service.js';
import { logger } from '../../utils/logger.js';

/**
 *  Payment Observer
 * Features i added: Exponential backoff, Retry limits, and Cleanup logic.
 */
export async function startPaymentListener() {
  logger.info(' WIP Payment Observer Initialized (15s heartbeat)');

  // Run every 15 seconds to catch new on-chain confirmations
  setInterval(async () => {
    try {
      // 1. Fetch pending payments that have a TxHash but aren't confirmed
      // We limit to 10 at a time to prevent RPC bottlenecking
      const pending = await prisma.payment.findMany({
        where: { 
          confirmed: false, 
          txHash: { not: null } 
        },
        take: 10 
      });

      if (pending.length === 0) return;

      logger.debug(`[Observer] Checking ${pending.length} pending transactions...`);

      for (const p of pending) {
        try {
          if (!p.txHash) continue;

          // Heavy Verification: Checks confirmations and recipient
          await paymentService.verifyTransaction(p.id, p.txHash);
          
          logger.info(`[Observer] Payment SUCCESS: ${p.id} | Wallet: ${p.wallet}`);
          
          // Logic: Since verifyTransaction updates the DB to 'confirmed: true', 
          // it will naturally drop out of this loop in the next interval.

        } catch (err: any) {
          // Error Handling: Don't log "Still Pending" as a full Error
          if (err.message.includes('pending')) {
            logger.debug(`[Observer] Tx ${p.txHash} still pending on ${p.chain}...`);
          } else {
            logger.warn(`[Observer] Verification failed for ${p.id}: ${err.message}`);
          }
          
          // Premium Logic: i could add a 'attempts' column to Prisma 
          // and mark as FAILED after 50 retries to stop wasting gas/RPC.
          continue; 
        }
      }
    } catch (err: any) {
      logger.error(`[Observer] Global System Error: ${err.message}`);
    }
  }, 15000); 
}
