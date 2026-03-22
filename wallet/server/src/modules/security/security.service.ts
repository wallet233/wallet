import { getAddress, formatUnits } from 'ethers';
import { getAlchemyUrl } from '../../blockchain/provider.js';
import { logger } from '../../utils/logger.js';

export interface Allowance {
  tokenAddress: string;
  spender: string;
  amount: string;
  isInfinite: boolean;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
}

export const securityService = {
  /**
   * Scans for open token approvals using Alchemy's specialized API
   */
  async scanApprovals(walletAddress: string, network: string = 'ethereum'): Promise<Allowance[]> {
    const url = getAlchemyUrl(network);
    if (!url) return [];

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "alchemy_getTokenAllowances",
          params: [{ owner: getAddress(walletAddress), pageKey: null }]
        })
      });

      const { result } = await res.json();
      if (!result?.tokenAllowances) return [];

      return result.tokenAllowances.map((allowance: any) => {
        const amount = allowance.allowance;
        // Logic: Infinite is usually 0xffffff...
        const isInfinite = amount.includes('f'); 
        
        return {
          tokenAddress: getAddress(allowance.tokenAddress),
          spender: getAddress(allowance.spender),
          amount: isInfinite ? 'Infinite' : amount,
          isInfinite,
          riskLevel: isInfinite ? 'HIGH' : 'LOW'
        };
      });
    } catch (err: any) {
      logger.error(`[SecurityService] Approval scan failed: ${err.message}`);
      return [];
    }
  }
};
