import { useMemo } from "react";

type Token = {
  id: string;
  symbol: string;
  balance: number | string;
  usdValue?: number | string;
  isSpam?: boolean;
};

type Props = {
  tokens: Token[];
};

export default function WalletHealthCard({ tokens }: Props) {
  // ─── DYNAMIC LOGIC ─────────────────────────────
  const { score, items } = useMemo(() => {
    const spamTokens = tokens.filter(t => t.isSpam);
    const dustTokens = tokens.filter(t => {
      const value = parseFloat(String(t.usdValue || 0));
      return value > 0 && value < 1;
    });

    // Clean ratio calculation
    const cleanRatio = tokens.length > 0 
      ? (tokens.filter(t => !t.isSpam).length / tokens.length) * 100 
      : 100;

    // Overall wallet health score
    const healthScore = Math.max(0, Math.round(cleanRatio - spamTokens.length * 8 - dustTokens.length * 2));

    // Breakdown items (clamped and safe)
    const breakdownItems = [
      { label: 'Token Quality', score: Math.min(100, Math.max(0, Math.round(cleanRatio))), color: 'var(--green)' },
      { label: 'Dust Level', score: Math.max(0, 100 - dustTokens.length * 10), color: 'var(--accent)' },
      { label: 'Spam Index', score: Math.max(0, 100 - spamTokens.length * 10), color: 'var(--red)' },
      { label: 'Recoverable Value', score: Math.min(100, Math.round(dustTokens.reduce((a,t) => a + parseFloat(String(t.usdValue || 0)), 0) * 10)), color: 'var(--accent)' },
    ];

    return { score: healthScore, items: breakdownItems };
  }, [tokens]);

  const color = score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--amber)' : 'var(--red)';

  return (
    <div className="whc-card card animate-slide-up stagger-2">
      <div className="whc-header">
        <span className="label-eyebrow">Wallet Health</span>
        <div className="whc-score-badge" style={{ color, background: `${color}18` }}>
          {score}
        </div>
      </div>

      {/* Ring indicator */}
      <div className="whc-ring-wrapper">
        <svg className="whc-ring" viewBox="0 0 120 120" width="120" height="120">
          <circle cx="60" cy="60" r="50" fill="none" stroke="var(--bg-elevated)" strokeWidth="8" />
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 314.16} 314.16`}
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.34,1.1,0.64,1)' }}
          />
        </svg>
        <div className="whc-ring-label">
          <span className="whc-ring-score mono-value" style={{ color }}>{score}</span>
          <span className="whc-ring-max">/100</span>
        </div>
      </div>

      {/* Breakdown bars */}
      <div className="whc-breakdown">
        {items.map(item => (
          <div key={item.label} className="whc-item">
            <div className="whc-item-header">
              <span className="whc-item-label">{item.label}</span>
              <span className="whc-item-score mono-value" style={{ color: item.color }}>{item.score}</span>
            </div>
            <div className="health-bar-track">
              <div className="health-bar-fill" style={{ width: `${item.score}%`, background: item.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── STYLES (Visuals intact) ─────────────────────────────
const styles = `
.whc-card { padding: var(--space-lg); display: flex; flex-direction: column; gap: var(--space-lg); }
.whc-header { display: flex; align-items: center; justify-content: space-between; }
.whc-score-badge { font-family: var(--font-mono); font-size: 13px; font-weight: 700; padding: 3px 10px; border-radius: var(--radius-pill); }
.whc-ring-wrapper { position: relative; width: 120px; height: 120px; margin: 0 auto; }
.whc-ring { transform-origin: center; }
.whc-ring-label { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 1px; }
.whc-ring-score { font-size: 28px; font-weight: 700; line-height: 1; }
.whc-ring-max { font-family: var(--font-mono); font-size: 12px; color: var(--text-tertiary); align-self: flex-end; padding-bottom: 4px; }
.whc-breakdown { display: flex; flex-direction: column; gap: var(--space-md); }
.whc-item { display: flex; flex-direction: column; gap: 6px; }
.whc-item-header { display: flex; justify-content: space-between; align-items: center; }
.whc-item-label { font-size: 13px; color: var(--text-secondary); }
.whc-item-score { font-size: 12px; font-variant-numeric: tabular-nums; }
`;

if (typeof document !== 'undefined') {
  const id = 'whc-styles';
  if (!document.getElementById(id)) {
    const el = document.createElement('style');
    el.id = id;
    el.textContent = styles;
    document.head.appendChild(el);
  }
}
