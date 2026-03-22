import { JsonRpcProvider, FetchRequest } from 'ethers';
import { logger } from '../utils/logger.js';

const providerCache = new Map<string, JsonRpcProvider>();

// Hardcoded high-reliability mapping for Alchemy slugs
const ALCHEMY_NETWORKS: Record<string, string> = {
  'ethereum': 'eth-mainnet',
  'polygon': 'polygon-mainnet',
  'arbitrum': 'arb-mainnet',
  'optimism': 'opt-mainnet',
  'base': 'base-mainnet',
  'blast': 'blast-mainnet',
  'zksync': 'zksync-mainnet',
  'linea': 'linea-mainnet',
  'scroll': 'scroll-mainnet',
  'fantom': 'fantom-mainnet'
};

/**
 * Enhanced Alchemy URL Generator
 * Automatically maps standard chain names to Alchemy-specific subdomains.
 */
export function getAlchemyUrl(network: string): string | null {
  const apiKey = process.env.ALCHEMY_API_KEY || process.env.ALCHEMY_KEY;
  if (!apiKey) return null;

  const cleanName = network.toLowerCase().trim();
  
  // If the input is already an Alchemy URL, return it
  if (network.includes('alchemy.com')) return network;

  // Use mapping or fallback to slug-mainnet pattern
  const slug = ALCHEMY_NETWORKS[cleanName] || `${cleanName}-mainnet`;
  return `https://${slug}.g.alchemy.com/v2/${apiKey}`;
}

/**
 * Heavy-Duty Provider Factory
 * Optimizations: 5s Timeouts, Static Network (2x faster), and Provider Caching.
 * Uses latest ethers (6.16.0) features.
 */
export function getProvider(rpcOrNetwork: string): JsonRpcProvider {
  if (providerCache.has(rpcOrNetwork)) {
    return providerCache.get(rpcOrNetwork)!;
  }

  // Determine actual URL: Is it a full URL or an Alchemy network slug?
  const isUrl = rpcOrNetwork.startsWith('http');
  const url = isUrl ? rpcOrNetwork : getAlchemyUrl(rpcOrNetwork);

  if (!url) {
    logger.error(`[Provider] Invalid RPC or Network requested: ${rpcOrNetwork}`);
    throw new Error(`Invalid RPC or Network: ${rpcOrNetwork}`);
  }

  try {
    // Use FetchRequest for Network-Level Timeouts (Stops scanner hanging)
    const request = new FetchRequest(url);
    request.timeout = 5000; 

    // staticNetwork: true avoids extra eth_chainId calls on every request
    // This is vital for high-speed recovery scanning
    const provider = new JsonRpcProvider(request, undefined, {
      staticNetwork: true,
    });

    providerCache.set(rpcOrNetwork, provider);
    return provider;
  } catch (err: any) {
    logger.error(`[Provider] Initialization failed for ${rpcOrNetwork}: ${err.message}`);
    throw err;
  }
}

/**
 * Health Check: Validates if a provider is alive in < 3 seconds
 */
export async function isProviderHealthy(provider: JsonRpcProvider): Promise<boolean> {
  try {
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Provider Timeout')), 3000)
    );
    // Race the block number fetch against a 3s timeout
    await Promise.race([provider.getBlockNumber(), timeout]);
    return true;
  } catch {
    return false;
  }
}
