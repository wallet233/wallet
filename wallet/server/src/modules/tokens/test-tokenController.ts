import { scanTokensController } from './token.controller.js';
import { tokenService } from './token.service.js';
import fs from 'fs';
import path from 'path';

// 📁 output file
const OUTPUT_FILE = path.resolve('./wallet/server/src/modules/tokens/test-output.json');

// 🔥 Mock Express req/res
function createMockReqRes({ address, refresh }: any = {}, label: string) {
  const req: any = {
    query: { address, refresh },
    body: {},
    headers: {}
  };

  const res: any = {
    statusCode: 200,
    headers: {},
    body: null,

    setHeader(key: string, value: any) {
      this.headers[key] = value;
    },

    status(code: number) {
      this.statusCode = code;
      return this;
    },

    json(payload: any) {
      this.body = payload;

      // 📦 Append to JSON file
      const existing = fs.existsSync(OUTPUT_FILE)
        ? JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'))
        : [];

      existing.push({
        label,
        statusCode: this.statusCode,
        headers: this.headers,
        response: payload
      });

      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(existing, null, 2));

      console.log(`✅ Saved response: ${label}`);
      return this;
    }
  };

  return { req, res };
}

// 🔥 Mock tokenService behaviors
function mockTokenService(mode: string) {
  if (mode === 'success') {
    tokenService.fetchWalletTokens = async () => {
      return Array.from({ length: 100 }).map((_, i) => ({
        type: i % 5 === 0 ? 'native' : 'erc20',
        usdValue: Math.random() * 500,
        status: ['verified', 'spam', 'malicious', 'clean'][i % 4],
        isProxy: Math.random() > 0.6,
        upgradeCount: Math.random() > 0.75 ? 1 : 0
      }));
    };
  }

  if (mode === 'error') {
    tokenService.fetchWalletTokens = async () => {
      throw new Error('429 RATE_LIMIT');
    };
  }

  if (mode === 'timeout') {
    tokenService.fetchWalletTokens = async () => {
      return new Promise(() => {});
    };
  }
}

// 🚀 Runner
async function run() {
  console.log('🔥 TOKEN CONTROLLER BATTLE TEST\n');

  // clear previous output
  if (fs.existsSync(OUTPUT_FILE)) {
    fs.unlinkSync(OUTPUT_FILE);
  }

  // ✅ VALID
  mockTokenService('success');
  let { req, res } = createMockReqRes({
    address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    refresh: 'true'
  }, 'VALID_REQUEST');
  await scanTokensController(req, res);

  // ❌ INVALID
  ({ req, res } = createMockReqRes(
    { address: 'bad_address' },
    'INVALID_ADDRESS'
  ));
  await scanTokensController(req, res);

  // ⚠️ ERROR
  mockTokenService('error');
  ({ req, res } = createMockReqRes({
    address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
  }, 'RATE_LIMIT_ERROR'));
  await scanTokensController(req, res);

  // ⏳ TIMEOUT
  mockTokenService('timeout');
  ({ req, res } = createMockReqRes({
    address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
  }, 'TIMEOUT_TEST'));

  setTimeout(() => {
    res.status(504).json({ success: false, error: 'Forced timeout (test)' });
  }, 2000);

  await scanTokensController(req, res);

  console.log(`\n📁 Output saved to: ${OUTPUT_FILE}`);
}

run().catch(console.error);
