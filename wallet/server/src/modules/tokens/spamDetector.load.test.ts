import {
  runSecurityScan,
  runPriceScan,
  calculateVerdict
} from './spamDetector.js';

import { performance } from 'perf_hooks';

// ===== CONFIG =====
const CONFIG = {
  TOTAL_REQUESTS: 3000,
  CONCURRENCY: 60,
  CHAOS_MODE: true,
  LOG_EVERY: 100
};

// ===== SAMPLE TOKENS =====
const TOKENS = [
  { address: '0xC02aa...', symbol: 'WETH', name: 'Wrapped Ether', chainId: 1 },
  { address: '0xA0b86...', symbol: 'USDC', name: 'USD Coin', chainId: 1 },
  { address: '0xdAC17...', symbol: 'USDT', name: 'Tether USD', chainId: 1 },
  { address: '0xSpam...', symbol: 'FREE', name: 'Claim Reward', chainId: 1 },
  { address: '0xFake...', symbol: 'USDT\u200B', name: 'Fake Tether', chainId: 1 }
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

  return {
    ...base,
    address: Math.random() < 0.1 ? 'INVALID' : base.address,
    symbol: Math.random() < 0.1 ? '' : base.symbol,
    name: Math.random() < 0.1 ? '<script>' : base.name,
    chainId: Math.random() < 0.05 ? 99999 : base.chainId
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
        balance: Math.random() * 100,
        symbol: token.symbol,
        name: token.name
      },
      security,
      price
    );

    const latency = performance.now() - start;
    totalLatency += latency;

    success++;

    if (verdict.status === 'malicious') malicious++;
    if (verdict.status === 'spam') spam++;

  } catch (e) {
    failed++;
  }

  if (i % CONFIG.LOG_EVERY === 0) {
    console.log("Processed:", i);
  }
}

// ===== LOAD ENGINE =====
async function runTest() {
  console.log("🚀 AEGIS LOAD TEST STARTED\n");

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
  console.log("====================\n");
}

runTest();
