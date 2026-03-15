import { useEffect } from "react";
import { ethers } from "ethers";

/* ─── WALLET SCANNER ───────────────────────────────────────── */
/* Monitors wallet account, chain, and session status dynamically */

interface WalletScannerProps {
  provider: ethers.providers.Web3Provider | null;
  signer: ethers.Signer | null;
  account: string | null;
  connected: boolean;
  stayConnected: boolean;
  onAccountChange: (acct: string | null) => void;
  onChainChange: (chainId: number) => void;
  onDisconnect: () => void;
}

export default function WalletScanner({
  provider,
  signer,
  account,
  connected,
  stayConnected,
  onAccountChange,
  onChainChange,
  onDisconnect,
}: WalletScannerProps) {

  /* ─── ACCOUNT & CHAIN WATCHER ───────────────────────── */
  useEffect(() => {
    if (!provider || !connected) return;

    const eth = (window as any).ethereum;
    if (!eth) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        onDisconnect();
      } else {
        onAccountChange(accounts[0]);
      }
    };

    const handleChainChanged = (chainId: string) => {
      const parsedId = parseInt(chainId, 16); // chainId comes as hex
      onChainChange(parsedId);
    };

    eth.on("accountsChanged", handleAccountsChanged);
    eth.on("chainChanged", handleChainChanged);

    return () => {
      eth.removeListener("accountsChanged", handleAccountsChanged);
      eth.removeListener("chainChanged", handleChainChanged);
    };
  }, [provider, connected]);

  /* ─── SESSION WATCHER ───────────────────────── */
  useEffect(() => {
    if (!stayConnected || !connected) return;

    let interval = setInterval(async () => {
      try {
        // Optional: ping the provider to keep session alive
        if (provider) await provider.getBlockNumber();
      } catch (err) {
        console.warn("Wallet disconnected or unreachable:", err);
        onDisconnect();
        clearInterval(interval);
      }
    }, 15000); // every 15 seconds

    return () => clearInterval(interval);
  }, [stayConnected, connected, provider]);

  /* ─── OPTIONAL OFFLINE MOCKS / FALLBACK ───────────────────────── */
  useEffect(() => {
    if (!connected && account) {
      console.log("Scanner fallback: user disconnected");
    }
  }, [connected, account]);

  /* ─── NO VISUAL UI ───────────────────────── */
  return null;
}
