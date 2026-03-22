import { getProvider } from './provider.js';
import { logger } from '../utils/logger.js';
import { ethers } from 'ethers';

/**
 *  Gas Optimizer
 * Dynamic EIP-1559 Support + L2 Overhead Handling
 */
export const gasOptimizer = {
  /**
   * Calculates the most aggressive but cost-effective gas strategy.
   * Logic: 15% Priority Buffer for Automation, L1 Data Fee Awareness.
   */
  async getOptimalFees(rpcOrChainId: string) {
    try {
      const provider = getProvider(rpcOrChainId);
      const feeData = await provider.getFeeData();

      //  EIP-1559 Bumping (15% Aggressive for Auto-Burn/Recovery)
      // We use 115/100 to ensure we stay at the front of the mempool
      const maxPriorityFee = feeData.maxPriorityFeePerGas 
        ? (feeData.maxPriorityFeePerGas * 115n) / 100n 
        : ethers.parseUnits('1.5', 'gwei'); // Default fallback for priority

      const maxFee = feeData.maxFeePerGas 
        ? (feeData.maxFeePerGas * 110n) / 100n 
        : null;

      //  L2 Specific Strategy (Base / Optimism / Arbitrum)
      // These chains often require a higher gasLimit rather than just a higher price
      const isL2 = rpcOrChainId.toLowerCase().includes('base') || 
                   rpcOrChainId.toLowerCase().includes('optimism');

      return {
        maxFeePerGas: maxFee,
        maxPriorityFeePerGas: maxPriorityFee,
        gasPrice: feeData.gasPrice,
        strategy: isL2 ? 'L2_BATCH_AWARE' : 'EIP1559_STANDARD',
        timestamp: Date.now()
      };
    } catch (err: any) {
      logger.error(`[GasOptimizer] Critical Fee Fetch Error: ${err.message}`);
      // Return a safe 'Standard' fallback to prevent app-wide crashes
      return {
        gasPrice: ethers.parseUnits('25', 'gwei'),
        maxFeePerGas: ethers.parseUnits('30', 'gwei'),
        maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
        strategy: 'FALLBACK'
      };
    }
  }
};
