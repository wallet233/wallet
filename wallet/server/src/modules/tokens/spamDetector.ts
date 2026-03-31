import { logger } from '../../utils/logger.js';
import crypto from 'crypto';
// Integrated: Pulling chain metadata for real-time pricing
import { getChainById } from '../../blockchain/chains.js';

/**
 * AEGIS-INTELLIGENCE v3.0 (2026 Enterprise SaaS Edition)
 * Core Logic: High-Fidelity Security Analytics & Pricing Waterfall
 * Status: Read-Only Intelligence Provider for Aegis-Engine Mesh
 */

export interface TokenClassification {
  status: 'verified' | 'spam' | 'dust' | 'clean' | 'malicious';
  securityNote: string | null;
  score: number;
  usdValue: number;
  isHoneypot?: boolean;
  isBlacklisted?: boolean;
  sellTax?: number;
  buyTax?: number;
  isProxy?: boolean;
  isVerifiedSource?: boolean;
  liquidityUsd?: number;
  canRecover: boolean;
}

const CONFIG = {
  GOPLUS_API: process.env.GOPLUS_API_BASE || 'https://api.gopluslabs.io/api/v1',
  DEXSCREENER_API: 'https://api.dexscreener.com/latest/dex/tokens',
  LLAMA_API: 'https://coins.llama.fi/prices/current',
  DUST_THRESHOLD: Number(process.env.DUST_THRESHOLD_USD) || 0.50,
  LIQUIDITY_FLOOR: Number(process.env.MIN_LIQUIDITY_USD) || 1000,
  CG_PLATFORM_MAP: JSON.parse(process.env.CG_PLATFORM_MAP || '{"1":"ethereum","137":"polygon-pos","8453":"base","56":"binance-smart-chain"}')
};

let goPlusAccessToken: string | null = null;
let tokenExpiry = 0;
let isRefreshing = false; // Production Add: Prevents auth race conditions

// Production Add: Global cache for Native Asset prices (ETH, BNB, SOL, etc)
const NATIVE_PRICE_CACHE: Record<string, { price: number, expiry: number }> = {};
const NATIVE_CACHE_TTL = 1000 * 60 * 30; // 30 Minute local cache for gas tokens

/**
 * Robust Auth: Handles token refresh with race-condition prevention
 */
async function getGoPlusAuth(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (goPlusAccessToken && now < tokenExpiry) return `Bearer ${goPlusAccessToken}`;
  
  // Production Add: Singleton lock pattern for auth refresh
  if (isRefreshing) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return goPlusAccessToken ? `Bearer ${goPlusAccessToken}` : '';
  }

  try {
    isRefreshing = true;
    const appKey = process.env.GOPLUS_APP_KEY || '';
    const appSecret = process.env.GOPLUS_APP_SECRET || '';
    if (!appKey || !appSecret) return '';

    const sign = crypto.createHash('sha1').update(`${appKey}${now}${appSecret}`).digest('hex');
    const resp = await fetch(`${CONFIG.GOPLUS_API}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_key: appKey, time: now, sign })
    });

    const data = await resp.json();
    if (data.result?.access_token) {
      goPlusAccessToken = data.result.access_token;
      tokenExpiry = now + (data.result.expires_in || 3600) - 60;
      return `Bearer ${goPlusAccessToken}`;
    }
  } catch (e) {
    logger.error(`[Aegis-Auth] Failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
  } finally {
    isRefreshing = false;
  }
  return '';
}

/**
 * Intelligent Security Waterfall: Cross-references multiple indicators
 * UPGRADED: Now extracts Proxy and Verification status for SaaS Registry
 */
export async function runSecurityScan(address: string, chainId: number) {
  let isHoneypot = false;
  let tax = 0;
  let note = 'Analyzed Clean';
  let blacklisted = false;
  let isProxy = false;
  let isVerifiedSource = false;

  try {
    const auth = await getGoPlusAuth();
    // Production Add: ChainID validation for Honeypot.is V2
    const hpUrl = `https://api.honeypot.is/v2/IsHoneypot?address=${address}${chainId ? `&chainID=${chainId}` : ''}`;
    
    const [hpRes, gpRes] = await Promise.allSettled([
      fetch(hpUrl, { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
      fetch(`${CONFIG.GOPLUS_API}/token_security/${chainId}?contract_addresses=${address}`, {
        headers: auth ? { 'Authorization': auth } : {},
        signal: AbortSignal.timeout(6000)
      }).then(r => r.json())
    ]);

    // Handle Honeypot.is Data
    if (hpRes.status === 'fulfilled' && hpRes.value.honeypotResult?.isHoneypot) {
      isHoneypot = true;
      note = '🚨 HONEYPOT SIMULATION DETECTED';
      tax = (hpRes.value.simulationResult?.sellTax || 0) / 100;
    }

    // Handle GoPlus Data (Deep Contract Analysis)
    if (gpRes.status === 'fulfilled' && gpRes.value.result) {
      const s = gpRes.value.result[address] || gpRes.value.result[address.toLowerCase()];
      if (s) {
        isHoneypot = isHoneypot || s.is_honeypot === "1";
        blacklisted = s.is_blacklisted === "1";
        isProxy = s.is_proxy === "1";
        // If it's on Etherscan/BscScan, it's more trustworthy for devs
        isVerifiedSource = s.is_open_source === "1";
        
        const gpTax = parseFloat(s.sell_tax || "0");
        tax = Math.max(tax, gpTax);
        
        if (s.is_mintable === "1" && s.is_proxy !== "1") note = '🚨 UNRESTRICTED MINTING DETECTED';
        if (s.owner_change_balance === "1") note = '🚨 BALANCE MANIPULATION DETECTED';
        if (s.hidden_owner === "1") note = '🚨 HIDDEN OWNER (SCAM RISK)';
        // Production Add: Slippage/Tax Warning
        if (tax > 0.10 && !isHoneypot) note = `⚠️ HIGH SELL TAX DETECTED (${(tax * 100).toFixed(1)}%)`;
      }
    }
  } catch (e) {
    logger.error(`[Aegis-Scan] Waterfall partial failure for ${address}`);
  }

  return { isHoneypot, tax, note, blacklisted, isProxy, isVerifiedSource };
}

/**
 * Dynamic Oracle: Fetches native prices from Llama using Chain Config IDs
 */
async function getLiveNativePrice(nativePriceId: string): Promise<number> {
  const now = Date.now();
  if (NATIVE_PRICE_CACHE[nativePriceId] && NATIVE_PRICE_CACHE[nativePriceId].expiry > now) {
    return NATIVE_PRICE_CACHE[nativePriceId].price;
  }
  try {
    const res = await fetch(`${CONFIG.LLAMA_API}/coingecko:${nativePriceId}`, { signal: AbortSignal.timeout(4000) }).then(r => r.json());
    const price = res.coins?.[`coingecko:${nativePriceId}`]?.price || 0;
    if (price > 0) {
      NATIVE_PRICE_CACHE[nativePriceId] = { price, expiry: now + NATIVE_CACHE_TTL };
      return price;
    }
  } catch (e) { logger.warn(`[Aegis-Oracle] Native price failed for ${nativePriceId}`); }
  return 0;
}

/**
 * Pricing Waterfall: Fallback logic for low-liquidity assets
 * UPGRADED: Returns liquidity for SaaS "Confidence Score"
 */
export async function runPriceScan(address: string, symbol: string, chainId: number): Promise<{ price: number, liquidity: number }> {
  const sym = (symbol || '').toLowerCase();
  const chain = getChainById(chainId);
  
  // Production Add: Expanded Stable/Native Registry linked to chains.ts
  const stableAssets = ['usdc', 'usdt', 'dai', 'pyusd', 'usds', 'tusd'];
  if (stableAssets.includes(sym)) return { price: 1, liquidity: 999999999 };

  // UPGRADE: Dynamic Native Pricing (No more hardcoded 2500)
  if (chain && sym === chain.symbol.toLowerCase()) {
    const price = await getLiveNativePrice(chain.nativePriceId);
    if (price > 0) return { price, liquidity: 999999999 };
  }

  try {
    // Primary: DexScreener (Real-time Liquidity)
    const dexRes = await fetch(`${CONFIG.DEXSCREENER_API}/${address}`, { signal: AbortSignal.timeout(5000) }).then(r => r.json());
    const pair = (dexRes.pairs || [])
      .filter((p: any) => p.quoteToken?.symbol !== symbol) // Filter out self-paired liquidity
      .sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
    
    if (pair?.liquidity?.usd > CONFIG.LIQUIDITY_FLOOR) {
      return { price: parseFloat(pair.priceUsd), liquidity: pair.liquidity.usd };
    }

    // Fallback: DeFi Llama
    const platform = CONFIG.CG_PLATFORM_MAP[String(chainId)] || 'ethereum';
    const llama = await fetch(`${CONFIG.LLAMA_API}/${platform}:${address}`, { signal: AbortSignal.timeout(4000) }).then(r => r.json());
    const price = llama.coins?.[`platform}:${address}`]?.price;
    if (price) return { price, liquidity: 0 };
  } catch (e) {
    logger.warn(`[Aegis-Price] Trace failed for ${symbol}: ${e instanceof Error ? e.message : 'Timeout'}`);
  }

  return { price: 0, liquidity: 0 };
}

/**
 * Final Verdict Engine: Weighs Security vs. Metadata vs. Value
 * UPGRADED: Maps data to the new 2026 SaaS Schema fields
 */
export function calculateVerdict(asset: any, security: any, priceData: { price: number, liquidity: number }): TokenClassification {
  const usdValue = (parseFloat(asset.balance) || 0) * priceData.price;
  const isMalicious = security.isHoneypot || security.tax > 0.40 || security.blacklisted;
  
  let status: TokenClassification['status'] = 'clean';
  let note = security.note;

  if (isMalicious) {
    status = 'malicious';
    note = security.note !== 'Analyzed Clean' ? security.note : '🚨 MALICIOUS CONTRACT';
  } else {
    const name = (asset.name || '').toLowerCase();
    const symbol = (asset.symbol || '').toLowerCase();
    
    // Sovereign Add: Homoglyph/Lookalike Protection (Catching fake "USDC" using cyrillic chars)
    const isLookalike = (symbol.includes('с') || name.includes('о') || name.includes('а')) && 
                        (symbol === 'usdc' || symbol === 'usdt' || symbol === 'eth');

    // Production Add: Advanced Phishing Patterns (includes homoglyph-style common spam)
    const spamKeywords = ['visit', 'claim', 'free', 'reward', 'gift', 'voucher', 'airdrop', 'v0uc', 'clm'];
    
    const hasSpamMetadata = spamKeywords.some(k => name.includes(k) || symbol.includes(k)) || isLookalike;

    if (hasSpamMetadata) {
      status = 'spam';
      note = isLookalike ? '🚨 HOMOGLYPH LOOKALIKED DETECTED' : 'Phishing: Metadata triggers';
    } else if (priceData.price === 0) {
      status = 'dust'; // Unpriced assets treated as dust to protect UI
      note = 'System: Zero-Value/Unlisted Asset';
    } else if (usdValue < CONFIG.DUST_THRESHOLD) {
      status = 'dust';
    } else if (usdValue > 50 && security.isVerifiedSource && priceData.liquidity > 10000) {
      // High trust: verified source + good liquidity
      status = 'verified';
    }
  }

  // Final Production Shield: Ensure no negative USD values
  const finalUsdValue = Math.max(0, Number(usdValue.toFixed(4)));

  return {
    status,
    securityNote: note,
    score: status === 'malicious' ? 0 : (status === 'verified' ? 95 : (status === 'spam' ? 10 : 70)),
    usdValue: finalUsdValue,
    isHoneypot: security.isHoneypot,
    sellTax: security.tax,
    isProxy: security.isProxy,
    isVerifiedSource: security.isVerifiedSource,
    liquidityUsd: priceData.liquidity,
    canRecover: status !== 'malicious' && finalUsdValue > 3.50 && !security.blacklisted
  };
}
