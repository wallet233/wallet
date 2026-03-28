import 'dotenv/config';
import swapExecutor from './swapExecutor.js';

const TEST_WALLET = "0x000000000000000000000000000000000000dEaD";

/**
 * ATTACK SCENARIOS
 */
function generateAttackPayloads() {
  return [
    // 🐍 Honeypot token (fake high value, high risk)
    {
      symbol: "SCAM",
      address: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
      chainId: 1,
      decimals: 18,
      balance: "1000000000000000000000",
      rawBalance: "1000000000000000000000",
      usdValue: 5000 // bait
    },

    // 💣 Dust spam (should be filtered)
    {
      symbol: "DUST",
      address: "0x0000000000000000000000000000000000000001",
      chainId: 137,
      decimals: 18,
      balance: "1000",
      rawBalance: "1000",
      usdValue: 0.0001
    },

    // ⚡ High value (forces Flashbots)
    {
      symbol: "WETH",
      address: "0xC02aaa39b223FE8D0A0E5C4F27eAD9083C756Cc2",
      chainId: 1,
      decimals: 18,
      balance: "5000000000000000000",
      rawBalance: "5000000000000000000",
      usdValue: 15000
    },

    // 🚫 Non-profitable trap
    {
      symbol: "LOSS",
      address: "0x1111111111111111111111111111111111111111",
      chainId: 8453,
      decimals: 18,
      balance: "100000000000000000",
      rawBalance: "100000000000000000",
      usdValue: 2
    }
  ];
}

/**
 * MAIN TEST RUNNER
 */
async function runAttackSimulation() {
  console.log("🔥 STARTING ADVERSARIAL SWAP EXECUTOR TEST...\n");

  const payload = generateAttackPayloads();

  let success = 0;
  let failed = 0;
  let aborted = 0;

  const start = Date.now();

  const tasks = Array.from({ length: 100 }, async (_, i) => {
    try {
      const quotes = await swapExecutor.getSmartRescueQuote(
        TEST_WALLET,
        payload,
        i % 2 === 0 ? "BASIC" : "PRO"
      );

      if (!quotes || quotes.length === 0) {
        aborted++;
        return;
      }

      for (const q of quotes) {
        // 🔥 Force Flashbots execution path simulation
        if (q.strategy === "FLASHBOTS_MEV_SHIELD") {
          console.log(`⚡ Flashbots Triggered [${q.traceId}]`);
        }

        // 🧪 Simulate txBuilder failure randomly
        if (Math.random() < 0.2) {
          throw new Error("SIMULATED_TX_BUILDER_FAILURE");
        }

        // 🐍 Detect honeypot handling
        if (q.securityStatus === "RISKY") {
          console.log(`🐍 Risk Detected [${q.traceId}]`);
        }

        success++;
      }

    } catch (err: any) {
      if (err.message.includes("Non-profitable")) {
        aborted++;
      } else {
        failed++;
        console.error(`❌ Failure: ${err.message}`);
      }
    }
  });

  await Promise.all(tasks);

  const duration = Date.now() - start;

  console.log("\n📊 FINAL RESULTS:");
  console.log("=================================");
  console.log("Total Requests: 100");
  console.log(`✅ Success: ${success}`);
  console.log(`⚠️ Aborted: ${aborted}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️ Total Time: ${duration}ms`);
  console.log(`⚡ Avg: ${(duration / 100).toFixed(2)}ms`);

  console.log("\n🧠 SYSTEM VERDICT:");

  if (failed === 0) {
    console.log("🟢 RESILIENT: System survived adversarial conditions.");
  } else if (failed < 5) {
    console.log("🟡 WARNING: Minor instability under attack.");
  } else {
    console.log("🔴 CRITICAL: System vulnerable under stress.");
  }
}

runAttackSimulation().catch(console.error);
