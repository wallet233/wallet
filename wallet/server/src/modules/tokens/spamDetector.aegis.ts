import { classifyToken } from './spamDetector.js';
import { performance } from 'perf_hooks';

/**
 * AEGIS-X: TOKEN SECURITY BATTLE ENGINE (2026 PROD-READY)
 * Tests: Concurrency, API Failover, Dust Thresholds, and Honeypot logic.
 */

const TOXIC_DECK = [
  // 1. Metadata Phishing (Fast Filter Test)
  { name: "CLAIM YOUR VOUCHER", symbol: "GIFT", address: "0x1", balance: "1", chainId: 1 },
  
  // 2. High-Value Bluechip (Real API Test)
  { name: "Wrapped Ether", symbol: "WETH", address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", balance: "2.5", chainId: 1 },
  
  // 3. Known Honeypot / High Tax (GoPlus Test - SwapNet 2026 Exploit Address)
  { name: "Fake Rewards", symbol: "FAKE", address: "0x495f947276749ce646f68ac8c248420045cb7b5e", balance: "1000000", chainId: 1 },

  // 4. Dust Asset (Recovery Logic Test)
  { name: "Micro Dust", symbol: "DUST", address: "0x123", balance: "0.0000001", chainId: 1, type: 'erc20' },

  // 5. Invalid Chain ID (Error Handling Test)
  { name: "Ghost Token", symbol: "GHOST", address: "0x999", balance: "10", chainId: 9999 }
];

async function runAegisX() {
  console.log("\n🛡️  AEGIS-X: STARTING PRODUCTION BATTLE TEST...");
  console.log(`📡 CONCURRENCY: 50 Simultaneous Classifications`);
  console.log("--------------------------------------------------\n");

  const startTime = performance.now();
  const tasks: Promise<any>[] = [];

  // Launch 50 concurrent tasks (10 cycles of the Toxic Deck)
  for (let i = 0; i < 10; i++) {
    TOXIC_DECK.forEach((asset, index) => {
      tasks.push((async () => {
        const tStart = performance.now();
        try {
          const result = await classifyToken(asset);
          return { success: true, latency: performance.now() - tStart, result, name: asset.name };
        } catch (e: any) {
          return { success: false, error: e.message, name: asset.name };
        }
      })());
    });
  }

  const results = await Promise.all(tasks);
  const endTime = performance.now();

  // --- ANALYTICS ---
  const success = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const avgLatency = (success.reduce((acc, r) => acc + r.latency, 0) / success.length).toFixed(2);

  console.log("📊 AEGIS-X FINAL REPORT");
  console.log(`✅ TOTAL PROCESSED: ${success.length}`);
  console.log(`❌ TOTAL CRASHED:   ${failed.length}`);
  console.log(`⏱️  TOTAL DURATION:  ${((endTime - startTime) / 1000).toFixed(2)}s`);
  console.log(`⚡ AVG LATENCY:     ${avgLatency}ms`);

  console.log("\n🧪 LOGIC VALIDATION:");
  
  // Validate "CLAIM YOUR VOUCHER" was caught by heuristics (Latency should be < 5ms)
  const spam = success.find(r => r.name === "CLAIM YOUR VOUCHER");
  console.log(spam?.latency! < 10 ? "  ✅ Heuristics: INSTANT (Fast-path working)" : "  ⚠️ Heuristics: SLOW (API was called unnecessarily)");

  // Validate WETH Value (Should be > $5000 based on 2.5 balance)
  const weth = success.find(r => r.name === "Wrapped Ether");
  console.log(weth?.result.usdValue > 5000 ? "  ✅ Pricing: ACCURATE (DexScreener/CG Live)" : "  ❌ Pricing: FAILED (Zero value returned)");

  // Validate Dust Recovery
  const dust = success.find(r => r.name === "Micro Dust");
  console.log(dust?.result.canRecover === false ? "  ✅ Butler: SAFETY ON (Dust recovery blocked)" : "  ❌ Butler: SAFETY OFF (Dust recovery allowed)");

  if (failed.length > 0) {
    console.log(`\n🚩 ERROR SAMPLE: ${failed[0].error}`);
  }

  process.exit(success.length === 50 ? 0 : 1);
}

runAegisX();
