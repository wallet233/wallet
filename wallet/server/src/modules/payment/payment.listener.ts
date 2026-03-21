import prisma from '../../config/database.js';
import { paymentService } from './payment.service.js';

export async function startPaymentListener() {
  console.log('💎 WIP Payment Observer Started');

  setInterval(async () => {
    try {
      // Find payments that have a txHash but aren't confirmed yet
      const pending = await prisma.payment.findMany({
        where: { confirmed: false, txHash: { not: null } }
      });

      for (const p of pending) {
        try {
          if (p.txHash) {
            await paymentService.verifyTransaction(p.id, p.txHash);
            console.log(`✅ Auto-Confirmed Payment: ${p.id}`);
          }
        } catch {
          // If still pending or failed, we skip and try next interval
          continue;
        }
      }
    } catch (err) {
      console.error('Observer Error:', err);
    }
  }, 15000); // Check every 15 seconds
}
