import { logger } from '../utils/logger.js';
import { ethers } from 'ethers';
import { requireChain } from './chains.js';

/**
 * UPGRADED: High-Precision Gas Optimizer (Finance Grade)
 * Features: EIP-1559 Dynamic Bumping, L2 Overhead Awareness, 
 * and strict 1-20 Gwei safety clamping for cost control.
 */
export const gasOptimizer = {
  /**
   * Calculates the most aggressive but cost-effective gas strategy.
   * Logic: 15-25% Priority Buffer for Automation, L1 Data Fee Awareness.
   */
  async getOptimalFees(chainId: number) {
    // Finance Safety Bounds
    const MIN_GWEI = ethers.parseUnits('1', 'gwei');
    const MAX_GWEI = ethers.parseUnits('20', 'gwei');

    const clamp = (val: bigint) => {
      if (val < MIN_GWEI) return MIN_GWEI;
      if (val > MAX_GWEI) return MAX_GWEI;
      return val;
    };

    try {
      const chainConfig = requireChain(chainId);
      const provider = new ethers.JsonRpcProvider(chainConfig.rpc);
      
      // 1. Concurrent Data Fetching (Block + FeeData)
      const [feeData, latestBlock] = await Promise.all([
        provider.getFeeData(),
        provider.getBlock('latest')
      ]);

      if (!feeData.gasPrice && !feeData.maxFeePerGas) {
        throw new Error('PROVIDER_RETURNED_NULL_FEES');
      }

      // 2. CONGESTION ANALYSIS
      // If the block is > 80% full, we increase the aggressive buffer
      const isCongested = latestBlock ? latestBlock.gasUsed > (latestBlock.gasLimit * 8n / 10n) : false;
      const bufferPercent = isCongested ? 125n : 115n; // 25% if busy, 15% if standard

      // 3. EIP-1559 STRATEGY (Ethereum, Base, Polygon, etc.)
      let maxPriorityFee = feeData.maxPriorityFeePerGas 
        ? (feeData.maxPriorityFeePerGas * bufferPercent) / 100n 
        : ethers.parseUnits('1.5', 'gwei');

      // Base Fee + (Priority Fee * Buffer)
      let maxFee = feeData.maxFeePerGas 
        ? (feeData.maxFeePerGas * 110n) / 100n 
        : null;

      // Apply Finance Safety Clamps
      maxPriorityFee = clamp(maxPriorityFee);
      if (maxFee) maxFee = clamp(maxFee);

      // 4. L2 SPECIFIC OVERHEAD (L1 Data / Blobs)
      const isL2 = chainConfig.isL2 || false;

      // 5. AGGRESSIVE GAS LIMIT SCALING
      const gasLimitMultiplier = isL2 ? 1.3 : 1.15;

      let finalGasPrice = feeData.gasPrice;
      if (!chainConfig.supportsEIP1559 && feeData.gasPrice) {
        finalGasPrice = clamp((feeData.gasPrice * bufferPercent) / 100n);
      }

      logger.debug(`[GasOptimizer][${chainConfig.name}] Fees: ${ethers.formatUnits(maxPriorityFee, 'gwei')} gwei | Congested: ${isCongested}`);

      return {
        maxFeePerGas: chainConfig.supportsEIP1559 ? maxFee : undefined,
        maxPriorityFeePerGas: chainConfig.supportsEIP1559 ? maxPriorityFee : undefined,
        gasPrice: finalGasPrice,
        gasLimitMultiplier,
        strategy: isL2 ? 'L2_BATCH_AWARE' : (chainConfig.supportsEIP1559 ? 'EIP1559_AGGRESSIVE' : 'LEGACY_BUMPED'),
        timestamp: Date.now(),
        isCongested
      };
    } catch (err: any) {
      logger.error(`[GasOptimizer] Critical Fee Fetch Error: ${err.message}`);
      // Return safe 2026 fallbacks (1-2 Gwei range)
      return {
        gasPrice: ethers.parseUnits('1.5', 'gwei'),
        maxFeePerGas: ethers.parseUnits('2.0', 'gwei'),
        maxPriorityFeePerGas: ethers.parseUnits('1.0', 'gwei'),
        gasLimitMultiplier: 1.2,
        strategy: 'FALLBACK_SAFE'
      };
    }
  }
};
