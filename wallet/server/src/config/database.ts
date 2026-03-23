import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import { logger } from '../utils/logger.js';
import { encryptPrivateKey, clearSensitiveData } from '../utils/crypto.js';

/**
 * UPGRADED: High-Performance Production Database Engine.
 * Features: Connection Pooling, Auto-Encryption Middleware, and Memory Hygiene.
 */

const connectionString = process.env.DATABASE_URL;

// 1. High-Performance Connection Pool (Optimized for AWS/Supabase/Elephant)
const pool = new pg.Pool({ 
  connectionString,
  max: Number(process.env.DB_MAX_POOL) || 20, 
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // Increased for cross-region stability
  maxUses: 7500, // Recreate connections to prevent memory leaks
});

pool.on('error', (err) => {
  logger.error(`[Database] Pool Error: ${err.message}`);
});

/**
 * Verified Connection Bootstrapper
 */
export async function connectDB() {
  try {
    const client = await pool.connect();
    logger.info('[Database] PG Pool Connection Established.');
    client.release();
  } catch (err: any) {
    logger.error(`[Database] Connection Failed: ${err.stack || err.message}`);
    process.exit(1);
  }
}

// 2. Base Prisma Client (Standard Configuration)
const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

/**
 * 3. SECURITY EXTENSION (The "Vault" Middleware)
 * Automatically intercepts every write to the 'AutomationRule' table.
 * Crucial for "Real Money": Ensures keys are encrypted BEFORE they leave the server memory.
 */
export const prisma = basePrisma.$extends({
  query: {
    automationRule: {
      async create({ args, query }) {
        if (args.data.privateKey) {
          const raw = args.data.privateKey as string;
          args.data.privateKey = encryptPrivateKey(raw);
          // Wipe the raw key from memory immediately after encryption
          clearSensitiveData(raw);
        }
        return query(args);
      },
      async update({ args, query }) {
        if (args.data.privateKey && typeof args.data.privateKey === 'string') {
          const raw = args.data.privateKey;
          args.data.privateKey = encryptPrivateKey(raw);
          clearSensitiveData(raw);
        }
        return query(args);
      },
      async upsert({ args, query }) {
        // Handle 'Create' part of upsert
        if (args.create.privateKey) {
          const raw = args.create.privateKey as string;
          args.create.privateKey = encryptPrivateKey(raw);
          clearSensitiveData(raw);
        }
        // Handle 'Update' part of upsert
        if (args.update.privateKey && typeof args.update.privateKey === 'string') {
          const raw = args.update.privateKey;
          args.update.privateKey = encryptPrivateKey(raw);
          clearSensitiveData(raw);
        }
        return query(args);
      }
    },
  },
});

logger.info('[Database] Production Prisma Client with Auto-Vaulting Active.');
