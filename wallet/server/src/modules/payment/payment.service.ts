import prisma from '../../config/database.js';
import { getProvider } from '../../blockchain/provider.js';
import { EVM_CHAINS } from '../../blockchain/chains.js';
import { ethers } from 'ethers';

const REVENUE_ADDRESS = process.env.REVENUE_ADDRESS;
const ERC20_ABI = ["event Transfer(address indexed from, address indexed to, uint256 value)"];

export const paymentService = {
  async createIntent(wallet: string, amount: number, chain: string) {
    return await prisma.payment.create({
      data: {
        wallet: wallet.toLowerCase(),
        amount,
        chain,
        confirmed: false
      }
    });
  },

  // match the controller call
  async verifyOnChain(paymentId: string, txHash: string) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new Error("WIP_ID not found");

    const chainConfig = EVM_CHAINS.find(c => c.name === payment.chain);
    const provider = getProvider(chainConfig!.rpc);
    
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1) throw new Error("Transaction failed or pending");

    const isNativeToMe = receipt.to?.toLowerCase() === REVENUE_ADDRESS?.toLowerCase();
    
    let isTokenToMe = false;
    const iface = new ethers.Interface(ERC20_ABI);
    
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === 'Transfer' && parsed.args.to.toLowerCase() === REVENUE_ADDRESS?.toLowerCase()) {
          isTokenToMe = true;
          break;
        }
      } catch { continue; }
    }

    if (isNativeToMe || isTokenToMe) {
      return await prisma.payment.update({
        where: { id: paymentId },
        data: { txHash, confirmed: true }
      });
    }

    throw new Error("Payment did not reach the protocol treasury");
  }
};
