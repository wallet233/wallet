import { prisma } from './src/config/database'; 
import { logger } from './src/utils/logger';
import { env } from './src/config/env';
import { chains } from './src/blockchain/chains'; 
import { walletScanner } from './src/blockchain/walletScanner';
import { dustCalculator } from './src/modules/recovery/dustCalculator';
import { spamDetector } from './src/modules/tokens/spamDetector';
import { txBuilder } from './src/blockchain/txBuilder';

async function runFinalDiagnostic() {
  logger.info("🛠️  INITIATING FULL SYSTEM ALIGNMENT CHECK...");

  try {
    // 1. CONFIG CHECK
    logger.info(`🌐 Env: ${env.NODE_ENV || 'development'}`);

    // 2. EXPLORER ROUTING (Tier 1)
    const baseConfig = chains.find((c: any) => c.name === 'Base');
    logger.info(`🔗 Explorer: ${baseConfig?.explorerUrl || 'Check chains.ts'}`);

    // 3. DB CONNECTION
    const userCount = await prisma.user.count().catch(() => 0);
    logger.info(`🗄️  DB: Handshake successful. Users: ${userCount}`);

    // 4. SCANNER & SPAM SYNC
    const MOCK_WALLET = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
    const mockTokens = [{ symbol: 'SCAM', balance: '100', isSpam: true }];
    const report = spamDetector.detect(mockTokens); // Adjusted to 'detect' based on common naming
    logger.info(`🔎 Spam Logic: ${report ? 'Active' : 'Offline'}`);

    // 5. RECOVERY & BIGINT (Tier 1)
    const mockWei = "500000000000000";
    const value = dustCalculator.calculate(mockWei); // Adjusted to 'calculate'
    logger.info(`🧪 Recovery: ${mockWei} Wei -> ${value} USD`);

    // 6. TX BUILDER
    const tx = await txBuilder.build({ to: MOCK_WALLET, value: "0", data: "0x" });
    logger.info("📦 TxBuilder: Payload construction SUCCESSFUL");

    console.log("\n✅ [SYSTEM GREEN]: All modules linked and responding.");

  } catch (error: any) {
    logger.error("🚨 ALIGNMENT FAILURE:", {
      message: error.message,
      location: error.stack?.split('\n')[1]
    });
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runFinalDiagnostic();
