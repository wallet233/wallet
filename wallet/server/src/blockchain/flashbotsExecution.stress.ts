import { flashbotsExecution } from './flashbotsExecution.js';
import { logger } from '../utils/logger.js';
import { ethers as ethersLegacy } from 'ethers-v6-legacy';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * DYNAMIC OVERDRIVE STRESS TEST (v2026.3)
 * Supports: Local Anvil, Sepolia, Holesky, Base.
 */
async function runDynamicValidation() {
  // 1. DYNAMIC CONFIG (Defaults to Local Anvil if ENV is missing)
  const RPC_URL = process.env.TEST_RPC || "http://127.0.0.1:8545";
  const CHAIN_ID = parseInt(process.env.TEST_CHAIN_ID || "11155111"); 
  const TEST_VALUE = process.env.TEST_VALUE || "0.0001";

  logger.info(`🎯 STARTING DYNAMIC VALIDATION | Chain: ${CHAIN_ID} | RPC: ${RPC_URL}`);

  const VALID_ENCRYPTED_KEY = "v2.1:5242849c:a6498f51f6af661009fd564e8e881e1eb9c790f71b1b29d7210e02d18e83697819c8cf6fd8d6f300876533678bd7eab7d331179efc0b2181c2491f0250cd917e:fe77e59718859320ae9b83ef:4a063038c2804b2fd5175d6287c0297c:441583d882d4d1c252a92edc19c72567b8286007556f747dca8fd9b710f87039c09511a6925fe4987fc0e932bc2a2b207dbcbce075fdc956e95c35fca28bf7fad27c";

  const payloads = [{
    to: "0x000000000000000000000000000000000000dEaD",
    value: ethersLegacy.parseEther(TEST_VALUE).toString(),
    gasLimit: "21000"
  }];

  try {
    const result = await flashbotsExecution.executeBundle(
      VALID_ENCRYPTED_KEY, 
      RPC_URL, 
      payloads, 
      CHAIN_ID
    );

    if (result.success) {
      console.log('\n💎 [STRIKE SUCCESS] BUNDLE MINED');
      console.log(`Transaction Hash: ${result.txHash}`);
      console.log(`Blocks Targeted: ${Array.isArray(result.targetBlock) ? result.targetBlock.join(', ') : result.targetBlock}`);
      console.log('--- SYSTEM FULLY OPERATIONAL ---');
      process.exit(0);
    } else {
      console.log(`⚠️ Status: ${result.error} | Reason: ${result.rejectionReason || 'N/A'}`);
      
      // If we're on Anvil, we don't loop forever to save your CPU
      if (RPC_URL.includes('127.0.0.1')) {
         console.log("Tip: On Anvil, ensure you have enough balance or mine a block manually.");
         process.exit(1);
      }
    }
  } catch (err: any) {
    logger.error('CRASH:', err.message);
    process.exit(1);
  }
}

runDynamicValidation();
