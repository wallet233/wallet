import { ethers as ethersLegacy } from 'ethers-v6-legacy'; 
import { FlashbotsBundleProvider, FlashbotsBundleResolution } from '@flashbots/ethers-provider-bundle';
import { logger } from '../utils/logger.js';
import { decryptPrivateKey, clearSensitiveData } from '../utils/crypto.js';

export interface BundleResult {
  success: boolean;
  error?: string;
  txHash?: string;
}

/**
 * UPGRADED: Production-grade Flashbots Engine.
 * Fixed: Final solution for TS2345 by force-casting the bundle array to any.
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
      const provider = new ethersLegacy.JsonRpcProvider(rpcUrl);
      const userWallet = new ethersLegacy.Wallet(rawKey!, provider);
      
      clearSensitiveData(rawKey!);
      rawKey = null;

      const relayUrl = chainId === 1 
        ? 'https://relay.flashbots.net' 
        : chainId === 11155111 
        ? 'https://relay-sepolia.flashbots.net'
        : process.env.CUSTOM_RELAY_URL || 'https://relay.flashbots.net';

      const authSigner = ethersLegacy.Wallet.createRandom();

      const flashbotsProvider = await FlashbotsBundleProvider.create(
        provider as any,
        authSigner as any,
        relayUrl,
        chainId === 1 ? 'mainnet' : 'sepolia'
      );

      const [baseNonce, feeData, blockNumber] = await Promise.all([
        provider.getTransactionCount(userWallet.address),
        provider.getFeeData(),
        provider.getBlockNumber()
      ]);

      const priorityFee = (feeData.maxPriorityFeePerGas ?? ethersLegacy.parseUnits('1.5', 'gwei')) + ethersLegacy.parseUnits('1', 'gwei');
      const maxFee = (feeData.maxFeePerGas ?? ethersLegacy.parseUnits('20', 'gwei')) + priorityFee;

      // Prepare the bundle
      const signedBundle = payloads.map((tx, i) => ({ 
        signer: userWallet as any,
        transaction: {
          to: tx.to,
          data: tx.data,
          value: tx.value ? BigInt(tx.value) : 0n,
          gasLimit: tx.gasLimit ? BigInt(tx.gasLimit) : 150000n,
          chainId: chainId,
          type: 2,
          nonce: baseNonce + i,
          maxFeePerGas: maxFee,
          maxPriorityFeePerGas: priorityFee,
        }
      }));

      const targetBlock = blockNumber + 1;
     
      // FIXED: Force cast signedBundle to (any) to resolve TS2345
      const simulation = await flashbotsProvider.simulate(signedBundle as any, targetBlock);
      if ('error' in simulation) {
        throw new Error(`Flashbots Simulation Failed: ${(simulation as any).error.message}`);
      }

      logger.info(`[Flashbots] Bundle verified for block ${targetBlock}. Submitting...`);

      // FIXED: Force cast signedBundle to (any) to resolve TS2345
      const bundleSubmission = await flashbotsProvider.sendBundle(signedBundle as any, targetBlock);
      
      if ('error' in bundleSubmission) {
        throw new Error(`Relay Reject: ${(bundleSubmission as any).error.message}`);
      }

      const waitResponse = await (bundleSubmission as any).wait();
      
      if (waitResponse === FlashbotsBundleResolution.BundleIncluded) {
        const bundleHash = (bundleSubmission as any).bundleHash || 'INCLUDED';
        logger.info(`[Flashbots][SUCCESS] Bundle included in block ${targetBlock} | Hash: ${bundleHash}`);
        return { success: true, txHash: String(bundleHash) };
      } 
      
      if (waitResponse === FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
        return { success: false, error: 'Flashbots: Block passed' };
      }

      return { success: false, error: `Flashbots Resolution: ${waitResponse}` };

    } catch (err: any) {
      if (rawKey) clearSensitiveData(rawKey); 
      
      const errorMsg = err.message || 'Unknown Execution Error';
      logger.error(`[Flashbots] Fatal: ${errorMsg}`);
      
      return { 
        success: false, 
        error: errorMsg,
        txHash: undefined 
      };
    }
  }
};
