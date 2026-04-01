import 'dotenv/config';
import { JsonRpcProvider, FetchRequest } from 'ethers';
import { logger } from '../utils/logger.js';
import { helpers } from '../utils/helpers.js';
import { requireChain, EVM_CHAINS, getBestRpc, refreshRpc } from './chains.js';

/**
 * UPGRADED: Finance-Grade High-Availability Provider Factory.
 * Integration: Fully linked to Intelligence Engine (latency-sorted RPCs).
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
 * Legacy Alias for Alchemy URLs.
 */
export function getAlchemyUrl(network: string): string {
  return getNetworkUrl(network);
}

/**
 * Intelligent URL Generator (Now uses the Chain Intelligence Engine)
 */
export function getNetworkUrl(network: string): string {
  const cleanName = network.toLowerCase().trim();
  
  // 1. Check for specific Custom RPC in env
  const customRpc = process.env[`RPC_${cleanName.toUpperCase()}`];
  if (customRpc) return customRpc;

  // 2. Build Alchemy URL if key exists
  const alchemyKey = process.env.ALCHEMY_API_KEY || process.env.ALCHEMY_KEY;
  if (alchemyKey) {
    // UPGRADE: Resilience check. If the env var is already a full URL, return it directly to avoid 404 double-prefixing.
    if (alchemyKey.startsWith('http')) {
      return alchemyKey;
    }
    const slug = NETWORK_CONFIG[cleanName] || `${cleanName}-mainnet`;
    return `https://${slug}.g.alchemy.com/v2/${alchemyKey}`;
  }

  // 3. Fallback to Chain Engine Discovery
  try {
    const chain = EVM_CHAINS.find(c => 
      c.name.toLowerCase() === cleanName || 
      c.symbol.toLowerCase() === cleanName
    );
    // Note: Since this is synchronous, we take the first defined RPC as a default.
    // getHealthyProvider (async) will handle the latency-based discovery.
    if (chain && chain.rpcs.length > 0) return chain.rpcs[0];
  } catch (e) { /* silent */ }

  const fallbacks: Record<string, string> = {
    'ethereum': 'https://eth.drpc.org',
    'polygon': 'https://polygon.drpc.org',
    'bsc': 'https://binance.llamarpc.com'
  };

  return fallbacks[cleanName] || '';
}

/**
 * Production-Grade Provider Factory
 */
export function getProvider(rpcOrNetworkOrChainId: string | number, chainIdOverride?: number): JsonRpcProvider {
  const cacheKey = rpcOrNetworkOrChainId.toString();
  
  // 1. Circuit Breaker Check
  const status = circuitBreaker.get(cacheKey);
  if (status && status.failures > 5 && Date.now() - status.lastFailure < 30000) {
    logger.error(`[Provider] Circuit Breaker active for ${cacheKey}. Cooling down...`);
    throw new Error(`CIRCUIT_BREAKER_OPEN: ${cacheKey}`);
  }

  if (providerCache.has(cacheKey)) {
    return providerCache.get(cacheKey)!;
  }

  let url: string;
  let finalChainId: number | undefined = chainIdOverride;

  if (typeof rpcOrNetworkOrChainId === 'number') {
    const chain = requireChain(rpcOrNetworkOrChainId);
    // Synchronous fallback: use first RPC; getHealthyProvider will optimize later
    url = chain.rpcs[0];
    finalChainId = chain.id;
  } else {
    url = rpcOrNetworkOrChainId.startsWith('http') ? rpcOrNetworkOrChainId : getNetworkUrl(rpcOrNetworkOrChainId);
    // UPGRADE: Improved search logic to find chain by URL pattern if name match fails
    const chain = EVM_CHAINS.find(c => 
      c.name.toLowerCase() === rpcOrNetworkOrChainId.toString().toLowerCase() ||
      c.rpcs.some(r => url.includes(r.split('//')[1]?.split('/')[0]))
    );
    if (chain) finalChainId = chain.id;
  }

  if (!url) {
    throw new Error(`NO_RPC_FOUND: ${rpcOrNetworkOrChainId}`);
  }

  const request = new FetchRequest(url);
  request.timeout = Number(process.env.RPC_TIMEOUT_MS) || 15000;
  request.setHeader("Connection", "keep-alive");
    request.setHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
      request.setHeader("Accept", "application/json");
        request.setHeader("Content-Type", "application/json");
    
  // UPGRADE: Use the Intelligence Engine's chain discovery instead of hardcoded ternary for Base/Eth
  // This ensures L2s like Optimism, Arbitrum, and Mantle use their correct IDs automatically.
  const provider = new JsonRpcProvider(request, finalChainId || 1, {
    staticNetwork: true,
    batchMaxCount: 50,
    batchMaxSize: 2 * 1024 * 1024,
    batchStallTime: 5
  });

  providerCache.set(cacheKey, provider);
  return provider;
}

/**
 * Resilient Health Check with Block-Staleness Detection & Latency Discovery
 */
export async function getHealthyProvider(network: string | number): Promise<JsonRpcProvider> {
  const identifier = network.toString();
  
  try {
    let targetUrl: string;

    // 1. If it's a known chain ID, find the absolute best RPC via Intelligence Engine
    if (typeof network === 'number' || !isNaN(Number(network))) {
      const cid = Number(network);
      targetUrl = await getBestRpc(cid);
    } else {
      targetUrl = identifier.startsWith('http') ? identifier : getNetworkUrl(identifier);
    }

    const provider = getProvider(targetUrl, typeof network === 'number' ? network : undefined);
    
    await helpers.retry(async () => {
      const block = await provider.getBlock('latest');
      if (!block || !block.number) throw new Error('RPC_RETURNED_EMPTY_BLOCK');
      
      const secondsSinceLastBlock = Math.floor(Date.now() / 1000) - block.timestamp;
      
      // UPGRADE: Dynamically look up block time for the chain to determine staleness threshold
      let threshold = 180; 
      try {
        const chain = EVM_CHAINS.find(c => c.rpcs.some(r => targetUrl.includes(r.split('//')[1]?.split('/')[0])));
        if (chain) threshold = Math.max(chain.blockTimeSec * 10, 60); // 10 blocks or 1 minute minimum
      } catch (e) { /* fallback to 180 */ }

      if (secondsSinceLastBlock > threshold) {
        throw new Error(`RPC_STALE: Node is ${secondsSinceLastBlock}s behind (Threshold: ${threshold}s)`);
      }

      return true;
    }, 2, 1500);

    circuitBreaker.delete(identifier);
    return provider;
  } catch (err: any) {
    logger.warn(`[Provider] RPC for ${network} unhealthy/stale: ${err.message}`);
    
    const current = circuitBreaker.get(identifier) || { failures: 0, lastFailure: 0 };
    circuitBreaker.set(identifier, { 
      failures: current.failures + 1, 
      lastFailure: Date.now() 
    });

    // Trigger RPC Refresh in the Intelligence Engine if we fail
    if (typeof network === 'number') {
      logger.info(`[Provider] Force refreshing RPC candidates for chain ${network}`);
      const freshUrl = await refreshRpc(network);
      return getProvider(freshUrl, network);
    }

    throw err;
  }
}
