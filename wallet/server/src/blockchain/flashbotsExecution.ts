import { ethers as ethersLegacy } from 'ethers-v6-legacy'; // <--- Legacy Alias
import { FlashbotsBundleProvider, FlashbotsBundleResolution } from '@flashbots/ethers-provider-bundle';
import { logger } from '../utils/logger.js';

export interface BundleResult {
  success: boolean;
  error?: string;
  txHash?: string;
}

/**
 * Tier 1 Private Execution Engine
 * Bridges your modern app logic to the legacy Flashbots Relay.
 */
export const flashbotsExecution = {
  /**
   * Executes a private bundle of transactions.
   * Accepts plain data objects (to, data, value) to stay version-agnostic.
   */
  async executeBundle(
    userPrivateKey: string, 
    rpcUrl: string, 
    payloads: any[], 
    chainId: number
  ): Promise<BundleResult> {
    try {
      // 1. Initialize using the LEGACY engine (6.7.1)
      const provider = new ethersLegacy.JsonRpcProvider(rpcUrl);
      const userWallet = new ethersLegacy.Wallet(userPrivateKey, provider);
      
      // Flashbots requires a reputation signer (can be any random wallet)
      const authSigner = ethersLegacy.Wallet.createRandom();

      const flashbotsProvider = await FlashbotsBundleProvider.create(
        provider,
        authSigner,
        chainId === 1 ? 'https://relay.flashbots.net' : 'https://relay-goerli.flashbots.net'
      );

      // 2. Format the bundle for the legacy provider
      const signedBundle = payloads.map(tx => ({
        signer: userWallet,
        transaction: {
          to: tx.to,
          data: tx.data,
          value: tx.value || 0n,
          gasLimit: tx.gasLimit || 150000n,
          chainId: chainId,
          type: 2 // EIP-1559
        }
      }));

      const targetBlock = (await provider.getBlockNumber()) + 1;

      // 3. Simulation Phase (Safety First)
      const simulation = await flashbotsProvider.simulate(signedBundle, targetBlock);
      if ('error' in simulation) {
        throw new Error(`Simulation Failed: ${simulation.error.message}`);
      }

      // 4. Execution Phase
      const bundleSubmission = await flashbotsProvider.sendBundle(signedBundle, targetBlock);
      
      if ('error' in bundleSubmission) {
        throw new Error(bundleSubmission.error.message);
      }

      const waitResponse = await bundleSubmission.wait();
      
      if (waitResponse === FlashbotsBundleResolution.BundleIncluded) {
        logger.info(`[Flashbots] Bundle included in block ${targetBlock}`);
        return { success: true, txHash: 'Included' };
      } else {
        return { success: false, error: 'Bundle not included in block' };
      }

    } catch (err: any) {
      logger.error(`[Flashbots] Execution Error: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
};
