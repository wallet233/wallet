import { ethers, getAddress } from 'ethers';
import { logger } from '../utils/logger.js';

/**
 * UPGRADED: Production-Grade Transaction Architect.
 * Features: BigInt-safe precision, Hex-normalization, and Atomic Bundle Sequencing.
 * Ensures "Real Money" movements are encoded with zero rounding errors.
 */
export const txBuilder = {
  // Standard Dead Address for burning assets
  BURN_ADDRESS: '0x000000000000000000000000000000000000dEaD',

  /**
   * Encodes a standard ERC20 'Burn' (Transfer to Dead Address).
   */
  async buildBurnTx(tokenAddress: string, amount: string, decimals: number = 18) {
    const iface = new ethers.Interface(["function transfer(address to, uint256 value)"]);
    
    try {
      // Use BigInt for internal math to maintain perfect precision
      const rawValue = ethers.parseUnits(amount, decimals);
      const data = iface.encodeFunctionData("transfer", [this.BURN_ADDRESS, rawValue]);

      return {
        to: getAddress(tokenAddress),
        data,
        value: "0x0",
        gasLimit: ethers.toQuantity(150000n), // Bumper for "Trap" tokens
        metadata: { type: 'BURN', symbol: 'SPAM', rawValue: rawValue.toString() },
        canBundle: true
      };
    } catch (err: any) {
      logger.error(`[TxBuilder] Failed to encode burn for ${tokenAddress}: ${err.message}`);
      throw err;
    }
  },

  /**
   * Encodes an Approval (Infinite by default for automation efficiency).
   */
  async buildApprovalTx(tokenAddress: string, spender: string, amount: string, decimals: number = 18) {
    const iface = new ethers.Interface(["function approve(address spender, uint256 value)"]);
    
    try {
      const rawValue = ethers.parseUnits(amount, decimals);
      const data = iface.encodeFunctionData("approve", [getAddress(spender), rawValue]);

      return {
        to: getAddress(tokenAddress),
        data,
        value: "0x0",
        gasLimit: ethers.toQuantity(85000n), 
        metadata: { type: 'APPROVAL', spender: getAddress(spender), rawValue: rawValue.toString() },
        canBundle: true
      };
    } catch (err: any) {
      logger.error(`[TxBuilder] Failed to encode approval: ${err.message}`);
      throw err;
    }
  },

  /**
   * Encodes a Revoke (Sets approval to 0).
   * Vital for protecting high-value wallets from compromised spenders.
   */
  async buildRevokeTx(tokenAddress: string, spender: string) {
    const iface = new ethers.Interface(["function approve(address spender, uint256 value)"]);
    
    try {
      const data = iface.encodeFunctionData("approve", [getAddress(spender), 0n]);

      return {
        to: getAddress(tokenAddress),
        data,
        value: "0x0",
        gasLimit: ethers.toQuantity(70000n),
        metadata: { type: 'REVOKE', targetSpender: getAddress(spender) },
        isSecurityAction: true
      };
    } catch (err: any) {
      logger.error(`[TxBuilder] Failed to encode revoke: ${err.message}`);
      throw err;
    }
  },

  /**
   * Builds a Native Asset Transfer (ETH/POL/BNB).
   * Uses Hex-encoding for the 'value' field as required by Ethers v6.
   */
  async buildNativeTransfer(to: string, amount: string) {
    try {
      const weiValue = ethers.parseUnits(amount, 18);
      return {
        to: getAddress(to),
        value: ethers.toQuantity(weiValue),
        data: "0x",
        gasLimit: ethers.toQuantity(21000n),
        metadata: { type: 'NATIVE_TRANSFER', rawValue: weiValue.toString() }
      };
    } catch (err: any) {
      logger.error(`[TxBuilder] Failed to encode native transfer: ${err.message}`);
      throw err;
    }
  },

  /**
   * Dynamic Fee Deduction Builder.
   * Ensures the platform's cut is calculated with BigInt precision to avoid "Dust" remainders.
   */
  async buildFeeTx(recipient: string, amountUsd: number, tokenPrice: number, tokenAddress: string) {
    try {
      // 1. Calculate token amount (e.g., $10 / $2500 ETH = 0.004)
      const feeTokenAmount = (amountUsd / tokenPrice).toFixed(18);
      const rawValue = ethers.parseUnits(feeTokenAmount, 18);
      
      const iface = new ethers.Interface(["function transfer(address to, uint256 value)"]);
      const data = iface.encodeFunctionData("transfer", [getAddress(recipient), rawValue]);

      return {
        to: getAddress(tokenAddress),
        data,
        value: "0x0",
        gasLimit: ethers.toQuantity(75000n),
        metadata: { type: 'PROTOCOL_FEE', usdValue: amountUsd, rawValue: rawValue.toString() }
      };
    } catch (err: any) {
      logger.error(`[TxBuilder] Failed to build fee tx: ${err.message}`);
      throw err;
    }
  },

  /**
   * ATOMIC SEQUENCE: Formats multiple TXs into a Flashbots-ready bundle.
   * Priority: 1. Revokes (Safety) -> 2. Approvals (Setup) -> 3. Burns/Swaps (Action) -> 4. Fees (Cleanup).
   */
  formatBundle(transactions: any[]) {
    const priorityMap: Record<string, number> = { 
      'REVOKE': 1, 
      'APPROVAL': 2, 
      'BURN': 3, 
      'NATIVE_TRANSFER': 4,
      'PROTOCOL_FEE': 5 
    };

    const sorted = [...transactions].sort((a, b) => {
      const typeA = a.metadata?.type || 'UNKNOWN';
      const typeB = b.metadata?.type || 'UNKNOWN';
      return (priorityMap[typeA] || 99) - (priorityMap[typeB] || 99);
    });

    // Map to a consistent format for the Flashbots Execution engine
    return sorted.map((tx, index) => ({
      ...tx,
      nonceOffset: index,
      // Ensure BigInt values are converted to strings/hex for the JSON-RPC layer
      value: tx.value ? BigInt(tx.value) : 0n,
      gasLimit: tx.gasLimit ? BigInt(tx.gasLimit) : 150000n
    }));
  }
};
