import React, { useState } from "react";

/* ─── WALLET ADDRESS DISPLAY ───────────────────────────────────────── */
interface WalletAddressProps {
  account: string | null;
  chain?: string; // e.g., 'eth', 'polygon'
  healthScore?: number; // optional health from dashboard
}

export default function WalletAddress({ account, chain = "eth", healthScore }: WalletAddressProps) {
  const [hover, setHover] = useState(false);
  const [copied, setCopied] = useState(false);

  /* ─── CHAIN COLOR ───────────────────────── */
  const chainColors: Record<string, string> = {
    eth: "#627eea",
    polygon: "#8247e5",
    arbitrum: "#28a0f0",
    base: "#0b0b0b",
    optimism: "#f01f0a",
    default: "#999"
  };
  const chainColor = chainColors[chain] || chainColors.default;

  /* ─── TRUNCATE ADDRESS ───────────────────────── */
  const displayAddress = account ? `${account.slice(0,6)}…${account.slice(-4)}` : "Not Connected";

  /* ─── BLOCKCHAIN EXPLORER LINK ───────────────────────── */
  const explorerUrls: Record<string, string> = {
    eth: "https://etherscan.io/address/",
    polygon: "https://polygonscan.com/address/",
    arbitrum: "https://arbiscan.io/address/",
    base: "https://basescan.org/address/",
    optimism: "https://optimistic.etherscan.io/address/"
  };
  const explorerLink = account ? (explorerUrls[chain] || explorerUrls.eth) + account : "#";

  /* ─── CLICK HANDLERS ───────────────────────── */
  const openExplorer = () => { if (account) window.open(explorerLink, "_blank", "noopener,noreferrer"); };
  const copyToClipboard = () => {
    if (!account) return;
    navigator.clipboard.writeText(account);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="wallet-address-container"
      style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: account ? "pointer" : "default" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Pulse dot for active connection */}
      {account && <span className="pulse-dot" style={{ backgroundColor: chainColor }} />}

      {/* Wallet address */}
      <span
        className="wallet-address-text"
        title={account || ""}
        style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: chainColor }}
      >
        {displayAddress}
      </span>

      {/* Health Score badge (optional) */}
      {healthScore !== undefined && (
        <span
          className="health-badge"
          style={{
            backgroundColor: "#e0e0e0",
            color: healthScore > 80 ? "green" : healthScore > 50 ? "orange" : "red",
            borderRadius: "999px",
            padding: "2px 6px",
            fontSize: "12px",
            fontWeight: 600
          }}
        >
          {healthScore}
        </span>
      )}

      {/* Optional View button */}
      {account && (
        <a
          href={explorerLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            textDecoration: "none",
            color: "#555",
            fontSize: "12px",
            padding: "2px 6px",
            border: "1px solid #ccc",
            borderRadius: "6px"
          }}
        >
          View
        </a>
      )}

      {/* Copy to clipboard button */}
      {account && (
        <button
          onClick={copyToClipboard}
          style={{
            fontSize: "12px",
            padding: "2px 6px",
            borderRadius: "6px",
            border: "1px solid #ccc",
            cursor: "pointer",
            backgroundColor: copied ? "#d4ffd4" : "#fff"
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      )}

      {/* Styles */}
      <style>{`
        .pulse-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          display: inline-block;
          animation: pulse 1.2s infinite;
        }
        @keyframes pulse {
          0% { transform: scale(0.8); opacity: 0.7; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(0.8); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
