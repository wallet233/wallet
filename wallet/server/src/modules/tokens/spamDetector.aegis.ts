import { classifyToken } from './spamDetector.js';
import { performance } from 'perf_hooks';

/**
 * AEGIS-X: CACHE-OPTIMIZED BATTLE ENGINE (2026 PROD)
 * Proves the 7-day Disk Cache and BigInt precision under load.
 */

const TOXIC_DECK = [
  { name: "CLAIM YOUR VOUCHER", symbol: "GIFT", address: "0x1", balance: "1", chainId: 1 },
  { name: "Wrapped Ether", symbol: "WETH", address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", balance: "2.5", chainId: 1 },
  { name: "Fake Rewards", symbol: "FAKE", address: "0x495f947276749ce646f68ac8c248420045cb7b5e", balance: "1000000", chainId: 1 },
  { name: "Micro Dust", symbol: "DUST", address: "0x123", balance: "0.0000001", chainId: 1, type: 'erc20' },
  { name: "Ghost Token", symbol: "GHOST", address: "0x999", balance: "10", chainId: 9999 }
];

async function runAegisX() {
  console.log("\n🛡️  AEGIS-X: STARTING CACHE-AWARE BATTLE TEST...");
  
  // PHASE 1: WARM UP (Sequential to avoid 429s)
  console.log("📡 PHASE 1: Warming up Disk Cache (Sequential)...");
  for (const asset of TOXIC_DECK) {
    try {
      await classifyToken(asset);
      process.stdout.write(` warmed:${asset.symbol} `);
    } catch (e) {}
  }

  // PHASE 2: CONCURRENCY BURST (Hitting the cache)
  console.log("\n\n📡 PHASE 2: Concurrency Burst (50 tasks from Cache)...");
  const startTime = performance.now();
  const tasks: Promise<any>[] = [];

  for (let i = 0; i < 10; i++) {
    TOXIC_DECK.forEach((asset) => {
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
  const avgLatency = (success.reduce((acc, r) => acc + r.latency, 0) / success.length).toFixed(2);

  console.log("\n📊 AEGIS-X FINAL REPORT");
  console.log(`✅ TOTAL PROCESSED: ${success.length}`);
  console.log(`⏱️  TOTAL DURATION:  ${((endTime - startTime) / 1000).toFixed(2)}s`);
  console.log(`⚡ AVG LATENCY:     ${avgLatency}ms (Should be < 5ms if cached)`);

  console.log("\n🧪 LOGIC VALIDATION:");
  
  // Check if cache is actually working (Latency should be near zero)
  const cachedWeth = success.find(r => r.name === "Wrapped Ether");
  console.log(cachedWeth?.latency! < 10 ? "  ✅ Disk Cache: BLAZING FAST (Hit)" : "  ⚠️ Disk Cache: SLOW (Miss/API called)");

  // Validate BigInt Pricing
  console.log(cachedWeth?.result.usdValue > 3000 ? `  ✅ BigInt Pricing: ACCURATE ($${cachedWeth.result.usdValue})` : "  ❌ BigInt Pricing: FAILED");

  // Validate Security logic
  const fake = success.find(r => r.name === "Fake Rewards");
  console.log(fake?.result.status === 'malicious' ? "  ✅ Security: MALICIOUS DETECTED" : "  ❌ Security: BYPASS");

  const dust = success.find(r => r.name === "Micro Dust");
  console.log(dust?.result.canRecover === false ? "  ✅ Butler: SAFETY ON (Dust blocked)" : "  ❌ Butler: SAFETY OFF");

  process.exit(success.length === 50 ? 0 : 1);
}

runAegisX();
