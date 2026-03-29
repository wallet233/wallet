import chalk from 'chalk';
import { Buffer } from 'buffer';
import { clearSensitiveData } from './crypto.js';

/**
 * UPGRADED: 2026 Institutional Financial Logger (v2.2 Hardened).
 * Features: Circular-Safe BigInt Serialization, Automated PII Scrubbing,
 * and Memory-Safe Buffer Purgatory for Private Key leak prevention.
 */
const IS_PROD = process.env.NODE_ENV === 'production';
const APP_VERSION = process.env.APP_VERSION || '2026.3.1-PROD';

const REDACT_KEYS = [
  'privatekey', 'seed', 'mnemonic', 'password', 'secret', 
  'key', 'token', 'auth', 'authorization', 'signature', 'pk',
  'private_key', 'xprv', 'master_seed'
];

/**
 * GLOBAL SERIALIZER SAFETY NET
 * Hardened for 2026: Handles BigInts, Symbols, and Circular References.
 */
const bigIntReplacer = (_key: string, value: any) => {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'symbol') return value.toString();
  return value;
};

/**
 * Deep-scans and redacts sensitive data with Circular Reference Protection.
 */
function redact(data: any, seen = new WeakSet()): any {
  if (data === null || typeof data !== 'object') return data;
  if (data instanceof Date) return data.toISOString();
  if (data instanceof RegExp) return data.toString();
  
  if (seen.has(data)) return '[Circular Reference]';
  seen.add(data);

  if (Array.isArray(data)) {
    return data.map(item => redact(item, seen));
  }

  const redactedObj: any = {};
  // Handle both standard and inherited properties (crucial for Error objects)
  const keys = Object.keys(data).concat(data instanceof Error ? ['message', 'name', 'stack', 'code'] : []);
  
  for (const key of new Set(keys)) {
    const value = (data as any)[key];
    const isSensitive = REDACT_KEYS.some(k => key.toLowerCase().includes(k));

    if (isSensitive && value !== undefined) {
      if (value instanceof Buffer) clearSensitiveData(value);
      redactedObj[key] = '[REDACTED_SENSITIVE_PII]';
    } else if (typeof value === 'bigint') {
      redactedObj[key] = value.toString();
    } else if (value instanceof Buffer) {
      redactedObj[key] = `Buffer<len:${value.length}>`;
    } else if (typeof value === 'object' && value !== null) {
      redactedObj[key] = redact(value, seen);
    } else {
      redactedObj[key] = value;
    }
  }
  return redactedObj;
}

function processError(err: any): any {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: IS_PROD ? undefined : err.stack, 
      code: (err as any).code,
      cause: (err as any).cause ? processError((err as any).cause) : undefined
    };
  }
  return err;
}

const formatMessage = (level: string, message: string, meta: any[]) => {
  const timestamp = new Date().toISOString();
  let traceId = 'SYSTEM';
  
  // Extract custom traces from meta
  if (meta.length > 0 && typeof meta[0] === 'string' && /^(TRACE|SEC|PAY|TX)-/.test(meta[0])) {
    traceId = meta.shift();
  }
  
  const processedMeta = meta.map(m => redact(processError(m)));

  if (IS_PROD) {
    return JSON.stringify({
      timestamp,
      level,
      traceId,
      message,
      context: processedMeta.length > 0 ? processedMeta : undefined,
      version: APP_VERSION,
      env: process.env.NODE_ENV
    }, bigIntReplacer);
  }

  const colors: Record<string, any> = {
    INFO: chalk.cyan,
    WARN: chalk.yellow,
    ERROR: chalk.red.bold,
    DEBUG: chalk.gray,
    TX: chalk.greenBright,
    AUDIT: chalk.magenta.bold
  };

  const color = colors[level] || chalk.white;
  // Use bigIntReplacer in the final stringify to catch any missed BigInts in complex local logs
  const metaStr = processedMeta.length > 0 
    ? ` | ${JSON.stringify(processedMeta, bigIntReplacer, 2)}` 
    : '';
  
  return `${color(`[${level}]`)} [${timestamp}] [${traceId}] ${message}${metaStr}`;
};

export const logger = {
  info: (message: string, ...meta: any[]) => {
    process.stdout.write(formatMessage('INFO', message, meta) + '\n');
  },
  warn: (message: string, ...meta: any[]) => {
    process.stderr.write(formatMessage('WARN', message, meta) + '\n');
  },
  error: (message: string, ...meta: any[]) => {
    process.stderr.write(formatMessage('ERROR', message, meta) + '\n');
  },
  debug: (message: string, ...meta: any[]) => {
    if (IS_PROD && process.env.LOG_LEVEL !== 'debug') return;
    process.stdout.write(formatMessage('DEBUG', message, meta) + '\n');
  },
  tx: (hash: string, chain: string, details: any = {}) => {
    const traceId = details.traceId || `TX-${hash.slice(2, 10).toUpperCase()}`;
    process.stdout.write(formatMessage('TX', `[SETTLEMENT] ${chain.toUpperCase()} | ${hash}`, [traceId, details]) + '\n');
  },
  audit: (action: string, wallet: string, result: object) => {
    process.stdout.write(formatMessage('AUDIT', `[AUDIT] ${action.toUpperCase()} | ${wallet}`, [result]) + '\n');
  }
};

export default logger;
