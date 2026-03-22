import { rulesEngine } from './rulesEngine.js';
import { burnService } from '../burn/burn.service.js';
import { recoveryService } from '../recovery/recovery.service.js';
import { logger } from '../../utils/logger.js';
import { prisma } from '../../config/database.js';

/**
 * Premium Automation Service
 * Orchestrates tasks based on NFT Gating and User-Defined DB Rules.
 */
export const automationService = {
  /**
   * Background Execution Engine
   * Respects NFT ownership AND individual user toggles from the database.
   */
  async processAutomatedTasks(walletAddress: string) {
    const safeAddr = walletAddress.toLowerCase();

    // 1. Gating: Check Base NFT Membership
    const isEligible = await rulesEngine.isEligibleForAutomation(safeAddr);

    if (!isEligible) {
      logger.info(`[Automation] Wallet ${safeAddr} - No NFT. Skipping auto-cycle.`);
      return { status: 'SKIPPED', reason: 'NOT_A_HOLDER' };
    }

    // 2. Load User Rules from Prisma
    const userRules = await prisma.automationRule.findMany({
      where: { walletAddress: safeAddr, active: true }
    });

    if (userRules.length === 0) {
      logger.info(`[Automation] Holder ${safeAddr} has no active rules. Skipping.`);
      return { status: 'SKIPPED', reason: 'NO_ACTIVE_RULES' };
    }

    // 3. Conditional Execution Logic
    const hasBurnRule = userRules.some(r => r.type === 'AUTO_BURN');
    const hasRecoveryRule = userRules.some(r => r.type === 'AUTO_RECOVERY');

    logger.info(`[Automation] Holder: ${safeAddr} | Rules: Burn(${hasBurnRule}) Recovery(${hasRecoveryRule})`);

    // FIX: Explicitly type the task array to satisfy TypeScript (2339 / 7005)
    const taskNames: string[] = [];
    const tasks: Promise<any>[] = [];

    if (hasBurnRule) {
      tasks.push(burnService.executeSpamBurn(safeAddr));
      taskNames.push('BURN');
    }
    
    if (hasRecoveryRule) {
      tasks.push(recoveryService.executeDustRecovery(safeAddr));
      taskNames.push('RECOVERY');
    }

    // 4. Parallel execution
    const results = await Promise.allSettled(tasks);

    // 5. Cleanup & Persistence
    await prisma.wallet.update({
      where: { address: safeAddr },
      data: { lastSynced: new Date() }
    }).catch((e: any) => logger.warn(`[Automation] DB Sync Error: ${e.message}`));

    return {
      status: 'SUCCESS',
      wallet: safeAddr,
      tasksExecuted: tasks.length,
      details: results.map((res, i) => ({
        task: taskNames[i],
        status: res.status,
        result: res.status === 'fulfilled' ? 'SUCCESS' : 'FAILED'
      }))
    };
  }
};
