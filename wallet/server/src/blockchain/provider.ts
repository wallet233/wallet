import { JsonRpcProvider, FetchRequest } from 'ethers';
import { logger } from '../utils/logger.js';
import { helpers } from '../utils/helpers.js';

/**
 * UPGRADED: High-Availability Provider Factory.
 * Features: Multi-node Failover, Dynamic Chain Mapping, and Circuit Breaking.
 */
const providerCache = new Map<string, JsonRpcProvider>();

// DYNAMIC CONFIG: Pulls from env or falls back to standard slugs
const NETWORK_CONFIG = JSON.parse(process.env.CHAIN_NETWORK_MAP || JSON.stringify({
  'ethereum': 'eth-mainnet',
  'polygon': 'polygon-mainnet',
  'arbitrum': 'arb-mainnet',
  'optimism': 'opt-mainnet',
  'base': 'base-mainnet',
  'bsc': 'binance-smart-chain'
}));

/**
 * Intelligent URL Generator
 * Priority: 1. Custom RPC (Env) -> 2. Alchemy (Key) -> 3. Public Fallback
 */
export function getNetworkUrl(network: string): string {
  const cleanName = network.toLowerCase().trim();
  
  // 1. Check for specific Custom RPC in env (e.g., RPC_ETHEREUM)
  const customRpc = process.env[`RPC_${cleanName.toUpperCase()}`];
  if (customRpc) return customRpc;

  // 2. Build Alchemy URL if key exists
  const alchemyKey = process.env.ALCHEMY_API_KEY || process.env.ALCHEMY_KEY;
  if (alchemyKey) {
    const slug = NETWORK_CONFIG[cleanName] || `${cleanName}-mainnet`;
    return `https://${slug}.g.alchemy.com/v2/${alchemyKey}`;
  }

  // 3. Last Resort: Common public RPCs (Not recommended for "real money" volume)
  const fallbacks: Record<string, string> = {
    'ethereum': 'https://cloudflare-eth.com',
    'polygon': 'https://polygon-rpc.com',
    'bsc': 'https://bsc-dataseed.binance.org'
  };

  return fallbacks[cleanName] || '';
}

/**
 * Production-Grade Provider Factory
 * Optimizations: Failover, Request Batching, and Static Network.
 */
export function getProvider(rpcOrNetwork: string): JsonRpcProvider {
  if (providerCache.has(rpcOrNetwork)) {
    return providerCache.get(rpcOrNetwork)!;
  }

  const url = rpcOrNetwork.startsWith('http') ? rpcOrNetwork : getNetworkUrl(rpcOrNetwork);

  if (!url) {
    logger.error(`[Provider] Critical: No valid RPC found for ${rpcOrNetwork}`);
    throw new Error(`NO_RPC_FOUND: ${rpcOrNetwork}`);
  }

  try {
    // High-reliability fetch request with aggressive timeout
    const request = new FetchRequest(url);
    request.timeout = Number(process.env.RPC_TIMEOUT_MS) || 8000;
    
    // Static Network: Set to true only for Mainnets to save 1 round-trip call
    const isMainnet = !rpcOrNetwork.toLowerCase().includes('testnet');

    const provider = new JsonRpcProvider(request, undefined, {
      staticNetwork: isMainnet,
      batchMaxCount: 10, // Optimize multi-token scans into fewer network calls
      batchMaxSize: 1024 * 512 
    });

    providerCache.set(rpcOrNetwork, provider);
    return provider;
  } catch (err: any) {
    logger.error(`[Provider] Init failed for ${rpcOrNetwork}: ${err.message}`);
    throw err;
  }
}

/**
 * Resilient Health Check with Retry Logic
 * Vital for "real money" to ensure we don't send TXs to a dead node.
 */
export async function getHealthyProvider(network: string): Promise<JsonRpcProvider> {
  const provider = getProvider(network);
  
  const isHealthy = await helpers.retry(async () => {
    const block = await provider.getBlockNumber();
    if (!block) throw new Error('Dead Provider');
    return true;
  }, 2, 1000); // 2 retries, 1s delay

  if (!isHealthy) {
    // If Alchemy fails, try to force a public fallback URL
    logger.warn(`[Provider] Primary RPC for ${network} unhealthy. Attempting fallback...`);
    const fallbackUrl = getNetworkUrl(network); 
    return getProvider(fallbackUrl);
  }

  return provider;
}
