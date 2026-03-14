import { useState } from 'react';

// ─── FILE: client/components/automation/AutoBurnToggle.tsx ───────────
// Standalone auto-burn toggle with configurable threshold
 interface AutoBurnToggleProps {
    defaultOn?: boolean;
      onChange?: (config: { enabled: boolean; threshold: string }) => void;
      }
export default function AutoBurnToggle({ defaultOn = true, onChange }: AutoBurnToggleProps) { 
  const [on, setOn] = useState(defaultOn);
  const [threshold, setThreshold] = useState('0.01');

  const handleToggle = () => {
    const next = !on;
    setOn(next);
    onChange?.({ enabled: next, threshold });
  };

  const handleThreshold = (val: string) => {
    setThreshold(val);
    onChange?.({ enabled: on, threshold: val });
  };

  return (
    <div className="abt-wrapper">
      {/* Rule row */}
      <div className="rule-row">
        <div className="rule-info">
          <span className="rule-icon" style={{ color: 'var(--red)' }}>🔥</span>
          <div>
            <div className="rule-title">Auto Burn Spam</div>
            <div className="rule-desc">
              {on
                ? `Burning tokens below $${threshold} confidence`
                : 'Auto-burn disabled'}
            </div>
          </div>
        </div>
        <button
          className={`toggle-track ${on ? 'on' : ''}`}
          onClick={handleToggle}
          aria-label="Toggle auto burn"
          style={{ border: 'none', cursor: 'pointer' }}
        >
          <div className="toggle-thumb" />
        </button>
      </div>

      {/* Threshold config — only visible when on */}
      {on && (
        <div className="abt-config">
          <span className="label-eyebrow">Burn threshold</span>
          <div className="abt-threshold-row">
            {['0.001', '0.01', '0.1', '1'].map(val => (
              <button
                key={val}
                className={`threshold-btn ${threshold === val ? 'active' : ''}`}
                onClick={() => handleThreshold(val)}
              >
                &lt;${val}
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .abt-wrapper { display: flex; flex-direction: column; }

        .abt-config {
          padding: var(--space-sm) var(--space-lg) var(--space-md);
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
          background: var(--bg-elevated);
          margin: 0 var(--space-md) var(--space-md);
          border-radius: var(--radius-md);
          border: 1px solid var(--border);
          animation: slideDown 0.2s ease both;
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .abt-threshold-row { display: flex; gap: var(--space-sm); }

        .threshold-btn {
          flex: 1;
          padding: 6px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-secondary);
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-fast);
          font-family: var(--font-mono);
        }

        .threshold-btn:hover { border-color: var(--border-hover); color: var(--text-primary); }

        .threshold-btn.active {
          background: var(--accent-dim);
          border-color: var(--border-accent);
          color: var(--accent);
        }
      `}</style>
    </div>
  );
}
