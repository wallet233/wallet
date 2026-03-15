'use client';

 import WalletHealthCard from '../../components/dashboard/WalletHealthCard';
 import TokenList from '../../components/dashboard/TokenList';
 import DustSummary from '../../components/dashboard/DustSummary';
 import CleanPointsCard from '../../components/dashboard/CleanPointsCard';

/* ─── DASHBOARD PAGE ───────*/
export default function DashboardPage() {
  // Plug in real data via hooks later
  const portfolio = {
    totalUsd:    '$48,291.40',
    change24h:   '+$1,204.22',
    changePct:   '+2.56%',
    isPositive:  true,
    walletAddr:  '0x1a2b3c4d5e6f7a8b9c0d',
    healthScore: 94,
  };

  return (
    <div
    className="dashboard-page"
    style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}
      >
      {/* ── PORTFOLIO HERO (Zerion DNA — giant center-stage value) ── */}
      <section className="portfolio-hero anim-fade-up">
        <div className="portfolio-hero-inner">
          <div className="portfolio-value-block">
            <p className="label-eyebrow">Total Portfolio Value</p>
            <div className="portfolio-value mono-value">
              {portfolio.totalUsd}
            </div>
            <div className={`portfolio-change pnl-badge ${portfolio.isPositive ? 'positive' : 'negative'}`}>
              <span>{portfolio.isPositive ? '▲' : '▼'}</span>
              {portfolio.change24h} ({portfolio.changePct}) today
            </div>
          </div>

          {/* Wallet address chip */}
          <div className="portfolio-wallet-chip">
            <div className="pulse-dot" />
            <span className="mono-address">
              {portfolio.walletAddr.slice(0, 10)}…{portfolio.walletAddr.slice(-4)}
            </span>
            <span className="health-chip-lg">
              {portfolio.healthScore}
            </span>
          </div>
        </div>

        {/* Chain filter pills (Zerion DNA) */}
        <div className="chain-filter-row">
          <button className="chain-filter-btn active">All Chains</button>
          {[
            { id: 'eth', label: 'Ethereum' },
            { id: 'polygon', label: 'Polygon' },
            { id: 'arbitrum', label: 'Arbitrum' },
            { id: 'base', label: 'Base' },
            { id: 'optimism', label: 'Optimism' },
          ].map(c => (
            <button key={c.id} className="chain-filter-btn">
              <span className={`chain-badge chain-${c.id}`}>
                <span className="chain-dot" />
                {c.label}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ── STAT RAIL (Tesla DNA) ────────── */}
      <section className="dashboard-stats card anim-fade-up delay-1">
        <div className="stat-rail">
          <div className="stat-rail-item">
            <div className="stat-rail-value mono-value pnl-positive">$847.20</div>
            <div className="stat-rail-label">Dust Available</div>
          </div>
          <div className="stat-rail-item">
            <div className="stat-rail-value mono-value pnl-negative">23</div>
            <div className="stat-rail-label">Spam Tokens</div>
          </div>
          <div className="stat-rail-item">
            <div className="stat-rail-value mono-value">94</div>
            <div className="stat-rail-label">Health Score</div>
          </div>
          <div className="stat-rail-item">
            <div className="stat-rail-value mono-value" style={{ color: 'var(--amber)' }}>4</div>
            <div className="stat-rail-label">Pending Actions</div>
          </div>
        </div>
      </section>

      {/* ── MAIN GRID ───── */}
     <div className="dashboard-grid">
        <div className="dashboard-col-main">
          <TokenList />
        </div>

        <div className="dashboard-col-side">
          <WalletHealthCard />
          <DustSummary />
          <CleanPointsCard />
        </div>
      </div>
    </div>
  );
}
/* ─── PAGE STYLES ────── */
const styles = `
.dashboard-page {
display: flex;
flex-direction: column;
gap: var(--space-xl);
}

/* ─── PORTFOLIO HERO ─── */
.portfolio-hero {
display: flex;
flex-direction: column;
gap: var(--space-lg);
}

.portfolio-hero-inner {
display: flex;
align-items: flex-end;
justify-content: space-between;
gap: var(--space-lg);
flex-wrap: wrap;
}

.portfolio-value-block {
display: flex;
flex-direction: column;
gap: var(--space-sm);
}

.portfolio-value {
font-size: clamp(36px, 6vw, 64px);
font-weight: 600;
font-variant-numeric: tabular-nums;
color: var(--text-primary);
line-height: 1;
}

.portfolio-change {
font-size: 14px;
align-self: flex-start;
}

.portfolio-wallet-chip {
display: flex;
align-items: center;
gap: var(--space-sm);
padding: var(--space-sm) var(--space-md);
background: var(--bg-card);
border: 1px solid var(--border);
border-radius: var(--radius-pill);
cursor: pointer;
transition: border-color var(--transition-fast);
}
.portfolio-wallet-chip:hover { border-color: var(--border-hover); }

.health-chip-lg {
font-family: var(--font-mono);
font-size: 13px;
font-weight: 700;
padding: 3px 10px;
border-radius: var(--radius-pill);
background: var(--green-dim);
color: var(--green);
}

/* ─── CHAIN FILTER ── */
.chain-filter-row {
display: flex;
align-items: center;
gap: var(--space-sm);
flex-wrap: wrap;
}

.chain-filter-btn {
background: var(--bg-card);
border: 1px solid var(--border);
border-radius: var(--radius-pill);
padding: 6px 14px;
color: var(--text-secondary);
font-size: 13px;
font-weight: 500;
cursor: pointer;
transition: all var(--transition-fast);
font-family: var(--font-body);
}

.chain-filter-btn:hover { border-color: var(--border-hover); color: var(--text-primary); }
.chain-filter-btn.active {
background: var(--accent-dim);
border-color: var(--border-accent);
color: var(--accent);
}

.chain-filter-btn .chain-badge {
background: transparent;
padding: 0;
font-size: 13px;
}

/* ─── STAT RAIL CARD ─── */
.dashboard-stats {
padding: var(--space-md) var(--space-xl);
}

/* ─── DASHBOARD GRID ─── */
.dashboard-grid {
display: grid;
grid-template-columns: 1fr 320px;
gap: var(--space-xl);
align-items: start;
}

.dashboard-col-main,
.dashboard-col-side {
display: flex;
flex-direction: column;
gap: var(--space-lg);
}

/* ─── RESPONSIVE ─── */
@media (max-width: 900px) {
.dashboard-grid {
grid-template-columns: 1fr;
}
.dashboard-col-side {
display: grid;
grid-template-columns: repeat(2, 1fr);
}
}

@media (max-width: 600px) {
.dashboard-col-side {
grid-template-columns: 1fr;
  }
  .portfolio-hero-inner {
  flex-direction: column;
  align-items: flex-start;
  }
  }
  `;

if (typeof document !== 'undefined') {
  const existing = document.getElementById('dashboard-styles');
  if (!existing) {
    const style = document.createElement('style');
    style.id = 'dashboard-styles';
    style.textContent = styles;
    document.head.appendChild(style);
  }
} 