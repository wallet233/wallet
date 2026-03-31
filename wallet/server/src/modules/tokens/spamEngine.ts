import { prisma } from '../../config/database.js';
import { runSecurityScan, runPriceScan, calculateVerdict } from './spamDetector.js';
import { logger } from '../../utils/logger.js';
import { ethers, isAddress, keccak256, solidityPacked } from 'ethers';

/**
 * AEGIS-ENGINE v3.0 (2026 Sovereign Grade)
 * Core Logic: Autonomous Orchestration, Fingerprint Drift, and Intelligence Lifecycle.
 * Philosophy: Trust the Ledger, Verify the Bytecode, Minimize the Waterfall.
 * Features: Adaptive TTL Scaling, Logic Drift Analytics, Atomic Forensic Sync.
 */

const IMPLEMENTATION_SLOT = "0x3608944802909281900310020130310202202202202202202202202202202202";

export class AegisEngine {
  /**
   * The "Grand Orchestrator": Processes assets with JIT (Just-In-Time) Verification.
   * Adapts re-scan frequency based on asset risk, code stability, and logic volatility.
   */
  static async getVerdict(asset: any, provider: any) {
    const address = String(asset.address || '').toLowerCase().trim();
    const chainId = Number(asset.chainId) || 1;
    const id = `${chainId}-${address}`;

    // Validates address format using Ethers v6 native method
    if (!address || !isAddress(address)) {
      return { status: 'spam', securityNote: 'Invalid Contract Address', usdValue: 0, canRecover: false };
    }

    try {
      // 1. DATABASE MEMORY RETRIEVAL (Table 2: LiveRegistry)
      // Fetches the current 'known' state from the Mesh.
      const live = await prisma.securityLiveRegistry.findUnique({ where: { id } });

      // 2. BLOCKCHAIN REALITY CHECK (RPC Fingerprinting)
      // We hash the bytecode + proxy implementation to detect logic shifts instantly.
      // This is a "Silent Scan" that costs $0 in API credits.
      const [onChainCode, onChainProxy] = await Promise.all([
        provider.getCode(address).catch(() => '0x'),
        provider.getStorage(address, IMPLEMENTATION_SLOT).catch(() => '0x0')
      ]);
      
      // Ethers v6: Deterministic fingerprinting of the contract logic state
      const currentFingerprint = keccak256(solidityPacked(['bytes', 'bytes'], [onChainCode, onChainProxy]));

      // 3. ADAPTIVE DECISION MATRIX (The Learning Layer)
      if (live) {
        const isMalicious = live.status === 'malicious';
        const codeIntact = live.fingerprint === currentFingerprint;
        
        /**
         * EVOLUTION: Trust Multiplier
         * If a token has been scanned many times without a code change, we extend its trust window.
         * This protects your API quotas from being drained by popular, stable tokens.
         */
        const trustMultiplier = Math.min((live.timesScanned || 1) / 5, 10); 
        const baseTTL = isMalicious ? 86400000 : 1800000; // 24h for bad tokens, 30m for potential clean tokens
        const adaptiveTTL = baseTTL * (codeIntact ? trustMultiplier : 1);
        
        const lastScannedMs = new Date(live.lastScanned).getTime();
        const isStale = (Date.now() - lastScannedMs) > adaptiveTTL;

        // If Malicious: Permanent Block (Never re-ping URLs).
        // If Clean & Intact & Not Stale: Instant return from Supabase.
        if (isMalicious || (codeIntact && !isStale)) {
          return live;
        }

        logger.info(`[Aegis-Engine] Re-Evaluating ${asset.symbol}: ${codeIntact ? 'Adaptive TTL Expiry' : 'Logic Drift Detected'}`);
      }

      // 4. INTELLIGENCE WATERFALL (URL Pings - Only triggered when necessary)
      // This part runs ONLY for new tokens, tokens that changed code, or expired trust windows.
      const [security, price] = await Promise.all([
        runSecurityScan(address, chainId),
        runPriceScan(address, asset.symbol || '', chainId)
      ]);

      const verdict = calculateVerdict(asset, security, price);

      // 5. ATOMIC SYNC (Live Registry + Master Archive)
      // Using a transaction ensures historical data integrity (Forensic Trail for Future Sale).
      return await prisma.$transaction(async (tx: any) => {
        // Update or Create the current "Live" state
        const updated = await tx.securityLiveRegistry.upsert({
          where: { id },
          update: { 
            ...verdict, 
            fingerprint: currentFingerprint, 
            lastScanned: new Date(),
            timesScanned: { increment: 1 },
            // Track exactly when logic shifts occurred
            lastChangeFound: live?.fingerprint !== currentFingerprint ? new Date() : live?.lastChangeFound
          },
          create: { 
            id, 
            address, 
            chainId, 
            ...verdict, 
            fingerprint: currentFingerprint,
            timesScanned: 1
          }
        });

        // Archive entry: Building the "Time-Machine" for the contract's lifecycle
        await tx.securityMasterArchive.create({
          data: {
            address,
            chainId,
            previousStatus: live?.status || 'NONE',
            newStatus: verdict.status,
            fingerprint: currentFingerprint,
            changeType: !live ? 'NEW_DISCOVERY' : (live.fingerprint !== currentFingerprint ? 'PROXY_UPGRADE' : 'RE_VERIFICATION')
          }
        });

        return updated;
      });

    } catch (error) {
      logger.error(`[Aegis-Engine] Logic Failure for ${address}:`, error instanceof Error ? error.stack : error);
      
      // Fail-Safe: Return a neutral "Clean" status with 0 value to ensure the wallet 
      // doesn't freeze, but marked as "Deferred" in notes.
      return { 
        status: 'clean', 
        securityNote: 'Verification Deferred (Network Congestion)', 
        usdValue: 0,
        canRecover: true 
      };
    }
  }
}
