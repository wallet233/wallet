import { detectDustTokens } from './dustCalculator.js';
import { getSmartRescueQuote } from '../../transactions/swapExecutor.js';

export async function executeDustRecovery(walletAddress: string) {
  // 1. Find profitable dust across all 50+ chains
  const rawDust = await detectDustTokens(walletAddress);

  // ✅ Fix: Filter out any null/undefined entries to satisfy TypeScript
  const dustTokens = rawDust.filter((t): t is NonNullable<typeof t> => t !== null);

  if (dustTokens.length === 0) {
    return { 
      success: true, 
      message: 'No profitable dust found after gas calculation', 
      plans: [] 
    };
  }

  // 2. Apply our Smart-Fee Logic (5% if user has gas, 7.2% if gasless relay)
  const rescuePlans = await getSmartRescueQuote(walletAddress, dustTokens);

  return {
    success: true,
    wallet: walletAddress,
    summary: {
      tokensFound: dustTokens.length,
      totalChains: new Set(dustTokens.map(t => t.chain)).size
    },
    plans: rescuePlans,
    timestamp: new Date().toISOString()
  };
}
