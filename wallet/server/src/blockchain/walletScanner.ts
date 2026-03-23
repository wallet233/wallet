import { formatEther, formatUnits, getAddress, isAddress } from 'ethers';
import { EVM_CHAINS, ChainConfig } from './chains.js';
import { getProvider, getAlchemyUrl } from './provider.js';
import { fetchFromCovalent, fetchFromMoralis, AggregatedToken } from './aggregator.js';
import { logger } from '../utils/logger.js';
import { helpers } from '../utils/helpers.js';
import pLimit from 'p-limit';

export interface FinalAsset {
  chain: string;
  type: string;
  symbol: string;
  name?: string;
  balance: string;
  rawBalance?: string;
  decimals?: number;
  contract?: string;
  logo?: string | null;
}

/**
 * UPGRADED: High-quality Metadata Fetcher.
 * Uses retry logic to ensure "Real Money" assets aren't skipped due to transient 429s.
 */
async function fetchMeta(url: string, contract: string) {
  return await helpers.retry(async () => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        jsonrpc: "2.0", 
        id: Date.now(), 
        method: "alchemy_getTokenMetadata", 
        params: [contract] 
      })
    });
    
    if (!res.ok) throw new Error(`Alchemy Meta HTTP ${res.status}`);
    const data = await res.json();
    return data.result || null;
  }, 2, 500); // 2 retries for metadata stability
}

/**
 * Core Scanner: Aggregates Native and ERC20 tokens across all configured chains.
 * Upgraded: Checksum enforcement, BigInt safety, and Multi-source Deduplication.
 */
export async function scanGlobalWallet(address: string): Promise<FinalAsset[]> {
  const limit = pLimit(Number(process.env.SCAN_CONCURRENCY) || 5);
  
  if (!isAddress(address)) {
    logger.error(`[Scanner] Invalid address rejected: ${address}`);
    throw new Error("INVALID_ETHEREUM_ADDRESS");
  }

  const safeAddress = getAddress(address);
  const traceId = `SCAN-${Date.now()}`;

  const tasks = EVM_CHAINS.map((chain: ChainConfig) =>
    limit(async (): Promise<FinalAsset[]> => {
      try {
        const provider = getProvider(chain.rpc);
        let chainAssets: FinalAsset[] = [];

        // 1. Native Balance Check (with Atomic Retry)
        const native = await helpers.retry(async () => {
          return await Promise.race([
            provider.getBalance(safeAddress),
            new Promise<bigint>((_, r) => setTimeout(() => r(0n), 4000))
          ]);
        }, 2);

        if (native && native > 0n) {
          chainAssets.push({ 
            chain: chain.name, 
            type: 'native', 
            symbol: chain.symbol, 
            balance: formatEther(native),
            rawBalance: native.toString(),
            decimals: 18
          });
        }

        // 2. Primary Source: Alchemy (Enhanced with batch-like processing)
        const url = chain.alchemy ? getAlchemyUrl(chain.alchemy) : null;
        if (url && (process.env.ALCHEMY_API_KEY || process.env.ALCHEMY_KEY)) {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              jsonrpc: "2.0", id: 1, method: "alchemy_getTokenBalances", params: [safeAddress, "erc20"] 
            })
          });
          const { result } = await res.json();
          
          if (result?.tokenBalances) {
            const alchemyTokens = await Promise.all(result.tokenBalances.map(async (t: any) => {
              // Ignore empty balances or malformed results
              if (!t.tokenBalance || t.tokenBalance === "0x" || t.tokenBalance === "0x0") return null;
              
              const meta = await fetchMeta(url, t.contractAddress);
              if (!meta) return null;

              return {
                chain: chain.name,
                type: 'erc20',
                symbol: (meta.symbol || '???').substring(0, 12), // Prevent long-string overflow attacks
                name: (meta.name || 'Unknown Token').substring(0, 32),
                balance: formatUnits(t.tokenBalance, meta.decimals || 18),
                rawBalance: BigInt(t.tokenBalance).toString(),
                decimals: meta.decimals || 18,
                contract: t.contractAddress.toLowerCase(),
                logo: meta.logo
              };
            }));
            chainAssets.push(...(alchemyTokens.filter(Boolean) as FinalAsset[]));
          }
        }

        // 3. Supplemental Sources: Covalent & Moralis (Merging data)
        const [covalentRes, moralisRes] = await Promise.all([
          fetchFromCovalent(chain.id, safeAddress).catch(() => []),
          chain.moralis ? fetchFromMoralis(safeAddress, chain.moralis).catch(() => []) : Promise.resolve([])
        ]);

        const aggregatorTokens: AggregatedToken[] = [...covalentRes, ...moralisRes];
        
        if (aggregatorTokens.length > 0) {
          chainAssets.push(...aggregatorTokens.map(t => ({
            chain: chain.name,
            type: t.type || 'erc20',
            symbol: (t.symbol || '???').substring(0, 12),
            name: (t.name || 'Unknown').substring(0, 32),
            balance: formatUnits(t.balance, t.decimals || 18),
            rawBalance: t.balance.toString(),
            decimals: t.decimals || 18,
            contract: t.contract?.toLowerCase(),
            logo: t.logo
          })));
        }

        return chainAssets;
      } catch (err: any) {
        logger.warn(`[Scanner][${traceId}] Error on ${chain.name}: ${err.message}`);
        return []; 
      }
    })
  );

  const results = await Promise.all(tasks);
  const allAssets = results.flat();

  // 4. Heavy Deduplication (Primary Key: Chain + Contract Address)
  // Ensures single truth across Alchemy, Covalent, and Moralis.
  const uniqueAssets = Array.from(
    new Map(
      allAssets.map(asset => [
        `${asset.chain}-${asset.contract || 'native'}`.toLowerCase(), 
        asset
      ])
    ).values()
  );

  logger.info(`[Scanner][${traceId}] Found ${uniqueAssets.length} unique assets for ${safeAddress}`);
  return uniqueAssets;
}

export async function scanWallet(address: string) { 
  return await scanGlobalWallet(address); 
}
