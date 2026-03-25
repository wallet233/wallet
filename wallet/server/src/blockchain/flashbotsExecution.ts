import { ethers as ethersLegacy } from 'ethers-v6-legacy'; 
import { FlashbotsBundleProvider, FlashbotsBundleResolution } from '@flashbots/ethers-provider-bundle';
import { logger } from '../utils/logger.js';
import { decryptPrivateKey, clearSensitiveData } from '../utils/crypto.js';
import { requireChain } from './chains.js';

export interface BundleResult {
  success: boolean;
  error?: string;
  txHash?: string;
  rejectionReason?: string;
  gasUsed?: bigint;
  targetBlock?: number;
}

/**
 * PRODUCTION-GRADE FLASHBOTS ENGINE (v2.0)
 * Features: Multi-Relay Routing, Dynamic Fee Escalation, Type-Safe Switching.
 */
export const flashbotsExecution = {
  async executeBundle(
    encryptedPrivateKey: string, 
    rpcUrl: string, 
    payloads: any[], 
    chainId: number
  ): Promise<BundleResult> {
    
    let rawKey: string | null = decryptPrivateKey(encryptedPrivateKey);
    
    try {
      if (!rawKey) throw new Error('KEY_DECRYPTION_FAILED');

      const chainConfig = requireChain(chainId);
      const provider = new ethersLegacy.JsonRpcProvider(rpcUrl);
      const userWallet = new ethersLegacy.Wallet(rawKey, provider);
      
      // Immediate cleanup of raw memory
      clearSensitiveData(rawKey);
      rawKey = null;

      // 1. DYNAMIC RELAY ROUTING
      const relayUrl = chainConfig.relayUrl || 
        (chainId === 1 ? 'https://relay.flashbots.net' : 
         chainId === 11155111 ? 'https://relay-sepolia.flashbots.net' : 
         process.env.CUSTOM_RELAY_URL || 'https://relay.flashbots.net');

      const authSigner = ethersLegacy.Wallet.createRandom();

      const flashbotsProvider = await FlashbotsBundleProvider.create(
        provider as any,
        authSigner as any,
        relayUrl,
        chainId === 1 ? 'mainnet' : 'sepolia'
      );

      // 2. ELITE FEE STRATEGY (Priority Escalation)
      const [baseNonce, feeData, blockNumber] = await Promise.all([
        provider.getTransactionCount(userWallet.address),
        provider.getFeeData(),
        provider.getBlockNumber()
      ]);

      // Escalation: Add 2.5 Gwei to priority to outbid generic recovery bots
      const priorityEscalation = ethersLegacy.parseUnits('2.5', 'gwei');
      const priorityFee = (feeData.maxPriorityFeePerGas ?? ethersLegacy.parseUnits('1.5', 'gwei')) + priorityEscalation;
      
      // Safety: Max fee at 2.1x base to handle mid-block volatility
      const maxFee = (feeData.maxFeePerGas ?? ethersLegacy.parseUnits('20', 'gwei')) * 2n + priorityFee;

      // 3. ATOMIC BUNDLE CONSTRUCTION
      const signedBundle = payloads.map((tx, i) => {
        const isEIP1559 = chainConfig.supportsEIP1559 !== false;
        
        return { 
          signer: userWallet as any,
          transaction: {
            to: tx.to,
            data: tx.data,
            value: tx.value ? BigInt(tx.value) : 0n,
            gasLimit: tx.gasLimit ? BigInt(tx.gasLimit) : 180000n, // Slightly higher buffer for complex transfers
            chainId: chainId,
            type: isEIP1559 ? 2 : 0,
            nonce: baseNonce + i,
            // Dynamic fee application based on chain type
            ...(isEIP1559 ? {
              maxFeePerGas: maxFee,
              maxPriorityFeePerGas: priorityFee,
            } : {
              gasPrice: (feeData.gasPrice ?? ethersLegacy.parseUnits('20', 'gwei')) + priorityEscalation
            })
          }
        };
      });

      const targetBlock = blockNumber + 1;
     
      // 4. FORENSIC SIMULATION
      const simulation = await flashbotsProvider.simulate(signedBundle as any, targetBlock);
      
      if ('error' in simulation) {
        const simError = (simulation as any).error.message || 'Unknown Simulation Error';
        logger.error(`[Flashbots][SIM-FAIL] Block ${targetBlock} | Reason: ${simError}`);
        return { success: false, error: 'SIMULATION_REJECTED', rejectionReason: simError };
      }

      const totalGas = (simulation as any).totalGasUsed || 0n;
      logger.info(`[Flashbots] Simulation Verified. Gas: ${totalGas}. Submitting to ${relayUrl}...`);

      // 5. SECURE SUBMISSION
      const bundleSubmission = await flashbotsProvider.sendBundle(
        signedBundle as any, 
        targetBlock
      );
      
      if ('error' in bundleSubmission) {
        const relayError = (bundleSubmission as any).error.message;
        logger.warn(`[Flashbots][REJECTED] Relay Error: ${relayError}`);
        return { success: false, error: 'RELAY_REJECTION', rejectionReason: relayError };
      }

      // 6. RESOLUTION TRACKING
      const waitResponse = await (bundleSubmission as any).wait();
      
      if (waitResponse === FlashbotsBundleResolution.BundleIncluded) {
        logger.info(`[Flashbots][SUCCESS] Included in block ${targetBlock}`);
        return { 
          success: true, 
          txHash: (bundleSubmission as any).bundleHash || 'INCLUDED',
          gasUsed: totalGas,
          targetBlock
        };
      } 
      
      if (waitResponse === FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
        logger.warn(`[Flashbots][TIMEOUT] Target block ${targetBlock} missed.`);
        return { success: false, error: 'BLOCK_PASSED', targetBlock };
      }

      return { success: false, error: `RESOLUTION_CODE_${waitResponse}` };

    } catch (err: any) {
      if (rawKey) clearSensitiveData(rawKey); 
      logger.error(`[Flashbots] Fatal Error: ${err.message}`);
      return { success: false, error: err.message || 'EXECUTION_CRASH' };
    }
  }
};
