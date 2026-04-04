import {
  runSecurityScan,
  runPriceScan,
  calculateVerdict
} from './spamDetector.js';

import { performance } from 'perf_hooks';
import crypto from 'crypto'; // UPGRADE: Added for unique address generation

// ===== CONFIG =====
const CONFIG = {
  TOTAL_REQUESTS: 3000,
  CONCURRENCY: 60,
  CHAOS_MODE: true,
  LOG_EVERY: 100
};

// ===== SAMPLE TOKENS =====
const TOKENS = [
  { address: '0xC02aaa39b223FE8D0A0e5C4F27ead9083C756Cc2', symbol: 'WETH', name: 'Wrapped Ether', chainId: 1 },
  { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', name: 'USD Coin', chainId: 1 },
  { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', name: 'Tether USD', chainId: 1 },
  { address: '0xSpam123456789012345678901234567890123456', symbol: 'FREE', name: 'Claim Reward', chainId: 1 },
  { address: '0xFake123456789012345678901234567890123456', symbol: 'USDT\u200B', name: 'Fake Tether', chainId: 1 }
];

// ===== METRICS =====
let success = 0;
let failed = 0;
let totalLatency = 0;
let malicious = 0;
let spam = 0;

// ===== RANDOMIZER =====
function getToken() {
  const base = TOKENS[Math.floor(Math.random() * TOKENS.length)];

  if (!CONFIG.CHAOS_MODE) return base;

  // UPGRADE: Generate unique random addresses to bypass SECURITY_CACHE and PRICE_CACHE
  // This forces the engine to actually exercise the API_CONCURRENCY slots.
  const uniqueAddress = `0x${crypto.randomBytes(20).toString('hex')}`;
  const realChainIds = [1, 56, 137, 8453, 42161]; // Common EVM IDs for test realism

  return {
    ...base,
    address: Math.random() < 0.1 ? 'INVALID' : (Math.random() < 0.8 ? uniqueAddress : base.address),
    symbol: Math.random() < 0.1 ? '' : base.symbol,
    name: Math.random() < 0.1 ? '<script>alert(1)</script>' : base.name,
    chainId: Math.random() < 0.05 ? 99999 : realChainIds[Math.floor(Math.random() * realChainIds.length)]
  };
}

// ===== SINGLE REQUEST =====
async function runOne(i: number) {
  const token = getToken();
  const start = performance.now();

  try {
    const security = await runSecurityScan(token.address, token.chainId);
    const price = await runPriceScan(token.address, token.symbol, token.chainId);

    const verdict = calculateVerdict(
      {
        balance: (Math.random() * 1000).toString(), // Stringified for Decimal compatibility
        symbol: token.symbol,
        name: token.name
      },
      security,
      price
    );

    const latency = performance.now() - start;
    totalLatency += latency;

    success++;

    // UPGRADE: Log specific types of detections for visibility during load
    if (verdict.status === 'malicious') malicious++;
    if (verdict.status === 'spam') spam++;

  } catch (e) {
    failed++;
  }

  if (i % CONFIG.LOG_EVERY === 0) {
    console.log(`Processed: ${i} | Success: ${success} | Failed: ${failed} | Latest Latency: ${(performance.now() - start).toFixed(2)}ms`);
  }
}

// ===== LOAD ENGINE =====
async function runTest() {
  console.log("🚀 AEGIS LOAD TEST STARTED (BYPASSING CACHE)\n");

  const startTime = performance.now();

  const executing = new Set<Promise<void>>();

  for (let i = 0; i < CONFIG.TOTAL_REQUESTS; i++) {
    const p = runOne(i);
    executing.add(p);

    p.finally(() => executing.delete(p));

    if (executing.size >= CONFIG.CONCURRENCY) {
      await Promise.race(executing);
    }
  }

  await Promise.allSettled(executing);

  const totalTime = (performance.now() - startTime) / 1000;

  console.log("\n📊 RESULTS");
  console.log("====================");
  console.log("Total:", CONFIG.TOTAL_REQUESTS);
  console.log("Success:", success);
  console.log("Failed:", failed);
  console.log("Success Rate:", ((success / CONFIG.TOTAL_REQUESTS) * 100).toFixed(2) + "%");
  console.log("Avg Latency:", (totalLatency / success).toFixed(2), "ms");
  console.log("Throughput:", (CONFIG.TOTAL_REQUESTS / totalTime).toFixed(2), "req/sec");
  console.log("Malicious:", malicious);
  console.log("Spam:", spam);
  console.log("Total Time:", totalTime.toFixed(2), "s"); 
  console.log("====================\n");
}

runTest();
