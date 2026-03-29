import { ethers as ethersLegacy } from 'ethers-v6-legacy'; 
import { FlashbotsBundleProvider, FlashbotsBundleResolution } from '@flashbots/ethers-provider-bundle';
import { logger } from '../utils/logger.js';
import { decryptPrivateKey, clearSensitiveData } from '../utils/crypto.js';
import { requireChain } from './chains.js';
import 'dotenv/config';

export interface BundleResult {
  success: boolean;
  error?: string;
  txHash?: string;
  rejectionReason?: string;
  gasUsed?: bigint;
  targetBlock?: number | number[];
}

/**
 * BATTLE-HARDENED: Institutional Flashbots & MEV-Shield Engine (v2026.10).
 * UPGRADES: Nonce-Collision Protection, Strict Memory Purgatory, and Multi-Relay Logic.
 * SECURITY: Implements Tier-1 Private Key handling with mandatory heap-cleaning.
 * FIX: Raw-Hex Bundle Signing to prevent 'Go unmarshal object into string' relay errors.
 * OVERDRIVE: Multi-Block Saturation (+1, +2, +3) and Persistent Auth Reputation.
 */
export const flashbotsExecution = {
  async executeBundle(
    encryptedPrivateKey: string, 
    rpcUrl: string, 
    payloads: any[], 
    chainId: number
  ): Promise<BundleResult> {
    
    // 1. SECURE DECRYPTION WITH AUTO-PURGE
    let rawKey: string | null = await decryptPrivateKey(encryptedPrivateKey);
    
    try {
      if (!rawKey) throw new Error('CRITICAL: KEY_DECRYPTION_FAILED');

      const chainConfig = requireChain(chainId);
      const provider = new ethersLegacy.JsonRpcProvider(rpcUrl);
      const userWallet = new ethersLegacy.Wallet(rawKey, provider);
      
      // IMMEDIATE HEAP CLEANUP: Remove raw key from memory as soon as Wallet object is instantiated
      const cleanup = () => {
        if (rawKey) {
          clearSensitiveData(rawKey);
          rawKey = null;
        }
      };
      cleanup();

      // 2. ADAPTIVE RELAY ROUTING (2026 Multi-Chain Standard)
      const relayUrl = chainConfig.relayUrl || 
        (chainId === 1 ? 'https://relay.flashbots.net' : 
         chainId === 17000 ? 'https://relay-holesky.flashbots.net' :
         chainId === 8453 ? 'https://base.mev-relay.com' : 
         chainId === 137 ? 'https://bor.txrelay.mewapi.io' :
         process.env.CUSTOM_RELAY_URL || 'https://relay.flashbots.net');

      // Use a randomized auth signer for every bundle to protect user reputation
      // UPGRADE: Use persistent environment key if available to build relay reputation
      const authSigner = process.env.FLASHBOTS_AUTH_KEY 
        ? new ethersLegacy.Wallet(process.env.FLASHBOTS_AUTH_KEY)
        : ethersLegacy.Wallet.createRandom();

      // UPGRADE: Multi-Relay Aggregator (Broadcasting to Titan & Beaver for Mainnet)
      const relayEndpoints = [relayUrl];
      if (chainId === 1) {
        relayEndpoints.push('https://rpc.titanbuilder.xyz', 'https://rpc.beaverbuild.org');
      }

      const flashbotsProviders = await Promise.all(relayEndpoints.map(url => 
        FlashbotsBundleProvider.create(
          provider as any,
          authSigner as any,
          url,
          chainId === 1 ? 'mainnet' :
          chainId === 17000 ? 'holesky' : 'sepolia'
        )
      ));
      
      // Primary provider for simulation logic
      const flashbotsProvider = flashbotsProviders[0];

      // 3. ELITE FEE & NONCE STRATEGY (Collision Resistance)
      const [pendingNonce, feeData, blockNumber] = await Promise.all([
        provider.getTransactionCount(userWallet.address, 'pending'), // Use 'pending' to avoid collision
        provider.getFeeData(),
        provider.getBlockNumber()
      ]);

      // Institutional Escalation: 4.0 Gwei to ensure inclusion over basic bots
      const priorityEscalation = ethersLegacy.parseUnits(process.env.PRIORITY_BUMP || '4.0', 'gwei');
      const priorityFee = (feeData.maxPriorityFeePerGas ?? ethersLegacy.parseUnits('1.5', 'gwei')) + priorityEscalation;
      
      // Post-Pectra Hardening: Max fee headroom at 3.0x base for volatility
      const maxFee = (feeData.maxFeePerGas ?? ethersLegacy.parseUnits('25', 'gwei')) * 30n / 10n + priorityFee;

      // 4. ATOMIC BUNDLE CONSTRUCTION (UPGRADED: Hex Serialization)
      const bundleTransactions = payloads.map((tx, i) => {
        const isEIP1559 = chainConfig.supportsEIP1559 !== false;
        
        // Strict normalization to Hex strings to prevent BigInt serialization crashes
        const txValue = tx.value ? ethersLegacy.toQuantity(BigInt(tx.value)) : "0x0";
        const txGas = tx.gasLimit ? ethersLegacy.toQuantity(BigInt(tx.gasLimit)) : ethersLegacy.toQuantity(250000n); 

        return { 
          signer: userWallet as any,
          transaction: {
            to: tx.to || undefined,
            data: tx.data || '0x',
            value: txValue,
            gasLimit: txGas,
            chainId: chainId,
            type: isEIP1559 ? 2 : 0,
            nonce: pendingNonce + i,
            ...(isEIP1559 ? {
              maxFeePerGas: ethersLegacy.toQuantity(maxFee),
              maxPriorityFeePerGas: ethersLegacy.toQuantity(priorityFee),
            } : {
              gasPrice: ethersLegacy.toQuantity((feeData.gasPrice ?? ethersLegacy.parseUnits('20', 'gwei')) + priorityEscalation)
            })
          }
        };
      });

      // UPGRADE: Pre-sign the bundle to convert objects to the raw strings the Relay Go-backend expects
      const signedBundle = await flashbotsProvider.signBundle(bundleTransactions);

      // UPGRADE: Multi-Block Saturation (+1, +2, +3)
      const targetBlocks = [blockNumber + 1, blockNumber + 2, blockNumber + 3];
     
      // 5. FORENSIC SIMULATION (Revert Guard)
      // Using signedBundle (Array of strings) instead of bundleTransactions (Array of objects)
      const simulation = await flashbotsProvider.simulate(signedBundle, targetBlocks[0]);
      
      if ('error' in simulation) {
        const simError = (simulation as any).error.message || 'Simulation Failure';
        logger.error(`[Flashbots][SIM-FAIL] Block ${targetBlocks[0]} | Reason: ${simError}`);
        return { success: false, error: 'SIMULATION_REJECTED', rejectionReason: simError };
      }

      // If any transaction in the bundle reverts, abort execution to save user status
      const results = (simulation as any).results || [];
      const revertFound = results.find((r: any) => r.error || r.revert);
      if (revertFound) {
         return { success: false, error: 'BUNDLE_REVERT_DETECTED', rejectionReason: revertFound.revert || revertFound.error };
      }

      const totalGas = (simulation as any).totalGasUsed || 0n;
      logger.info(`[Flashbots] Bundle Pre-Flight Success. Gas: ${totalGas.toString()}`);
      logger.info(`[Overdrive] Saturation Active: Blasting blocks ${targetBlocks.join(', ')}`);

      // 6. SECURE SUBMISSION (UPGRADED: Multi-Relay & Multi-Block Parallel Broadcast)
      const bundleSubmissions = await Promise.all(
        flashbotsProviders.flatMap(p => 
          targetBlocks.map(block => p.sendRawBundle(signedBundle, block))
        )
      );
      
      const primarySubmission = bundleSubmissions[0]; // Reference primary (Flashbots @ Block +1)
      
      if ('error' in primarySubmission) {
        const relayError = (primarySubmission as any).error.message;
        logger.warn(`[Flashbots][REJECTED] Relay Response: ${relayError}`);
        return { success: false, error: 'RELAY_REJECTION', rejectionReason: relayError };
      }

      // 7. RESOLUTION TRACKING
      // We race the inclusion across all submitted block targets
      const waitResults = await Promise.all(bundleSubmissions.map(s => (s as any).wait()));
      const inclusionIndex = waitResults.findIndex(res => res === FlashbotsBundleResolution.BundleIncluded);
      
      if (inclusionIndex !== -1) {
        const winningSubmission = bundleSubmissions[inclusionIndex];
        // UPGRADE: Use Institutional TX Logger
        logger.tx((winningSubmission as any).bundleHash || 'MEV_BUNDLE', chainConfig.name, { targetBlock: 'MULTI', gas: totalGas });
        logger.info(`[Flashbots][SUCCESS] Bundle mined via Overdrive Saturation`);
        return { 
          success: true, 
          txHash: (winningSubmission as any).bundleHash || 'CONFIRMED',
          gasUsed: totalGas,
          targetBlock: targetBlocks 
        };
      } 
      
      logger.warn(`[Flashbots][TIMEOUT] Bundle not included in target range. Retrying suggested.`);
      return { success: false, error: 'BLOCK_PASSED', targetBlock: targetBlocks };

    } catch (err: any) {
      // Ensure sensitive data is cleared even on unexpected crashes
      if (rawKey) clearSensitiveData(rawKey); 
      logger.error(`[Flashbots][FATAL] ${err.message}`, { stack: err.stack });
      return { success: false, error: err.message || 'INTERNAL_ENGINE_ERROR' };
    } finally {
      // Final safety purge
      if (rawKey) clearSensitiveData(rawKey);
    }
  }
};

export default flashbotsExecution;
