import { ethers, getAddress } from 'ethers';
import { logger } from '../utils/logger.js';

/**
 * UPGRADED: Finance-Grade Transaction Architect.
 * Features: Fixed-point precision math, Strict Hex-normalization, 
 * and Nonce-aware Atomic Bundle Sequencing.
 */
export const txBuilder = {
  BURN_ADDRESS: '0x000000000000000000000000000000000000dEaD',
  BASE_PRECISION: BigInt(1e18),

  /**
   * Encodes a standard ERC20 'Burn'.
   */
  async buildBurnTx(tokenAddress: string, amount: string, decimals: number = 18) {
    const iface = new ethers.Interface(["function transfer(address to, uint256 value)"]);
    
    try {
      const rawValue = ethers.parseUnits(amount, decimals);
      const data = iface.encodeFunctionData("transfer", [this.BURN_ADDRESS, rawValue]);

      return {
        to: getAddress(tokenAddress),
        data,
        value: "0x0",
        gasLimit: ethers.toQuantity(160000n), // Slightly increased for complex proxy tokens
        metadata: { 
          type: 'BURN', 
          symbol: 'ASSET', 
          rawValue: rawValue.toString(),
          method: 'transfer(address,uint256)'
        },
        canBundle: true
      };
    } catch (err: any) {
      logger.error(`[TxBuilder] Failed to encode burn for ${tokenAddress}: ${err.message}`);
      throw err;
    }
  },

  /**
   * Encodes an Approval.
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
        gasLimit: ethers.toQuantity(95000n), 
        metadata: { 
          type: 'APPROVAL', 
          spender: getAddress(spender), 
          rawValue: rawValue.toString(),
          method: 'approve(address,uint256)'
        },
        canBundle: true
      };
    } catch (err: any) {
      logger.error(`[TxBuilder] Failed to encode approval: ${err.message}`);
      throw err;
    }
  },

  /**
   * Encodes a Revoke (Sets approval to 0).
   */
  async buildRevokeTx(tokenAddress: string, spender: string) {
    const iface = new ethers.Interface(["function approve(address spender, uint256 value)"]);
    
    try {
      const data = iface.encodeFunctionData("approve", [getAddress(spender), 0n]);

      return {
        to: getAddress(tokenAddress),
        data,
        value: "0x0",
        gasLimit: ethers.toQuantity(80000n),
        metadata: { 
          type: 'REVOKE', 
          targetSpender: getAddress(spender),
          isPriority: true 
        },
        isSecurityAction: true
      };
    } catch (err: any) {
      logger.error(`[TxBuilder] Failed to encode revoke: ${err.message}`);
      throw err;
    }
  },

  /**
   * Builds a Native Asset Transfer (ETH/POL/BNB).
   */
  async buildNativeTransfer(to: string, amount: string) {
    try {
      const weiValue = ethers.parseUnits(amount, 18);
      return {
        to: getAddress(to),
        value: ethers.toQuantity(weiValue),
        data: "0x",
        gasLimit: ethers.toQuantity(21000n),
        metadata: { 
          type: 'NATIVE_TRANSFER', 
          rawValue: weiValue.toString(),
          isEther: true 
        }
      };
    } catch (err: any) {
      logger.error(`[TxBuilder] Failed to encode native transfer: ${err.message}`);
      throw err;
    }
  },

  /**
   * Dynamic Fee Deduction Builder.
   * UPGRADED: Fixed-point math to prevent precision loss.
   */
  async buildFeeTx(recipient: string, amountUsd: number, tokenPrice: number, tokenAddress: string, decimals: number = 18) {
    try {
      // Logic: (USD_AMT * 10^18) / PRICE_USD = TOKEN_AMT (in wei-precision)
      const usdInBigInt = BigInt(Math.floor(amountUsd * 1e6)); 
      const priceInBigInt = BigInt(Math.floor(tokenPrice * 1e6));
      
      const rawValue = (usdInBigInt * ethers.parseUnits('1', decimals)) / priceInBigInt;
      
      const iface = new ethers.Interface(["function transfer(address to, uint256 value)"]);
      const data = iface.encodeFunctionData("transfer", [getAddress(recipient), rawValue]);

      return {
        to: getAddress(tokenAddress),
        data,
        value: "0x0",
        gasLimit: ethers.toQuantity(85000n),
        metadata: { 
          type: 'PROTOCOL_FEE', 
          usdValue: amountUsd, 
          rawValue: rawValue.toString(),
          tokenPrice
        }
      };
    } catch (err: any) {
      logger.error(`[TxBuilder] Failed to build fee tx: ${err.message}`);
      throw err;
    }
  },

  /**
   * ATOMIC SEQUENCE: Formats multiple TXs into a Flashbots-ready bundle.
   * Logic: Sorts by priority, normalizes hex values, and injects nonce offsets.
   */
  formatBundle(transactions: any[], startNonce: number = 0) {
    const priorityMap: Record<string, number> = { 
      'REVOKE': 1, 
      'SECURITY_ALERT': 1,
      'APPROVAL': 2, 
      'BURN': 3, 
      'RECOVERY': 3,
      'NATIVE_TRANSFER': 4,
      'PROTOCOL_FEE': 5 
    };

    const sorted = [...transactions].sort((a, b) => {
      const typeA = a.metadata?.type || 'UNKNOWN';
      const typeB = b.metadata?.type || 'UNKNOWN';
      return (priorityMap[typeA] || 99) - (priorityMap[typeB] || 99);
    });

    return sorted.map((tx, index) => {
      // Ensure gasLimit and value are Ethers-v6 compliant hex strings
      const normalizedValue = typeof tx.value === 'string' && tx.value.startsWith('0x') 
        ? tx.value 
        : ethers.toQuantity(BigInt(tx.value || 0));

      const normalizedGas = typeof tx.gasLimit === 'string' && tx.gasLimit.startsWith('0x')
        ? tx.gasLimit
        : ethers.toQuantity(BigInt(tx.gasLimit || 150000));

      return {
        ...tx,
        to: getAddress(tx.to),
        value: normalizedValue,
        gasLimit: normalizedGas,
        nonce: startNonce + index, // Essential for serial execution
        chainId: tx.chainId ? BigInt(tx.chainId) : undefined
      };
    });
  }
};
