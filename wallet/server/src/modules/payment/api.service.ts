import prisma from '../../config/database.js';
import crypto from 'crypto';

export const apiService = {
  async generateKey(wallet: string, plan: string) {
    // Check if they already have a key
    const existing = await prisma.apiKey.findFirst({ where: { wallet: wallet.toLowerCase() } });
    if (existing) return existing;

    const key = `WIP_SK_${crypto.randomBytes(16).toString('hex').toUpperCase()}`;
    return await prisma.apiKey.create({
      data: { 
        key, 
        wallet: wallet.toLowerCase(), 
        plan,
        usage: 0 
      }
    });
  },

  async validateAndIncrement(key: string) {
    return await prisma.apiKey.update({
      where: { key },
      data: { usage: { increment: 1 } }
    });
  },

  async getStats(wallet: string) {
    return await prisma.apiKey.findFirst({
      where: { wallet: wallet.toLowerCase() }
    });
  }
};
