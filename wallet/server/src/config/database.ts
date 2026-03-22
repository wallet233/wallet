import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: ['error', 'warn'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Verifies the DB connection on boot
 */
export async function connectDB() {
  try {
    await prisma.$connect();
    logger.info('[Database] PostgreSQL Connection Verified.');
  } catch (err: any) {
    logger.error(`[Database] Connection Failed: ${err.message}`);
    process.exit(1);
  }
}
