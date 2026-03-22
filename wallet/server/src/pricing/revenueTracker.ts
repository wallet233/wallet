import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';

/**
 * Premium Revenue Tracker
 * Logs every platform fee (Dust Rescue/Burn) into the global treasury ledger.
 */
export const revenueTracker = {
  /**
   * Tracks a successful fee extraction (5% or 7.5%)
   */
  async trackFee(wallet: string, amountUsd: number, type: 'RESCUE' | 'BURN' | 'SUBSCRIPTION', chain: string) {
    try {
      const entry = await prisma.payment.create({
        data: {
          wallet: wallet.toLowerCase(),
          amount: amountUsd,
          chain: chain,
          confirmed: true, // This is internal revenue, already confirmed on-chain
          createdAt: new Date()
        }
      });

      logger.info(`[Revenue] $${amountUsd} tracked from ${type} on ${chain}`);
      return entry;
    } catch (err: any) {
      logger.error(`[Revenue] Failed to log fee: ${err.message}`);
      return null;
    }
  },

  /**
   * Calculates total platform earnings
   */
  async getStats() {
    const total = await prisma.payment.aggregate({
      where: { confirmed: true },
      _sum: { amount: true }
    });
    return { totalRevenueUsd: total._sum.amount || 0 };
  }
};
