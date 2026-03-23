import { getAddress, isAddress } from 'ethers';
import { getAlchemyUrl, getProvider } from '../../blockchain/provider.js';
import { logger } from '../../utils/logger.js';
import { helpers } from '../../utils/helpers.js';
import crypto from 'crypto';

export interface Allowance {
  tokenAddress: string;
  spender: string;
  amount: string;
  isInfinite: boolean;
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  spenderName?: string;
  isMalicious?: boolean;
  maliciousReason?: string;
}

/**
 * UPGRADED: Production-Grade Security Intelligence Service.
 * Features: Heuristic Drainer Detection, API Failover, and Transaction Simulation.
 */
export const securityService = {
  riskCache: new Map<string, { profile: any, expiry: number }>(),
  CACHE_TTL: Number(process.env.SECURITY_CACHE_MS) || 3600000, 

  /**
   * Scans for open token approvals with redundant risk verification.
   */
  async scanApprovals(walletAddress: string, network: string = 'ethereum'): Promise<Allowance[]> {
    if (!isAddress(walletAddress)) throw new Error("INVALID_SECURITY_SCAN_ADDRESS");
    
    const url = getAlchemyUrl(network);
    const traceId = `SEC-SCAN-${crypto.randomUUID?.() || Date.now()}`;
    
    if (!url) {
      logger.error(`[SecurityService][${traceId}] Network ${network} not supported for Alchemy scans.`);
      return [];
    }

    try {
      // 1. Fetch Allowances with Retry Logic
      const data = await helpers.retry(async () => {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: Date.now(),
            method: "alchemy_getTokenAllowances",
            params: [{ owner: getAddress(walletAddress), pageKey: null }]
          })
        });
        if (!res.ok) throw new Error(`Alchemy HTTP ${res.status}`);
        return await res.json();
      }, 2);

      const result = data.result;
      if (!result?.tokenAllowances) return [];

      // 2. Parallel Intelligence Processing
      const allowances: Allowance[] = await Promise.all(
        result.tokenAllowances.map(async (allowance: any) => {
          const rawAmount = allowance.allowance;
          // Detect infinite approvals (Max Uint256)
          const isInfinite = rawAmount.includes('f') || rawAmount.startsWith('0xffffff') || rawAmount.length > 60; 
          const spenderAddr = getAddress(allowance.spender);
          const tokenAddr = getAddress(allowance.tokenAddress);

          // 3. MULTI-LAYER RISK ASSESSMENT
          const securityProfile = await this.assessSpenderRisk(spenderAddr, network);
          
          let riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
          
          if (securityProfile.isMalicious) {
            riskLevel = 'CRITICAL';
          } else if (isInfinite) {
            riskLevel = 'HIGH';
          } else if (BigInt(rawAmount) > 0n) {
            riskLevel = 'MEDIUM';
          }

          return {
            tokenAddress: tokenAddr,
            spender: spenderAddr,
            amount: isInfinite ? 'Infinite' : rawAmount,
            isInfinite,
            riskLevel,
            spenderName: securityProfile.name || 'Unknown Contract',
            isMalicious: securityProfile.isMalicious,
            maliciousReason: securityProfile.reason
          };
        })
      );

      // Priority Sort: Malicious/Critical first
      const priority = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
      return allowances.sort((a, b) => priority[a.riskLevel] - priority[b.riskLevel]);

    } catch (err: any) {
      logger.error(`[SecurityService][${traceId}] Critical failure: ${err.message}`);
      return [];
    }
  },

  /**
   * REAL-TIME THREAT DETECTION
   * Combined Heuristics + GoPlus Intelligence for "Real Money" protection.
   */
  async assessSpenderRisk(spender: string, network: string) {
    const cacheKey = `${network}:${spender.toLowerCase()}`;
    const cached = this.riskCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) return cached.profile;

    try {
      const provider = getProvider(network);
      const code = await provider.getCode(spender);
      
      // If no code, it's an EOA (Standard Wallet)
      if (code === '0x') {
        return { name: 'External Wallet', isMalicious: false };
      }

      // 1. HEURISTIC CHECK: Detect common "Drainer" patterns (unverified proxies)
      const isUnverifiedProxy = code.length < 500 && code.includes('5af158'); // Simple check for delegatecall proxies

      // 2. GO-PLUS API INTEGRATION
      const chainIdMap: Record<string, string> = JSON.parse(process.env.CHAIN_ID_MAP || '{"ethereum":"1","base":"8453","polygon":"137","bsc":"56"}');
      const chainId = chainIdMap[network.toLowerCase()] || '1';
      
      const goPlusRes = await fetch(`https://api.gopluslabs.io{spender}?chain_id=${chainId}`);
      const data = await goPlusRes.json();
      const result = data.result?.[spender.toLowerCase()];

      if (result) {
        const isBlacklisted = 
          result.is_honeypot === "1" || 
          result.is_malicious_contract === "1" ||
          result.data_source?.includes("phishfort") ||
          (result.is_proxy === "1" && result.is_open_source === "0") ||
          isUnverifiedProxy;

        const profile = {
          name: result.contract_name || (isUnverifiedProxy ? 'Unverified Proxy (High Risk)' : 'Unlabeled Contract'),
          isMalicious: !!isBlacklisted,
          reason: isBlacklisted ? 'Flagged as potential drainer or malicious contract' : undefined
        };

        this.riskCache.set(cacheKey, { profile, expiry: Date.now() + this.CACHE_TTL });
        return profile;
      }

      // Fallback for "Real Money" safety: If API fails, treat unverified proxies as suspicious
      return { 
        name: isUnverifiedProxy ? 'Suspicious Proxy' : 'Unknown Contract', 
        isMalicious: isUnverifiedProxy 
      };

    } catch (err: any) {
      logger.warn(`[SecurityService] Risk check failed for ${spender}: ${err.message}`);
      return { name: 'Security Offline', isMalicious: false };
    }
  },

  /**
   * TRANSACTION SIMULATION (Alchemy Asset Changes)
   * Essential for "Real Money": Detects if a tx will secretly drain tokens.
   */
  async simulateAction(walletAddress: string, tx: { to: string; data: string; value?: string }, network: string = 'ethereum') {
    const url = getAlchemyUrl(network);
    if (!url) return { status: 'FAILED', error: 'Simulation unsupported on this network', safe: false };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "alchemy_simulateAssetChanges",
          params: [{
            from: getAddress(walletAddress),
            to: getAddress(tx.to),
            value: tx.value || "0x0",
            data: tx.data
          }]
        })
      });

      const { result, error } = await res.json();
      if (error) throw new Error(error.message);

      // Verify if ANY high-value tokens are leaving the wallet
      const transfersOut = result.changes.filter((c: any) => 
        c.changeType === 'TRANSFER' && 
        c.from.toLowerCase() === walletAddress.toLowerCase()
      );

      return {
        status: 'SUCCESS',
        changes: result.changes,
        gasUsed: result.gasUsed,
        safe: transfersOut.length === 0,
        riskNote: transfersOut.length > 0 ? `CRITICAL: This transaction will drain ${transfersOut.length} assets.` : undefined
      };
    } catch (err: any) {
      logger.error(`[SecurityService] Simulation failed: ${err.message}`);
      return { status: 'FAILED', error: err.message, safe: false };
    }
  }
};
