import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';
import { isAddress } from 'ethers';

dotenv.config();

/**
 * UPGRADED: Production-Grade Environment Validator.
 * Prevents "Real Money" operations if security or infrastructure keys are missing.
 */
const REQUIRED_VARS = [
  'DATABASE_URL',
  'ENCRYPTION_MASTER_SECRET', // CRITICAL: For private key safety
  'REVENUE_ADDRESS',          // CRITICAL: Where the fees go
  'ALCHEMY_API_KEY',          // CRITICAL: For blockchain connectivity
  'PORT'
];

/**
 * Validates the presence and format of required .env variables.
 */
export const validateEnv = () => {
  const missing = REQUIRED_VARS.filter(v => !process.env[v]);

  if (missing.length > 0) {
    logger.error(`[EnvConfig] FATAL: Missing critical variables: ${missing.join(', ')}`);
    process.exit(1); 
  }

  // Real Money Check: Ensure the Revenue Address is a valid EVM address
  if (!isAddress(process.env.REVENUE_ADDRESS)) {
    logger.error(`[EnvConfig] FATAL: REVENUE_ADDRESS is not a valid EVM address.`);
    process.exit(1);
  }

  // Security Check: Ensure Encryption Secret is strong
  if ((process.env.ENCRYPTION_MASTER_SECRET?.length || 0) < 32) {
    logger.error(`[EnvConfig] FATAL: ENCRYPTION_MASTER_SECRET must be at least 32 characters.`);
    process.exit(1);
  }

  logger.info('[EnvConfig] Production infrastructure environment validated.');
};

export const env = {
  // Server Config
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',
  
  // Database & Security
  dbUrl: process.env.DATABASE_URL as string,
  encryptionSecret: process.env.ENCRYPTION_MASTER_SECRET as string,
  apiSecret: process.env.API_SECRET || 'WIP_CHANGE_ME_IN_PROD',

  // Blockchain Infrastructure
  alchemyKey: process.env.ALCHEMY_API_KEY as string,
  
  // Treasury (Destination for fees/burns)
  revenueAddress: process.env.REVENUE_ADDRESS as string,

  // Global Timeouts
  rpcTimeout: Number(process.env.RPC_TIMEOUT_MS) || 10000,
  cacheTtl: Number(process.env.GLOBAL_CACHE_MS) || 3600000,

  // High-Reliability RPC Defaults (Layer 2s prioritized for low fees)
  rpc: {
    eth: process.env.RPC_1 || 'https://eth.llamarpc.com',
    bsc: process.env.RPC_56 || 'https://binance.llamarpc.com',
    polygon: process.env.RPC_137 || 'https://polygon.llamarpc.com',
    base: process.env.RPC_8453 || 'https://mainnet.base.org',
    arbitrum: process.env.RPC_42161 || 'https://arb1.arbitrum.io',
  }
};

// Export as ENV for legacy index.ts compatibility
export const ENV = env;
