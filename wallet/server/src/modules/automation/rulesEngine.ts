import { ethers, getAddress, isAddress } from 'ethers';
import { getProvider } from '../../blockchain/provider.js';
import { logger } from '../../utils/logger.js';
import { EVM_CHAINS } from '../../blockchain/chains.js';

/**
 * UPGRADED: Production-Grade Automation Rules & Gating.
 * Features: Multi-Chain Membership, Dynamic Gas Profitability, and Priority Sequencing.
 */
const MINIMAL_NFT_ABI = [
  "function balanceOf(address owner) view returns (uint256)"
];

// Configuration from Environment (No more hardcoding)
const CONFIG = {
  NFT_CONTRACTS: (process.env.MEMBERSHIP_NFT_ADDRESSES || '').split(',').filter(isAddress),
  MEMBERSHIP_CHAIN: process.env.MEMBERSHIP_CHAIN_ID || '8453', // Default: Base
  DEFAULT_MAX_GAS: Number(process.env.MAX_GAS_GWEI) || 35,
  SCAN_TIMEOUT_MS: 4000
};

export const rulesEngine = {
  /**
   * Verified Automation Eligibility (Gating)
   * Upgraded: Checks if the user holds a "Real Money" pass across all approved collections.
   */
  async isEligibleForAutomation(walletAddress: string): Promise<boolean> {
    if (!walletAddress || !isAddress(walletAddress)) return false;
    
    try {
      const safeAddr = getAddress(walletAddress);
      
      // 1. Identify the chain where membership lives (e.g., Base for low fees)
      const chain = EVM_CHAINS.find(c => c.id === Number(CONFIG.MEMBERSHIP_CHAIN)) || EVM_CHAINS[0];
      const provider = getProvider(chain.rpc);

      if (CONFIG.NFT_CONTRACTS.length === 0) {
        logger.warn(`[RulesEngine] No NFT membership addresses configured in ENV.`);
        return false;
      }

      // 2. Parallel Membership Check (Race against timeout)
      const checks = CONFIG.NFT_CONTRACTS.map(async (contractAddr) => {
        try {
          const nftContract = new ethers.Contract(contractAddr, MINIMAL_NFT_ABI, provider);
          
          const balance = await Promise.race([
            nftContract.balanceOf(safeAddr),
            new Promise<bigint>((_, reject) => 
              setTimeout(() => reject(new Error('RPC Timeout')), CONFIG.SCAN_TIMEOUT_MS)
            )
          ]);
          
          return (balance as bigint) > 0n;
        } catch {
          return false;
        }
      });

      const results = await Promise.all(checks);
      const isMember = results.some(held => held === true);

      if (isMember) {
        logger.debug(`[RulesEngine] Access Granted for ${safeAddr} on ${chain.name}`);
      }
      
      return isMember;
    } catch (err: any) {
      logger.error(`[RulesEngine] Gating Critical Error: ${err.message}`);
      return false; 
    }
  },

  /**
   * Production Gas Price Guard (EIP-1559 Aware)
   * Intelligence: Ensures the network isn't too expensive for automated tasks.
   */
  async shouldExecuteNow(chainId: number, customMaxGwei?: number): Promise<boolean> {
    try {
      const chain = EVM_CHAINS.find(c => c.id === chainId);
      if (!chain) return false;

      const provider = getProvider(chain.rpc);
      const feeData = await provider.getFeeData();
      
      // Use maxFeePerGas for EIP-1559 chains, fallback to legacy gasPrice
      const currentWei = feeData.maxFeePerGas || feeData.gasPrice;
      if (!currentWei) return false;

      const currentGwei = Number(ethers.formatUnits(currentWei, 'gwei'));
      const threshold = customMaxGwei || CONFIG.DEFAULT_MAX_GAS;
      
      const isAcceptable = currentGwei <= threshold;
      
      if (!isAcceptable) {
        logger.warn(`[RulesEngine] High Gas Spike: ${currentGwei.toFixed(2)} Gwei on ${chain.name} (Limit: ${threshold})`);
      }

      return isAcceptable;
    } catch (err: any) {
      logger.error(`[RulesEngine] Gas calculation failure: ${err.message}`);
      return false;
    }
  },

  /**
   * High-Precision Profitability Check (The "Real Money" Guard)
   * Prevents spending $10 in gas to recover $5 in assets.
   */
  async isRecoveryProfitable(gasLimit: bigint, gasPriceGwei: number, totalUsdValue: number): Promise<boolean> {
    const gasCostEth = Number(ethers.formatEther(gasLimit * ethers.parseUnits(gasPriceGwei.toString(), 'gwei')));
    // Mock ETH Price - in production, this should come from your Pricing service
    const ethPrice = 3000; 
    const gasCostUsd = gasCostEth * ethPrice;

    // Only proceed if we recover at least 2x the gas cost
    return totalUsdValue > (gasCostUsd * 2);
  },

  /**
   * Rule Execution Sequencer
   * Ensures 'Real Money' is handled in the safest order.
   */
  async getExecutionPriority<T extends { type: string }>(rules: T[]): Promise<T[]> {
    const priority: Record<string, number> = { 
      'SECURITY': 1, 
      'AUTO_BURN': 2, 
      'AUTO_RECOVERY': 3 
    };

    return [...rules].sort((a, b) => 
      (priority[a.type] || 99) - (priority[b.type] || 99)
    );
  }
};
