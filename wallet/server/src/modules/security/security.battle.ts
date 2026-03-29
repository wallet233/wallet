import axios from 'axios';

const API_BASE = 'http://localhost:5000/api/v1/security/scan';
const INTERNAL_KEY = "9293939sj39dn2oenaJKOw1oKHNa9e9iok0k11zo3ixja9wo3ndkzoskendkxks";

const TEST_WALLETS = {
  SECURE_EOA: "0xd8dA6BF26964aF9d7eEd9e03E53415D37aA96045",
  MALFORMED: "0xInvalidAddress123",
  LOWERCASE: "0x742d35cc6634c0532925a3b844bc454e4438f44e",
};

async function runBattleTest() {
  console.log("\n🚀 [2026] STARTING HEAVY BATTLE TEST: SECURITY_CONTROLLER\n");
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
      validate: (res: any) => res.data.data.wallet === "0x742d35Cc6634C0532925a3b844bc454e4438f44e"
    },
    {
      name: "Validation Failure (Invalid Address)",
      method: 'POST',
      data: { address: TEST_WALLETS.MALFORMED },
      expectedStatus: 422
    }
  ];

  for (const test of scenarios) {
    const start = performance.now();
    try {
      const res = await axios({
        method: test.method,
        url: API_BASE,
        headers: { 
          'x-api-key': INTERNAL_KEY,
          'Content-Type': 'application/json',
          'x-trace-id': `BATTLE-UNIT-${Date.now()}` 
        },
        data: test.data,
        params: test.params,
        validateStatus: () => true 
      });

      const duration = (performance.now() - start).toFixed(2);

      if (res.status === test.expectedStatus) {
        const logicPass = test.validate ? test.validate(res) : true;
        if (logicPass) {
          console.log(`✅ [PASS] ${test.name} (${duration}ms)`);
          passCount++;
        } else {
          console.log(`❌ [FAIL] ${test.name}: Logic Validation Failed (Checksum mismatch)`);
          console.log(`   Got: ${res.data.data?.wallet}`);
          failCount++;
        }
      } else {
        console.log(`❌ [FAIL] ${test.name}: Expected ${test.expectedStatus}, got ${res.status}`);
        // Log the actual traceId and error to find where it's coming from
        console.log(`   Error: ${res.data.error} | Trace: ${res.data.traceId}`);
        failCount++;
      }
    } catch (err: any) {
      console.log(`💥 [CRITICAL] ${test.name}: ${err.message}`);
      failCount++;
    }
  }

  console.log("\n🔥 STARTING CONCURRENCY BURST (15 Parallel Audits)...");
  const burstResults = await Promise.all(
    Array.from({ length: 15 }).map((_, i) => 
      axios.post(API_BASE, 
        { address: TEST_WALLETS.SECURE_EOA }, 
        { headers: { 'x-api-key': INTERNAL_KEY, 'Content-Type': 'application/json' } }
      ).catch(e => e.response)
    )
  );

  const burstSuccess = burstResults.filter(r => r && r.status === 200).length;
  console.log(`📊 BURST COMPLETE: ${burstSuccess}/15 successful`);

  console.log("\n--- BATTLE SUMMARY ---");
  console.log(`TOTAL PASSED: ${passCount}`);
  console.log(`TOTAL FAILED: ${failCount}`);
  console.log("-----------------------\n");

  process.exit(failCount > 0 ? 1 : 0);
}

runBattleTest();
