import AutoRecoveryToggle from '../../components/automation/AutoRecoveryToggle';
import AutoBurnToggle from '../../components/automation/AutoBurnToggle';
import AutomationLogs from '../../components/automation/AutomationLogs';

// ─── AUTOMATION PAGE ──────────────────────────────────────────────────
export default function AutomationPage() {
  return (
    <div className="automation-page">
      {/* Header */}
      <div className="page-header anim-fade-up">
        <div>
          <p className="label-eyebrow">Automation Engine</p>
          <h1 className="display-card">Auto Clean</h1>
        </div>
        <div className="automation-status">
          <div className="pulse-dot" />
          <span style={{ fontSize: 13, color: 'var(--green)' }}>3 rules active</span>
        </div>
      </div>

      {/* Stat row */}
      <div className="auto-stats card anim-fade-up delay-1">
        <div className="stat-rail">
          <div className="stat-rail-item">
            <div className="stat-rail-value mono-value pnl-positive">$2,410</div>
            <div className="stat-rail-label">Total Recovered</div>
          </div>
          <div className="stat-rail-item">
            <div className="stat-rail-value mono-value">147</div>
            <div className="stat-rail-label">Spam Burned</div>
          </div>
          <div className="stat-rail-item">
            <div className="stat-rail-value mono-value">32</div>
            <div className="stat-rail-label">Actions This Week</div>
          </div>
          <div className="stat-rail-item">
            <div className="stat-rail-value mono-value" style={{ color: 'var(--accent)' }}>94%</div>
            <div className="stat-rail-label">Gas Savings</div>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="automation-grid">
        {/* Rules panel */}
        <div className="automation-rules">
          <div className="rules-panel card anim-fade-up delay-2">
            <div className="rules-header">
              <span className="label-eyebrow">Automation Rules</span>
              <button className="btn btn-ghost btn-sm">+ Add Rule</button>
            </div>
            <div className="rules-list">
              <AutoRecoveryToggle />
              <div className="divider" />
              <AutoBurnToggle/>
              <div className="divider" />
              <AutoSweepRule />
              <div className="divider" />
              <AutoScoreRule />
            </div>
          </div>

          {/* Schedule */}
          <div className="schedule-card card anim-fade-up delay-3">
            <span className="label-eyebrow">Execution Schedule</span>
            <div className="schedule-options">
              {['Every Block', 'Hourly', 'Daily', 'Weekly'].map((opt, i) => (
                <button
                  key={opt}
                  className={`schedule-opt ${i === 1 ? 'active' : ''}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Logs panel */}
        <AutomationLogs />
      </div>
    </div>
  );
}

// ─── INLINE RULE COMPONENTS ───────────────────────────────────────────
function AutoSweepRule() {
  return (
    <div className="rule-row">
      <div className="rule-info">
        <span className="rule-icon">⬡</span>
        <div>
          <div className="rule-title">Auto Sweep Zero-Value</div>
          <div className="rule-desc">Remove tokens worth less than $0.01</div>
        </div>
      </div>
      <div className="toggle-track on">
        <div className="toggle-thumb" />
      </div>
    </div>
  );
}

function AutoScoreRule() {
  return (
    <div className="rule-row">
      <div className="rule-info">
        <span className="rule-icon">◉</span>
        <div>
          <div className="rule-title">Score Maintenance</div>
          <div className="rule-desc">Keep health score above 90</div>
        </div>
      </div>
      <div className="toggle-track">
        <div className="toggle-thumb" />
      </div>
    </div>
  );
}

/* ─── STYLES ────────────────────────────────────────────────────────── */
const styles = `
.automation-page { display: flex; flex-direction: column; gap: var(--space-xl); }
.page-header { display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: var(--space-md); }
.automation-status { display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-sm) var(--space-md); background: var(--green-dim); border: 1px solid rgba(0,232,122,0.2); border-radius: var(--radius-pill); }
.auto-stats { padding: var(--space-md) var(--space-xl); }
.automation-grid { display: grid; grid-template-columns: 380px 1fr; gap: var(--space-xl); align-items: start; }
.automation-rules { display: flex; flex-direction: column; gap: var(--space-lg); }
.rules-panel { display: flex; flex-direction: column; overflow: hidden; }
.rules-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-lg); }
.rules-list { display: flex; flex-direction: column; }
.rule-row { display: flex; align-items: center; justify-content: space-between; padding: var(--space-md) var(--space-lg); gap: var(--space-lg); }
.rule-info { display: flex; align-items: center; gap: var(--space-md); }
.rule-icon { font-size: 20px; color: var(--accent); flex-shrink: 0; }
.rule-title { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.rule-desc { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
.schedule-card { padding: var(--space-lg); display: flex; flex-direction: column; gap: var(--space-md); }
.schedule-options { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-sm); }
.schedule-opt { padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg-elevated); color: var(--text-secondary); font-size: 12px; font-weight: 600; cursor: pointer; transition: all var(--transition-fast); font-family: var(--font-body); }
.schedule-opt:hover { border-color: var(--border-hover); color: var(--text-primary); }
.schedule-opt.active { background: var(--accent-dim); border-color: var(--border-accent); color: var(--accent); }
@media (max-width: 900px) { .automation-grid { grid-template-columns: 1fr; } }
@media (max-width: 600px) { .schedule-options { grid-template-columns: repeat(2, 1fr); } }
`;

if (typeof document !== 'undefined') {
  const id = 'automation-page-styles';
  if (!document.getElementById(id)) {
    const el = document.createElement('style');
    el.id = id;
    el.textContent = styles;
    document.head.appendChild(el);
  }
}
