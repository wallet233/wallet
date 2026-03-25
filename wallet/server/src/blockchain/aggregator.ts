import { getAddress, isAddress, formatUnits } from 'ethers';
import { logger } from '../utils/logger.js';
import { helpers } from '../utils/helpers.js';
import crypto from 'crypto';

/**
 * BASE DATA LAYER: Raw provider response structure
 */
export interface BaseToken {
  type: string;
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  logo: string | null;
  contract: string;
  usdPrice?: number;
  traceId: string;
}

/**
 * INTELLIGENCE LAYER: High-stakes decision metadata
 */
export interface TokenIntelligence {
  isRecoverable: boolean;   // Balance > 0 and exists
  isProfitable: boolean;    // Value > (Estimated Gas + Profit Margin)
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  spamProbability: number;  // 0-100
  recommendedAction: 'IGNORE' | 'RECOVER' | 'BURN' | 'NONE';
  confidence: number;       // Data reliability score
  flags: string[];          // Descriptive tags
}

/**
 * PRODUCT LAYER: The final enriched object for consumers
 */
export interface AggregatedToken extends BaseToken {
  humanBalance: string;     
  totalUsdValue: number;    
  intelligence: TokenIntelligence;
  lastSeen: number;
}

const CONFIG = {
  COVALENT_BASE: process.env.COVALENT_API_URL || 'https://api.covalenthq.com/v1',
  MORALIS_BASE: process.env.MORALIS_API_URL || 'https://deep-index.moralis.io/api/v2',
  TIMEOUT_MS: Number(process.env.AGGREGATOR_TIMEOUT_MS) || 10000,
  GAS_ESTIMATE_USD: 1.50, // Conservative average gas cost for 2026
  MIN_PROFIT_THRESHOLD: 2.00 
};

const CHAIN_MAP: Record<number, string> = {
  1: 'eth',
  137: 'polygon',
  42161: 'arbitrum',
  10: 'optimism',
  8453: 'base',
  56: 'bsc'
};

/**
 * MASTER INTELLIGENCE ENGINE: Unified Asset Aggregator.
 * Merges multi-source data and performs financial risk analysis.
 */
export async function getUnifiedBalances(
  address: string, 
  chainId: number
): Promise<AggregatedToken[]> {
  const masterTraceId = `AGG-${crypto.randomUUID?.() || Date.now()}`;
  const moralisChain = CHAIN_MAP[chainId] || 'eth';
  
  try {
    if (!isAddress(address)) throw new Error("INVALID_ADDRESS");

    // 1. Concurrent Fetch with Resiliency
    const results = await Promise.allSettled([
      fetchFromCovalent(chainId, address),
      fetchFromMoralis(address, moralisChain)
    ]);

    const covalentData = results[0].status === 'fulfilled' ? results[0].value : [];
    const moralisData = results[1].status === 'fulfilled' ? results[1].value : [];

    // 2. Map-Based Deduplication (Checksummed Keys)
    const tokenMap = new Map<string, BaseToken>();

    [...covalentData, ...moralisData].forEach((token) => {
      const contract = getAddress(token.contract);
      const existing = tokenMap.get(contract);
      
      if (!existing) {
        tokenMap.set(contract, token);
      } else {
        tokenMap.set(contract, {
          ...existing,
          usdPrice: existing.usdPrice || token.usdPrice,
          logo: existing.logo || token.logo,
          traceId: `${existing.traceId}+merged`
        });
      }
    });

    // 3. Transformation & Intelligence Enrichment
    const finalTokens = Array.from(tokenMap.values()).map(token => {
      try {
        const humanBalance = formatUnits(token.balance, token.decimals);
        const totalUsdValue = token.usdPrice ? Number(humanBalance) * token.usdPrice : 0;

        // --- ENHANCED SPAM DETECTION ---
        const isSpamPattern = /visit|claim|win|airdrop|free|get|voucher|\.com|\.io|\.org/i.test(token.name) || 
                              /visit|claim|win|airdrop|free/i.test(token.symbol);
        
        let spamProbability = isSpamPattern ? 85 : 0;
        let confidence = 100;
        const flags: string[] = [];

        if (!token.usdPrice) { 
          spamProbability += 15; 
          flags.push('NO_PRICE_DATA'); 
        }
        if (token.symbol === '???') { 
          spamProbability += 30; 
          flags.push('MALFORMED_SYMBOL'); 
        }
        if (Number(humanBalance) < 0.00000001) flags.push('DUST_BALANCE');

        const riskLevel = 
          spamProbability >= 90 ? 'CRITICAL' : 
          spamProbability > 60 ? 'HIGH' : 
          spamProbability > 30 ? 'MEDIUM' : 'LOW';

        // --- FINANCE LOGIC: PROFITABILITY ---
        const isRecoverable = Number(humanBalance) > 0;
        const isProfitable = totalUsdValue > (CONFIG.GAS_ESTIMATE_USD + CONFIG.MIN_PROFIT_THRESHOLD);
        
        let recommendedAction: 'IGNORE' | 'RECOVER' | 'BURN' | 'NONE' = 'IGNORE';
        if (riskLevel === 'CRITICAL') {
            recommendedAction = 'BURN';
        } else if (isProfitable && riskLevel !== 'HIGH') {
            recommendedAction = 'RECOVER';
        } else if (isRecoverable) {
            recommendedAction = 'NONE';
        }

        const intelligence: TokenIntelligence = {
          isRecoverable,
          isProfitable,
          riskLevel,
          spamProbability: Math.min(spamProbability, 100),
          recommendedAction,
          confidence: token.usdPrice ? 95 : 40,
          flags
        };

        return {
          ...token,
          humanBalance,
          totalUsdValue: Number(totalUsdValue.toFixed(2)),
          intelligence,
          lastSeen: Date.now()
        } as AggregatedToken;

      } catch (e) {
        logger.error(`[Aggregator] Item Fail: ${token.symbol} - ${e}`);
        return null;
      }
    }).filter(Boolean) as AggregatedToken[];

    return finalTokens;

  } catch (err: any) {
    logger.error(`[Aggregator][${masterTraceId}] Fatal: ${err.message}`);
    return [];
  }
}

/**
 * Covalent Fetcher (Fixed Rate Limiting & Error Handling)
 */
export async function fetchFromCovalent(chainId: number, address: string): Promise<BaseToken[]> {
  const traceId = `COV-${Date.now()}`;
  const key = process.env.COVALENT_API_KEY || process.env.COVALENT_RPC_KEY;
  if (!key) return [];

  try {
    const url = `${CONFIG.COVALENT_BASE}/${chainId}/address/${address}/balances_v2/?key=${key}&nft=false&no-spam=true`;
    const res = await helpers.retry(async () => {
      const response = await fetch(url, { signal: AbortSignal.timeout(CONFIG.TIMEOUT_MS) });
      if (response.status === 429) throw new Error('RATE_LIMIT');
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      return response;
    }, 2);

    const json = await res.json();
    return (json.data?.items || []).map((t: any) => ({
      type: 'erc20',
      symbol: (t.contract_ticker_symbol || '???').substring(0, 12),
      name: (t.contract_name || 'Unknown Token').substring(0, 50),
      balance: t.balance.toString(),
      decimals: Number(t.contract_decimals) || 18,
      logo: t.logo_url || null,
      contract: getAddress(t.contract_address),
      usdPrice: t.quote_rate,
      traceId
    }));
  } catch (err: any) {
    logger.warn(`[Aggregator] Covalent failed: ${err.message}`);
    return [];
  }
}

/**
 * Moralis Fetcher (Fixed Response Mapping)
 */
export async function fetchFromMoralis(address: string, chain: string): Promise<BaseToken[]> {
  const traceId = `MOR-${Date.now()}`;
  const key = process.env.MORALIS_API_KEY || process.env.MORALIS_RPC_KEY;
  if (!key) return [];

  try {
    const url = `${CONFIG.MORALIS_BASE}/${getAddress(address)}/erc20?chain=${chain.toLowerCase()}`;
    const res = await helpers.retry(async () => {
      const response = await fetch(url, {
        headers: { 'X-API-Key': key },
        signal: AbortSignal.timeout(CONFIG.TIMEOUT_MS)
      });
      if (response.status === 429) throw new Error('RATE_LIMIT');
      return response;
    }, 2);

    const json = await res.json();
    const items = Array.isArray(json) ? json : (json.result || []);

    return items.map((t: any) => ({
      type: 'erc20',
      symbol: (t.symbol || '???').substring(0, 12),
      name: (t.name || 'Unknown').substring(0, 50),
      balance: t.balance.toString(),
      decimals: Number(t.decimals) || 18,
      logo: t.thumbnail || t.logo || null,
      contract: getAddress(t.token_address),
      usdPrice: t.usd_price,
      traceId
    }));
  } catch (err: any) {
    logger.warn(`[Aggregator] Moralis failed: ${err.message}`);
    return [];
  }
}
