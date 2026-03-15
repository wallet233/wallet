import React, { useEffect, useState } from "react";
import WalletAddress from "./WalletAddress";

/* ─── WALLET STATUS DISPLAY ───────────────────────────────────────── */
interface WalletStatusProps {
  account: string | null | undefined;
  chain?: { id: number; name?: string } | any;
  connected: boolean;
  stayConnected?: boolean;
  healthScore?: number;
  // Included to prevent breaking changes if passed from parent
  provider?: any;
  signer?: any;
}

export default function WalletStatus({
  account,
  chain,
  connected,
  stayConnected = false,
  healthScore = 0,
  provider,
  signer,
}: WalletStatusProps) {
  const [status, setStatus] = useState<string>("Disconnected");
  const [color, setColor] = useState<string>("#999");
  const [lastBlock, setLastBlock] = useState<number | null>(null);

  /* ─── STATUS & COLOR LOGIC ───────────────────────── */
  useEffect(() => {
    if (!connected) {
      setStatus("Disconnected");
      setColor("#999");
    } else if (connected && !account) {
      setStatus("Pending");
      setColor("#f5a623");
    } else {
      setStatus("Connected");
      setColor("#4caf50");
    }
  }, [connected, account]);

  /* ─── BLOCK MONITOR ───────────────────────── */
  useEffect(() => {
    if (!connected) return;

    const fetchBlock = async () => {
      try {
        // If a v2 provider/client is passed, use it, otherwise fallback
        if (provider?.getBlockNumber) {
          const blockNum = await provider.getBlockNumber();
          setLastBlock(Number(blockNum));
        }
      } catch (err) {
        console.warn("Block fetch failed", err);
      }
    };

    fetchBlock();
    let interval = setInterval(fetchBlock, 10000); // every 10 seconds

    return () => clearInterval(interval);
  }, [provider, connected]);

  /* ─── SESSION INDICATOR ───────────────────────── */
  const sessionIndicator = stayConnected ? "Persistent" : "Temporary";

  return (
    <div
      className="wallet-status"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-sm)",
        padding: "var(--space-sm)",
        background: "var(--bg-card, #fff)",
        borderRadius: "var(--radius-md, 8px)",
        minWidth: "200px",
        border: "1px solid #eee"
      }}
    >
      {/* Top status row */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span
          className="status-dot"
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            backgroundColor: color,
            animation: connected ? "pulse 1.2s infinite" : "none"
          }}
        />
        <span style={{ fontWeight: 600 }}>{status}</span>
        <span style={{ fontSize: "12px", color: "#666" }}>({sessionIndicator})</span>
      </div>

      {/* Wallet address component */}
      {account && (
        <WalletAddress
          account={account}
          chain={chain}
          healthScore={healthScore}
        />
      )}

      {/* Last block info */}
      {connected && lastBlock && (
        <div style={{ fontSize: "12px", color: "#999" }}>
          Last Block: {lastBlock}
        </div>
      )}

      {/* Styles */}
      <style>{`
        @keyframes pulse {
          0% { transform: scale(0.8); opacity: 0.7; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(0.8); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
