import { useEffect } from "react";
import { useAccount, useConfig } from "wagmi";
import { getPublicClient } from "@wagmi/core";

/* ─── WALLET SCANNER ───────────────────────────────────────── */
/* Monitors wallet account, chain, and session status dynamically */

interface WalletScannerProps {
  account?: `0x${string}` | string | null;
  chain?: { id: number; name?: string } | any;
  // Note: onAccountChange and onChainChange are now mostly handled by Wagmi's
  // internal state, but we keep these props to trigger your custom logic.
  onAccountChange?: (acct: string | null) => void;
  onChainChange?: (chainId: number) => void;
  onDisconnect?: () => void;
  stayConnected?: boolean;
}

export default function WalletScanner({
  account,
  chain,
  onAccountChange,
  onChainChange,
  onDisconnect,
  stayConnected,
}: WalletScannerProps) {
  const { isConnected, address } = useAccount();
  const config = useConfig();

  /* ─── ACCOUNT & CHAIN WATCHER ───────────────────────── */
  // Instead of manual window.ethereum listeners, we watch the props 
  // passed down from the Wagmi hooks in the parent.
  useEffect(() => {
    if (!isConnected && onDisconnect) {
      onDisconnect();
      return;
    }

    if (address && onAccountChange) {
      onAccountChange(address);
    }
  }, [address, isConnected]);

  useEffect(() => {
    if (chain?.id && onChainChange) {
      onChainChange(chain.id);
    }
  }, [chain?.id]);

  /* ─── SESSION WATCHER ───────────────────────── */
  useEffect(() => {
    if (!stayConnected || !isConnected || !chain?.id) return;

    const interval = setInterval(async () => {
      try {
        // Wagmi v2 equivalent of provider.getBlockNumber()
        // This pings the RPC to ensure the connection is still alive
        const publicClient = getPublicClient(config, { chainId: chain.id });
        if (publicClient) {
          await publicClient.getBlockNumber();
        }
      } catch (err) {
        console.warn("Wallet session unreachable:", err);
        if (onDisconnect) onDisconnect();
        clearInterval(interval);
      }
    }, 15000); // every 15 seconds

    return () => clearInterval(interval);
  }, [stayConnected, isConnected, chain?.id, config]);

  /* ─── FALLBACK LOGGING ───────────────────────── */
  useEffect(() => {
    if (!isConnected && account) {
      console.log("Scanner fallback: user disconnected");
    }
  }, [isConnected, account]);

  /* ─── NO VISUAL UI ──── */
  return null;
}
