import React, { useEffect, useState } from "react";
import WalletAddress from "./WalletAddress";

/* ─── WALLET STATUS DISPLAY ───────────────────────────────────────── */
interface WalletStatusProps {
  provider: any;
  signer: any;
  account: string | null;
  connected: boolean;
  stayConnected: boolean;
  healthScore?: number;
  chain?: string;
}

export default function WalletStatus({
  provider,
  signer,
  account,
  connected,
  stayConnected,
  healthScore = 0,
  chain = "eth",
}: WalletStatusProps) {
  const [status, setStatus] = useState<string>("Disconnected");
  const [color, setColor] = useState<string>("#999");
  const [lastBlock, setLastBlock] = useState<number | null>(null);

  /* ─── STATUS & COLOR LOGIC ───────────────────────── */
  useEffect(() => {
    if (!connected) {
      setStatus("Disconnected");
      setColor("#999");
    } else if (connected && !signer) {
      setStatus("Pending");
      setColor("#f5a623");
    } else {
      setStatus("Connected");
      setColor("#4caf50");
    }
  }, [connected, signer]);

  /* ─── BLOCK MONITOR ───────────────────────── */
  useEffect(() => {
    if (!provider || !connected) return;

    let interval = setInterval(async () => {
      try {
        const blockNum = await provider.getBlockNumber();
        setLastBlock(blockNum);
      } catch (err) {
        setStatus("Disconnected");
        setColor("#999");
      }
    }, 10000); // every 10 seconds

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
        background: "var(--bg-card)",
        borderRadius: "var(--radius-md)",
        minWidth: "200px"
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
