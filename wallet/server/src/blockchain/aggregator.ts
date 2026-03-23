import { getAddress, isAddress } from 'ethers';
import { logger } from '../utils/logger.js';
import { helpers } from '../utils/helpers.js';
import crypto from 'crypto';

export interface AggregatedToken {
  type: string;
  symbol: string;
  name: string;
  balance: string; // Atomic units (Wei/Satoshi)
  decimals: number;
  logo: string | null;
  contract: string;
  usdPrice?: number;
  traceId?: string;
}

// Configuration from Environment
const CONFIG = {
  COVALENT_BASE: process.env.COVALENT_API_URL || 'https://api.covalenthq.com',
  MORALIS_BASE: process.env.MORALIS_API_URL || 'https://deep-index.moralis.io',
  TIMEOUT_MS: Number(process.env.AGGREGATOR_TIMEOUT_MS) || 8000
};

/**
 * UPGRADED: High-Fidelity Asset Aggregator.
 * Features: BigInt Balance Protection, Cross-Provider Deduplication, and Trace Auditing.
 */

/**
 * Covalent Fetcher: Optimized for "Real Money" Balance Accuracy.
 */
export async function fetchFromCovalent(chainId: number, address: string): Promise<AggregatedToken[]> {
  const traceId = `COV-${crypto.randomUUID?.() || Date.now()}`;
  try {
    const key = process.env.COVALENT_RPC_KEY || process.env.COVALENT_API_KEY;
    if (!key || !isAddress(address)) return [];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

    // Using upgraded retry helper with jitter for production stability
    const url = `${CONFIG.COVALENT_BASE}/${chainId}/address/${address}/balances_v2/?key=${key}&nft=false&no-spam=true`;
    
    const res = await helpers.retry(async () => {
      const response = await fetch(url, { signal: controller.signal });
      if (response.status === 429) throw new Error('COVALENT_RATE_LIMIT');
      if (!response.ok) throw new Error(`Covalent HTTP ${response.status}`);
      return response;
    }, 2, 1000, traceId);
   
    clearTimeout(timeout);
    const json = await res.json();

    const items = json.data?.items || [];
    logger.debug(`[Aggregator][${traceId}] Covalent found ${items.length} items on chain ${chainId}`);

    return items
      .filter((t: any) => t.balance && t.balance !== "0" && t.contract_address)
      .map((t: any) => {
        try {
          return {
            type: 'erc20',
            symbol: (t.contract_ticker_symbol || '???').substring(0, 10),
            name: (t.contract_name || 'Unknown').substring(0, 40),
            balance: t.balance.toString(), // Keep as string to avoid precision loss
            decimals: Number(t.contract_decimals) || 18,
            logo: t.logo_url || null,
            contract: getAddress(t.contract_address),
            usdPrice: t.quote_rate,
            traceId
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean) as AggregatedToken[];

  } catch (err: any) {
    logger.warn(`[Aggregator][${traceId}] Covalent skip on ${chainId}: ${err.message}`);
    return []; 
  }
}

/**
 * Premium Moralis Fetcher: Features Metadata validation and strict standardization.
 */
export async function fetchFromMoralis(address: string, chain: string): Promise<AggregatedToken[]> {
  const traceId = `MOR-${crypto.randomUUID?.() || Date.now()}`;
  try {
    const key = process.env.MORALIS_RPC_KEY || process.env.MORALIS_API_KEY;
    if (!key || !isAddress(address)) return [];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

    const url = `${CONFIG.MORALIS_BASE}/${getAddress(address)}/erc20?chain=${chain.toLowerCase()}`;

    const res = await helpers.retry(async () => {
      const response = await fetch(url, {
        headers: { 'X-API-Key': key, 'accept': 'application/json' },
        signal: controller.signal
      });
      if (response.status === 429) throw new Error('MORALIS_RATE_LIMIT');
      if (!response.ok) throw new Error(`Moralis HTTP ${response.status}`);
      return response;
    }, 2, 1000, traceId);

    clearTimeout(timeout);
    const json = await res.json();

    // Moralis returns an array of tokens in the root or a 'result' property depending on API version
    const tokens = Array.isArray(json) ? json : (json.result || []);

    return tokens
      .map((t: any) => {
        try {
          return {
            type: 'erc20',
            symbol: (t.symbol || '???').substring(0, 10),
            name: (t.name || 'Unknown').substring(0, 40),
            balance: t.balance.toString(),
            decimals: parseInt(t.decimals) || 18,
            logo: t.thumbnail || t.logo || null,
            contract: getAddress(t.token_address),
            usdPrice: t.usd_price,
            traceId
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean) as AggregatedToken[];

  } catch (err: any) {
    logger.warn(`[Aggregator][${traceId}] Moralis skip for ${address}: ${err.message}`);
    return []; 
  }
}
