import { prisma } from '../../config/database.js';
import { paymentService } from './payment.service.js';
import { logger } from '../../utils/logger.js';
import { mutex } from '../../utils/mutex.js';
import { helpers } from '../../utils/helpers.js';

/**
 * UPGRADED: Production-Grade Payment Observer.
 * Features: Distributed Locking, Stale Transaction Expiry, and RPC Batching.
 */
export async function startPaymentListener() {
  const HEARTBEAT_MS = 20000; // 20s interval for better RPC economy
  const globalLockId = 'worker:payment_listener';

  logger.info(`[PaymentObserver] Starting high-fidelity monitor (${HEARTBEAT_MS}ms)`);

  setInterval(async () => {
    const traceId = `PAY-OBS-${Date.now()}`;
    
    // 1. DISTRIBUTED LOCK: Ensure only one server instance is checking payments
    const ownerId = await mutex.acquire(globalLockId, HEARTBEAT_MS);
    if (!ownerId) return; // Another instance is already observing

    try {
      // 2. FETCH PENDING TASKS
      // Filter: Unconfirmed, has a hash, and is less than 2 hours old
      const pending = await prisma.payment.findMany({
        where: { 
          confirmed: false, 
          status: { in: ['PENDING', 'PROCESSING'] },
          txHash: { not: null },
          createdAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) }
        },
        take: 15,
        orderBy: { createdAt: 'asc' }
      });

      if (pending.length === 0) return;

      logger.info(`[PaymentObserver][${traceId}] Verifying ${pending.length} on-chain transactions...`);

      for (const p of pending) {
        if (!p.txHash) continue;

        // 3. PER-PAYMENT LOCK: Prevent collision with manual "Verify" button clicks
        const pLockId = `verify_pay:${p.id}`;
        const pOwnerId = await mutex.acquire(pLockId, 60000);
        if (!pOwnerId) continue;

        try {
          // 4. HEAVY VERIFICATION (Calls RPCs for Block Depth & Recipient)
          await paymentService.verifyTransaction(p.id, p.txHash);
          
          logger.info(`[PaymentObserver][SUCCESS] ID: ${p.id} | TX: ${p.txHash} | Chain: ${p.chain}`);

        } catch (err: any) {
          const msg = err.message.toLowerCase();
          
          // 5. SMART ERROR HANDLING
          if (msg.includes('pending') || msg.includes('not found') || msg.includes('depth')) {
            // Normal blockchain delay - update status to PROCESSING
            await prisma.payment.update({
              where: { id: p.id },
              data: { status: 'PROCESSING' }
            }).catch(() => {});
          } else {
            logger.warn(`[PaymentObserver][REJECTED] ${p.id}: ${err.message}`);
          }
        } finally {
          await mutex.release(pLockId, pOwnerId);
          // Small jitter to prevent hitting RPC rate limits
          await helpers.sleep(200); 
        }
      }

      // 6. AUTO-CLEANUP: Mark very old pending payments as EXPIRED
      const expiryThreshold = new Date(Date.now() - 4 * 60 * 60 * 1000);
      await prisma.payment.updateMany({
        where: { 
          confirmed: false, 
          status: 'PENDING',
          createdAt: { lt: expiryThreshold } 
        },
        data: { status: 'EXPIRED' }
      });

    } catch (err: any) {
      logger.error(`[PaymentObserver][${traceId}] Global failure: ${err.message}`);
    } finally {
      await mutex.release(globalLockId, ownerId);
    }
  }, HEARTBEAT_MS);
}
