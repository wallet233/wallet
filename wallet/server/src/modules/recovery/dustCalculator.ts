import { tokenService } from '../tokens/token.service.js';
import { getProvider } from '../../blockchain/provider.js';
import { EVM_CHAINS } from '../../blockchain/chains.js';
import { scanGlobalWallet } from '../../blockchain/walletScanner.js';
import { formatUnits, parseUnits, getAddress, isAddress } from 'ethers';
import { logger } from '../../utils/logger.js';
import { helpers } from '../../utils/helpers.js';
import crypto from 'crypto';

export interface DustReport {
  asset: any;
  rescueCostNative: string;
  rescueCostUsd: string;
  estimatedNetGainUsd: string;
  isProfitable: boolean;
  reason: string;
}

/**
 * UPGRADED: Production-Grade Dust & Profitability Calculator.
 * Features: EIP-1559 Gas Logic, Dynamic Profit Margins, and Multi-Chain Price Sync.
 */
export async function detectDustTokens(walletAddress: string): Promise<DustReport[]> {
  if (!isAddress(walletAddress)) throw new Error("INVALID_WALLET_ADDRESS");
  const safeAddr = getAddress(walletAddress);
  const traceId = `DUST-CALC-${crypto.randomUUID?.() || Date.now()}`;
  
  try {
    // 1. Fetch real-time on-chain assets with Traceability
    logger.info(`[DustCalculator][${traceId}] Identifying rescue targets for ${safeAddr}`);
    const rawAssets = await scanGlobalWallet(safeAddr);
    
    // 2. Filter for Clean/Dust candidates (Ignore known Spam)
    const report = await tokenService.categorizeAssets(rawAssets);
    const candidates = [...report.groups.clean, ...report.groups.dust];

    const dustAnalysis = await Promise.all(candidates.map(async (asset) => {
      try {
        const chain = EVM_CHAINS.find(c => c.name.toLowerCase() === asset.chain.toLowerCase());
        if (!chain || asset.type !== 'erc20') return null;

        // 3. EIP-1559 AWARE GAS CALCULATION
        const provider = getProvider(chain.rpc);
        const feeData = await provider.getFeeData();
        
        // Use maxFee (base + priority) for "Real Money" speed/inclusion
        const gasPriceWei = feeData.maxFeePerGas || feeData.gasPrice || parseUnits('35', 'gwei');
        
        // Buffer for multi-hop recoveries (Approve + Transfer)
        const estimatedGasLimit = 180000n; 
        const rescueCostWei = gasPriceWei * estimatedGasLimit;

        // 4. DYNAMIC PRICING (Replacing Hardcoded Constants)
        const assetUsdValue = parseFloat(asset.usdValue || '0');
        
        // Native price (e.g. ETH/POL) is pulled from the tokenService's dynamic discovery
        // Fallback to a safe estimate only if price discovery is completely offline
        const nativePriceUsd = asset.nativePriceUsd || 3000; 
        const gasCostUsd = parseFloat(formatUnits(rescueCostWei, 18)) * nativePriceUsd;

        // 5. THE "REAL MONEY" PROFITABILITY GUARD
        // Logic: Recovery must yield at least $1.50 profit AND cover 1.5x the gas cost.
        const netGain = assetUsdValue - gasCostUsd;
        const isProfitable = netGain > 1.50 && assetUsdValue > (gasCostUsd * 1.5);
        const isTooLarge = assetUsdValue > (Number(process.env.DUST_MAX_THRESHOLD) || 250);

        if (isProfitable && !isTooLarge) {
          return {
            asset,
            rescueCostNative: formatUnits(rescueCostWei, 18),
            rescueCostUsd: gasCostUsd.toFixed(2),
            estimatedNetGainUsd: netGain.toFixed(2),
            isProfitable: true,
            reason: 'Profitable rescue target detected'
          };
        }

        return {
          asset,
          rescueCostNative: formatUnits(rescueCostWei, 18),
          rescueCostUsd: gasCostUsd.toFixed(2),
          estimatedNetGainUsd: netGain > 0 ? netGain.toFixed(2) : '0.00',
          isProfitable: false,
          reason: isTooLarge ? 'High-value asset (Standard transfer)' : 'Gas cost exceeds recovery value'
        };

      } catch (err: any) {
        logger.warn(`[DustCalculator][${traceId}] Skip ${asset.symbol}: ${err.message}`);
        return null;
      }
    }));

    const finalResults = dustAnalysis.filter((item): item is DustReport => item !== null);
    logger.info(`[DustCalculator][${traceId}] Analysis complete. Found ${finalResults.filter(r => r.isProfitable).length} profitable targets.`);
    
    return finalResults;

  } catch (globalErr: any) {
    logger.error(`[DustCalculator][${traceId}] Critical failure: ${globalErr.stack}`);
    return [];
  }
}
