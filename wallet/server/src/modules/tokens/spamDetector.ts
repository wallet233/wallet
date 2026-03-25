import { logger } from '../../utils/logger.js';

export interface TokenClassification {
  status: 'verified' | 'spam' | 'dust' | 'clean' | 'malicious';
  securityNote: string | null;
  score: number;
  usdValue: number;
  isHoneypot?: boolean;
  isBlacklisted?: boolean;
  sellTax?: number;
  buyTax?: number;
  canRecover: boolean; // Vital for the Butler logic
}

// Configuration from Environment
const CONFIG = {
  GOPLUS_API: process.env.GOPLUS_API_BASE || 'https://api.gopluslabs.io/api/v1/token_security',
  COINGECKO_API: process.env.COINGECKO_API_BASE || 'https://api.coingecko.com/api/v3/simple/token_price',
  DEXSCREENER_API: 'https://api.dexscreener.com/latest/dex/tokens',
  CACHE_DURATION: Number(process.env.PRICE_CACHE_MS) || 300000, 
  DUST_THRESHOLD: Number(process.env.DUST_THRESHOLD_USD) || 0.50,
  CG_PLATFORM_MAP: JSON.parse(process.env.CG_PLATFORM_MAP || '{"1":"ethereum","137":"polygon-pos","8453":"base","56":"binance-smart-chain","42161":"arbitrum-one"}')
};

const priceCache = new Map<string, { price: number; timestamp: number }>();

async function getCachedPrice(key: string, fetcher: () => Promise<number>): Promise<number> {
  const now = Date.now();
  const cached = priceCache.get(key);
  if (cached && (now - cached.timestamp < CONFIG.CACHE_DURATION)) return cached.price;
  
  try {
    const freshPrice = await fetcher();
    if (freshPrice > 0) {
      priceCache.set(key, { price: freshPrice, timestamp: now });
    }
    return freshPrice;
  } catch (err) {
    logger.warn(`[PriceCache] Fetch failed for ${key}, using stale if available.`);
    return cached?.price || 0;
  }
}

/**
 * UPGRADED: Dynamic Spam & Threat Detector (Finance Grade)
 * Features: Liquidity Verification, GoPlus V2 Security, and Tax-Aware Recovery logic.
 */
export async function classifyToken(asset: any): Promise<TokenClassification> {
  const name = (asset.name || '').toLowerCase();
  const symbol = (asset.symbol || '').toLowerCase();
  const address = (asset.address || asset.contract || '').toLowerCase();
  const balance = parseFloat(asset.balance) || 0;
  const chainId = asset.chainId || 1;
  
  // 1. DYNAMIC HEURISTIC ANALYSIS (Fast metadata filter)
  const spamKeywords = (process.env.SPAM_KEYWORDS || 'visit,claim,free,reward,voucher,airdrop,ticket,win,get,vouchers,gift').split(',');
  if (spamKeywords.some(k => name.includes(k) || symbol.includes(k))) {
    return { status: 'spam', securityNote: 'Phishing: Metadata keywords', score: 0, usdValue: 0, canRecover: false };
  }

  // 2. DEEP SECURITY SCAN (Enterprise Security Layer)
  let isHoneypot = false;
  let isBlacklisted = false;
  let sellTax = 0;
  let hasLiquidity = true;

  if (address && asset.type !== 'native') {
    try {
      const response = await fetch(`${CONFIG.GOPLUS_API}/${chainId}?contract_addresses=${address}`, { 
        signal: AbortSignal.timeout(5000) 
      });
      
      if (response.ok) {
        const data = await response.json();
        const security = data.result?.[address];

        if (security) {
          isHoneypot = security.is_honeypot === "1" || security.honeypot_with_same_creator === "1";
          isBlacklisted = security.is_blacklisted === "1";
          sellTax = parseFloat(security.sell_tax || "0");
          const isProxy = security.is_proxy === "1";
          
          // FINANCE GUARD: Block honeypots or toxic taxes (>25% is usually a scam)
          if (isHoneypot || sellTax > 0.25 || isBlacklisted) { 
            return { 
              status: 'malicious', 
              securityNote: isHoneypot ? 'CRITICAL: Honeypot' : `SUSPICIOUS: ${(sellTax*100).toFixed(0)}% Tax`, 
              score: 0, 
              usdValue: 0,
              canRecover: false,
              isHoneypot,
              sellTax
            };
          }
        }
      }
    } catch (err) {
      logger.warn(`[SecurityScan] GoPlus timeout/fail for ${address}, falling back to heuristics.`);
    }
  }

  // 3. HYBRID PRICE & LIQUIDITY DISCOVERY
  let usdValue = 0;
  try {
    if (asset.type === 'native') {
      usdValue = balance * (asset.price || 0); 
    } else if (address) {
      const tokenPrice = await getCachedPrice(`price-${chainId}-${address}`, async () => {
        // Source A: DexScreener (Best for Liquidity check)
        const dexRes = await fetch(`${CONFIG.DEXSCREENER_API}/${address}`, { signal: AbortSignal.timeout(4000) });
        if (dexRes.ok) {
          const dexData = await dexRes.json();
          // Filter for pairs with at least 000 liquidity to avoid "fake price" scams
          const validPair = dexData.pairs?.find((p: any) => p.liquidity?.usd > 1000);
          if (validPair) return parseFloat(validPair.priceUsd);
        }

        // Source B: Coingecko (Fallback for Bluechips)
        const platform = CONFIG.CG_PLATFORM_MAP[chainId.toString()];
        if (platform) {
          const cgUrl = `${CONFIG.COINGECKO_API}/${platform}?contract_addresses=${address}&vs_currencies=usd`;
          const cgRes = await fetch(cgUrl);
          if (cgRes.ok) {
            const cgData = await cgRes.json();
            if (cgData[address]?.usd) return cgData[address].usd;
          }
        }
        return 0;
      });
      usdValue = balance * tokenPrice;
    }
  } catch (err) {
    logger.warn(`[PriceDiscovery] Failed for ${symbol}: ${err}`);
  }

  // 4. FINAL CLASSIFICATION
  const isDust = usdValue < CONFIG.DUST_THRESHOLD;
  const gasFloorUsd = 1.50; // Dynamic buffer for 2026 gas
  
  // Recovery is only viable if (Value - Gas - Taxes) > 0
  const netValue = usdValue * (1 - sellTax);
  const canRecover = !isHoneypot && netValue > (gasFloorUsd * 2.5);

  return {
    status: isDust ? 'dust' : (usdValue > 100 ? 'verified' : 'clean'),
    securityNote: isHoneypot ? 'Malicious' : (usdValue > 500 ? '💎 High Value' : 'Clean'),
    score: usdValue > 50 ? 90 : 60,
    usdValue: Number(usdValue.toFixed(4)),
    isHoneypot,
    isBlacklisted,
    sellTax,
    canRecover
  };
}
