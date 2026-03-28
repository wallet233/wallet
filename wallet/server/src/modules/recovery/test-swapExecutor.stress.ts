import 'dotenv/config';
import swapExecutor from './swapExecutor.js';

const TEST_WALLET = '0x000000000000000000000000000000000000dEaD';

// Generate random token
function generateToken(chainId: number) {
  const symbols = ['USDT', 'USDC', 'DAI', 'WETH', 'UNI', 'LINK'];
  
  return {
    chainId,
    symbol: symbols[Math.floor(Math.random() * symbols.length)],
    address: '0x000000000000000000000000000000000000dEaD',
    contract: '0x000000000000000000000000000000000000dEaD',
    decimals: 18,
    balance: Math.floor(Math.random() * 1000),
    rawBalance: BigInt(Math.floor(Math.random() * 1e18)),
    usdValue: Math.random() * 2000 // up to $2k
  };
}

// Generate asset batch
function generateAssets() {
  const chains = [1, 137, 8453];
  const assets: any[] = [];

  const count = Math.floor(Math.random() * 5) + 1;

  for (let i = 0; i < count; i++) {
    const chainId = chains[Math.floor(Math.random() * chains.length)];
    assets.push(generateToken(chainId));
  }

  return assets;
}

// Main stress runner
async function runStressTest() {
  console.log('🔥 STARTING SWAP EXECUTOR WAR TEST...\n');

  const TOTAL_REQUESTS = 100;
  const CONCURRENCY = 25;

  let success = 0;
  let failed = 0;
  let aborted = 0;

  const startTime = Date.now();

  const batches = [];

  for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENCY) {
    const batch = [];

    for (let j = 0; j < CONCURRENCY; j++) {
      batch.push(
        (async () => {
          try {
            const assets = generateAssets();

            const result = await swapExecutor.getSmartRescueQuote(
              TEST_WALLET,
              assets,
              Math.random() > 0.5 ? 'PRO' : 'BASIC'
            );

            if (!result || result.length === 0) {
              aborted++;
              return;
            }

            success++;

          } catch (err: any) {
            failed++;
          }
        })()
      );
    }

    batches.push(Promise.all(batch));
  }

  await Promise.all(batches);

  const totalTime = Date.now() - startTime;

  console.log('\n📊 FINAL RESULTS:\n');
  console.log('Total Requests:', TOTAL_REQUESTS);
  console.log('✅ Success:', success);
  console.log('⚠️ Aborted (non-profitable / filtered):', aborted);
  console.log('❌ Failed:', failed);
  console.log('⏱ Total Time:', totalTime + 'ms');
  console.log('⚡ Avg per Request:', (totalTime / TOTAL_REQUESTS).toFixed(2) + 'ms');

  console.log('\n🚀 SYSTEM STATUS:',
    failed === 0 ? 'STABLE ✅' : 'UNSTABLE ❌'
  );
}

runStressTest().catch(err => {
  console.error('CRITICAL FAILURE:', err);
});
