import { JsonRpcProvider, FetchRequest } from 'ethers';
import { logger } from '../utils/logger.js';
import { helpers } from '../utils/helpers.js';
import { requireChain, EVM_CHAINS } from './chains.js';

/**
 * UPGRADED: Finance-Grade High-Availability Provider Factory.
 * Features: ChainID-Anchored Routing, Circuit Breaking, Staleness Detection, and Request Batching.
 */
const providerCache = new Map<string, JsonRpcProvider>();
const circuitBreaker = new Map<string, { failures: number, lastFailure: number }>();

const NETWORK_CONFIG = JSON.parse(process.env.CHAIN_NETWORK_MAP || JSON.stringify({
  'ethereum': 'eth-mainnet',
  'polygon': 'polygon-mainnet',
  'arbitrum': 'arb-mainnet',
  'optimism': 'opt-mainnet',
  'base': 'base-mainnet',
  'bsc': 'binance-smart-chain'
}));

/**
 * Legacy Alias for Alchemy URLs to fix TS2305 errors in Scanner and Security Service.
 */
export function getAlchemyUrl(network: string): string {
  return getNetworkUrl(network);
}

/**
 * Intelligent URL Generator
 * Priority: 1. Custom RPC (Env) -> 2. Alchemy (Key) -> 3. Public Fallback
 */
export function getNetworkUrl(network: string): string {
  const cleanName = network.toLowerCase().trim();
  
  // 1. Check for specific Custom RPC in env (e.g., RPC_ETHEREUM)
  const customRpc = process.env[`RPC_${cleanName.toUpperCase()}` || `RPC_${network}` ];
  if (customRpc) return customRpc;

  // 2. Build Alchemy URL if key exists
  const alchemyKey = process.env.ALCHEMY_API_KEY || process.env.ALCHEMY_KEY;
  if (alchemyKey) {
    const slug = NETWORK_CONFIG[cleanName] || `${cleanName}-mainnet`;
    return `https://${slug}.g.alchemy.com/v2/${alchemyKey}`;
  }

  // 3. Last Resort: Check our internal Chain Map for the verified RPC
  try {
    const chain = EVM_CHAINS.find(c => c.name.toLowerCase() === cleanName || c.symbol.toLowerCase() === cleanName);
    if (chain) return chain.rpc;
  } catch (e) { /* silent */ }

  const fallbacks: Record<string, string> = {
    'ethereum': 'https://cloudflare-eth.com',
    'polygon': 'https://polygon-rpc.com',
    'bsc': 'https://bsc-dataseed.binance.org'
  };

  return fallbacks[cleanName] || '';
}

/**
 * Production-Grade Provider Factory
 * Optimizations: ChainID Validation, Request Batching, and Static Network pinning.
 */
export function getProvider(rpcOrNetworkOrChainId: string | number): JsonRpcProvider {
  const cacheKey = rpcOrNetworkOrChainId.toString();
  
  // 1. Circuit Breaker Check (Finance Safety)
  const status = circuitBreaker.get(cacheKey);
  if (status && status.failures > 5 && Date.now() - status.lastFailure < 30000) {
    logger.error(`[Provider] Circuit Breaker active for ${cacheKey}. Cooling down...`);
    throw new Error(`CIRCUIT_BREAKER_OPEN: ${cacheKey}`);
  }

  if (providerCache.has(cacheKey)) {
    return providerCache.get(cacheKey)!;
  }

  let url: string;
  let chainId: number | undefined;

  // Handle ChainID input
  if (typeof rpcOrNetworkOrChainId === 'number') {
    const chain = requireChain(rpcOrNetworkOrChainId);
    url = chain.rpc;
    chainId = chain.id;
  } else {
    url = rpcOrNetworkOrChainId.startsWith('http') ? rpcOrNetworkOrChainId : getNetworkUrl(rpcOrNetworkOrChainId);
    // Attempt to resolve chainId if it's a known network name
    const chain = EVM_CHAINS.find(c => c.name.toLowerCase() === rpcOrNetworkOrChainId.toString().toLowerCase());
    if (chain) chainId = chain.id;
  }

  if (!url) {
    logger.error(`[Provider] Critical: No valid RPC found for ${rpcOrNetworkOrChainId}`);
    throw new Error(`NO_RPC_FOUND: ${rpcOrNetworkOrChainId}`);
  }

  try {
    const request = new FetchRequest(url);
    request.timeout = Number(process.env.RPC_TIMEOUT_MS) || 15000;
    // Finance Hardening: Add persistent connection headers if supported
    request.setHeader("Connection", "keep-alive");
    
    const provider = new JsonRpcProvider(request, chainId, {
      staticNetwork: true, // Crucial: Prevents redundant eth_chainId calls & protects against chain-switching
      batchMaxCount: 50,    // High-throughput for finance scanning
      batchMaxSize: 2 * 1024 * 1024,
      batchStallTime: 5     // Low-latency batching
    });

    providerCache.set(cacheKey, provider);
    return provider;
  } catch (err: any) {
    logger.error(`[Provider] Init failed for ${rpcOrNetworkOrChainId}: ${err.message}`);
    throw err;
  }
}

/**
 * Resilient Health Check with Block-Staleness Detection
 */
export async function getHealthyProvider(network: string | number): Promise<JsonRpcProvider> {
  try {
    const provider = getProvider(network);
    
    await helpers.retry(async () => {
      // Check block number AND timestamp to ensure node isn't "stuck"
      const block = await provider.getBlock('latest');
      if (!block || !block.number) throw new Error('RPC_RETURNED_EMPTY_BLOCK');
      
      // Staleness Check: If block is older than 2 minutes, the node is lagging
      const secondsSinceLastBlock = Math.floor(Date.now() / 1000) - block.timestamp;
      if (secondsSinceLastBlock > 120) {
        throw new Error(`RPC_STALE: Node is ${secondsSinceLastBlock}s behind`);
      }

      return true;
    }, 2, 1500);

    // Reset circuit breaker on success
    circuitBreaker.delete(network.toString());
    return provider;
  } catch (err: any) {
    logger.warn(`[Provider] RPC for ${network} unhealthy/stale: ${err.message}. Incrementing breaker.`);
    
    const current = circuitBreaker.get(network.toString()) || { failures: 0, lastFailure: 0 };
    circuitBreaker.set(network.toString(), { 
      failures: current.failures + 1, 
      lastFailure: Date.now() 
    });

    // Final Fallback: Aggressive failover to a known-good public RPC
    if (typeof network === 'string' && !network.startsWith('http')) {
        const globalFallbacks: Record<string, string> = { 
          'ethereum': 'https://eth.drpc.org',
          'base': 'https://mainnet.base.org',
          'polygon': 'https://polygon.drpc.org'
        };
        if (globalFallbacks[network.toLowerCase()]) {
          logger.info(`[Provider] Attempting emergency failover for ${network}`);
          return getProvider(globalFallbacks[network.toLowerCase()]);
        }
    }
    
    throw err;
  }
}
