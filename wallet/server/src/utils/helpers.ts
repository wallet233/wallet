import { logger } from './logger.js';

/**
 * Tier 1 Helper Utilities
 * Features: Exponential Backoff, Address Formatting, and Promise Timeouts.
 */
export const helpers = {
  /**
   * Pause execution for a set duration
   */
  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Shorten a wallet address for UI (e.g. 0x123...456)
   */
  shortenAddress: (address: string) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  },

  /**
   * Universal Retry Wrapper: Automatically retries a function if it fails.
   * Crucial for flaky RPC providers.
   */
  async retry<T>(
    fn: () => Promise<T>, 
    retries: number = 3, 
    delay: number = 1000
  ): Promise<T> {
    try {
      return await fn();
    } catch (err: any) {
      if (retries <= 0) throw err;
      logger.warn(`[Helper] Retrying task... (${retries} attempts left)`);
      await new Promise(r => setTimeout(r, delay));
      return helpers.retry(fn, retries - 1, delay * 2); // Exponential backoff
    }
  },

  /**
   * Safely formats numbers to 2 decimal places for USD display
   */
  formatUsd: (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  }
};
