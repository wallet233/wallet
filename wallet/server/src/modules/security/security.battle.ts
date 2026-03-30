import axios from 'axios';

/**
 * 2026 BATTLE TEST: SECURITY MODULE
 * Specifically hardened for Middleware Order & Concurrency Resiliency.
 */

const API_ROOT = 'http://localhost:5000/api/v1/security';
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
      url: `${API_ROOT}/scan`,
      data: { address: TEST_WALLETS.SECURE_EOA, network: 'base' },
      expectedStatus: 200
    },
    {
      name: "Legacy GET Audit (URL Params)",
      method: 'GET',
      url: `${API_ROOT}/scan`,
      params: { address: TEST_WALLETS.SECURE_EOA, network: 'optimism' },
      expectedStatus: 200
    },
    {
      name: "Input Sanitization (Lowercase Auto-Checksum)",
      method: 'POST',
      url: `${API_ROOT}/scan`,
      data: { address: TEST_WALLETS.LOWERCASE },
      expectedStatus: 200,
      validate: (res: any) => {
        // Updated to handle standard 2026 nested data structure
        const wallet = res.data.data?.wallet || res.data.data?.address;
        // Verify it was correctly checksummed by the validator
        return wallet === "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
      }
    },
    {
      name: "Validation Failure (Invalid Address)",
      method: 'POST',
      url: `${API_ROOT}/scan`,
      data: { address: TEST_WALLETS.MALFORMED },
      expectedStatus: 422
    }
  ];

  for (const test of scenarios) {
    const start = performance.now();
    try {
      const res = await axios({
        method: test.method,
        url: test.url,
        headers: { 
          'x-api-key': INTERNAL_KEY,
          'Content-Type': 'application/json',
          'x-trace-id': `BATTLE-${Date.now()}`
        },
        // IMPORTANT: Axios only sends 'data' on POST/PUT, 'params' on GET
        data: test.method === 'POST' ? test.data : undefined,
        params: test.method === 'GET' ? test.params : undefined,
        validateStatus: () => true,
        timeout: 10000 
      });

      const duration = (performance.now() - start).toFixed(2);

      if (res.status === test.expectedStatus) {
        const logicPass = test.validate ? test.validate(res) : true;
        if (logicPass) {
          console.log(`✅ [PASS] ${test.name} (${duration}ms)`);
          passCount++;
        } else {
          console.log(`❌ [FAIL] ${test.name}: Logic Validation Failed (Checksum mismatch)`);
          failCount++;
        }
      } else {
        console.log(`❌ [FAIL] ${test.name}: Expected ${test.expectedStatus}, got ${res.status}`);
        console.log(`   Error: ${res.data.error || 'Unknown'} | Trace: ${res.data.traceId || 'N/A'}`);
        failCount++;
      }
    } catch (err: any) {
      console.log(`💥 [CRITICAL] ${test.name}: ${err.message}`);
      failCount++;
    }
  }

  console.log("\n🔥 STARTING CONCURRENCY BURST (15 Parallel Audits)...");
  
  const burstPromises = Array.from({ length: 15 }).map(() => 
    axios.post(`${API_ROOT}/scan`, 
      { address: TEST_WALLETS.SECURE_EOA }, 
      { 
        headers: { 
          'x-api-key': INTERNAL_KEY, 
          'Content-Type': 'application/json',
          'Connection': 'keep-alive'
        },
        timeout: 15000 
      }
    ).catch(e => e.response)
  );

  const burstResults = await Promise.all(burstPromises);
  const burstSuccess = burstResults.filter(r => r && r.status === 200).length;
  
  console.log(`📊 BURST COMPLETE: ${burstSuccess}/15 successful`);

  console.log("\n--- BATTLE SUMMARY ---");
  console.log(`TOTAL PASSED: ${passCount}`);
  console.log(`TOTAL FAILED: ${failCount}`);
  console.log(`BURST SCORE:  ${burstSuccess}/15`);
  console.log("-----------------------\n");

  process.exit(failCount > 0 || burstSuccess < 15 ? 1 : 0);
}

runBattleTest();
