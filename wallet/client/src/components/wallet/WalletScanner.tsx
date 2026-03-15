import { useEffect } from "react";
import { useAccount, useConfig } from "wagmi";
import { getPublicClient } from "@wagmi/core";

/**
 * WALLET SCANNER (v2 Heavy Duty)
 * Fixed 'process' error for browser environments.
 */

interface WalletScannerProps {
  account?: string | `0x${string}` | null;
  chain?: { id: number; name?: string } | any;
  connected?: boolean;
  stayConnected?: boolean;
  onAccountChange?: (acct: string | null) => void;
  onChainChange?: (chainId: number) => void;
  onDisconnect?: () => void;
  [key: string]: any; 
}

export default function WalletScanner({
  account,
  chain,
  connected,
  stayConnected,
  onAccountChange,
  onChainChange,
  onDisconnect,
  ...rest
}: WalletScannerProps) {
  const { isConnected, address } = useAccount();
  const config = useConfig();

  // 1. ACCOUNT WATCHER
  useEffect(() => {
    const currentAddress = address || (account as `0x${string}`);
    const currentConnected = isConnected || connected;

    if (!currentConnected) {
      if (onDisconnect) onDisconnect();
      return;
    }

    if (currentAddress && onAccountChange) {
      onAccountChange(currentAddress);
    }
  }, [address, isConnected, account, connected, onAccountChange, onDisconnect]);

  // 2. CHAIN WATCHER
  useEffect(() => {
    const chainId = chain?.id;
    if (chainId && onChainChange) {
      onChainChange(chainId);
    }
  }, [chain?.id, onChainChange]);

  // 3. RPC HEARTBEAT
  useEffect(() => {
    const isActive = isConnected || connected;
    if (!stayConnected || !isActive || !chain?.id) return;

    const interval = setInterval(async () => {
      try {
        const publicClient = getPublicClient(config, { chainId: chain.id });
        if (publicClient) {
          await publicClient.getBlockNumber();
        }
      } catch (err) {
        console.warn("WalletScanner: RPC heartbeat failed", err);
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [stayConnected, isConnected, connected, chain?.id, config]);

  // 4. CLEAN LOGGING (Removed Node.js 'process' check)
  useEffect(() => {
    const extraProps = Object.keys(rest);
    if (extraProps.length > 0) {
      console.debug("WalletScanner: Received dynamic props", extraProps);
    }
  }, [rest]);

  return null;
}
