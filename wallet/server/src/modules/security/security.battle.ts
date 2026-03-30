import express from 'express';
import axios from 'axios';
import { scanSecurityController } from './security.controller.js';
import { validator } from '../../utils/validator.js';

/**
 * 2026 DIRECT-HIT STRATEGY
 * This script boots a micro-server to test the controller and validator 
 * in absolute isolation from the rest of the app.
 */

const app = express();
const PORT = 5001; // Separate port to avoid collisions
const API_BASE = `http://localhost:${PORT}/scan`;
const INTERNAL_KEY = "9293939sj39dn2oenaJKOw1oKHNa9e9iok0k11zo3ixja9wo3ndkzoskendkxks";

// Setup standard production middleware for the test
app.use(express.json());

// Mount the controller directly
app.all('/scan', validator.validateRequestBody, scanSecurityController);

const TEST_WALLETS = {
  SECURE_EOA: "0xd8dA6BF26964aF9d7eEd9e03E53415D37aA96045",
  MALFORMED: "0xInvalidAddress123",
  LOWERCASE: "0x742d35cc6634c0532925a3b844bc454e4438f44e",
};

async function runBattleTest() {
  const server = app.listen(PORT);
  console.log(`\n📡 Micro-Server online on port ${PORT}`);
  console.log("🚀 [2026] STARTING DIRECT ISOLATION TEST\n");

  let passCount = 0;
  let failCount = 0;

  const scenarios = [
    {
      name: "Standard POST Audit (Secure EOA)",
      method: 'POST',
      data: { address: TEST_WALLETS.SECURE_EOA, network: 'base' },
      expectedStatus: 200
    },
    {
      name: "Legacy GET Audit (URL Params)",
      method: 'GET',
      params: { address: TEST_WALLETS.SECURE_EOA, network: 'optimism' },
      expectedStatus: 200
    },
    {
      name: "Input Sanitization (Lowercase Auto-Checksum)",
      method: 'POST',
      data: { address: TEST_WALLETS.LOWERCASE },
      expectedStatus: 200,
      validate: (res: any) => {
        const wallet = res.data.data?.wallet;
        return wallet === "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
      }
    },
    {
      name: "Validation Failure (Invalid Address)",
      method: 'POST',
      data: { address: TEST_WALLETS.MALFORMED },
      expectedStatus: 422
    }
  ];

  for (const test of scenarios) {
    try {
      const res = await axios({
        method: test.method,
        url: API_BASE,
        headers: { 'x-api-key': INTERNAL_KEY },
        data: test.method === 'POST' ? test.data : undefined,
        params: test.method === 'GET' ? test.params : undefined,
        validateStatus: () => true 
      });

      if (res.status === test.expectedStatus) {
        const logicPass = test.validate ? test.validate(res) : true;
        if (logicPass) {
          console.log(`✅ [PASS] ${test.name}`);
          passCount++;
        } else {
          console.log(`❌ [FAIL] ${test.name}: Logic Validation Failed`);
          failCount++;
        }
      } else {
        console.log(`❌ [FAIL] ${test.name}: Expected ${test.expectedStatus}, got ${res.status}`);
        console.log(`   Response: ${JSON.stringify(res.data)}`);
        failCount++;
      }
    } catch (err: any) {
      console.log(`💥 [CRITICAL] ${test.name}: ${err.message}`);
      failCount++;
    }
  }

  console.log("\n🔥 STARTING CONCURRENCY BURST (15 Parallel Audits)...");
  const burstResults = await Promise.all(
    Array.from({ length: 15 }).map(() => 
      axios.post(API_BASE, { address: TEST_WALLETS.SECURE_EOA }).catch(e => e.response)
    )
  );

  const burstSuccess = burstResults.filter(r => r && r.status === 200).length;
  console.log(`📊 BURST COMPLETE: ${burstSuccess}/15 successful`);

  console.log("\n--- BATTLE SUMMARY ---");
  console.log(`TOTAL PASSED: ${passCount}`);
  console.log(`TOTAL FAILED: ${failCount}`);
  console.log("-----------------------\n");

  server.close();
  process.exit(failCount > 0 ? 1 : 0);
}

runBattleTest();
