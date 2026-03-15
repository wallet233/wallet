// ─── FILE: client/sex/app/recovery/page.tsx ──────────────────────────────

import { useState, useMemo } from 'react';
import RecoverDustButton from '../../components/actions/RecoverDustButton';
import BatchBurnButton   from '../../components/actions/BatchBurnButton';
import SweepSpamButton   from '../../components/actions/SweepSpamButton';
import "../../styles/components.css";

// ─── TYPES ────────────────────────────────────────────────────────────
type ItemType = 'all' | 'dust' | 'spam' | 'zero';

interface RecoveryItem {
  id:         string;
  symbol:     string;
  name:       string;
  chain:      string;
  chainLabel: string;
  balance:    string;
  usdValue:   number;
  type:       'dust' | 'spam' | 'zero';
  typeLabel:  string;
  logo?:      string;
}

// ─── MOCK DATA (replace with useRecovery() hook output) ───────────────
const ALL_ITEMS: RecoveryItem[] = [
  { id:'1',  symbol:'ETH',    name:'Ethereum',       chain:'eth',      chainLabel:'Ethereum', balance:'0.120',    usdValue:320.40, type:'dust', typeLabel:'Dust'  },
  { id:'2',  symbol:'USDC',   name:'USD Coin',       chain:'base',     chainLabel:'Base',     balance:'210.80',   usdValue:210.80, type:'dust', typeLabel:'Dust'  },
  { id:'3',  symbol:'MATIC',  name:'Polygon',        chain:'polygon',  chainLabel:'Polygon',  balance:'320.000',  usdValue:189.20, type:'dust', typeLabel:'Dust'  },
  { id:'4',  symbol:'ARB',    name:'Arbitrum',       chain:'arbitrum', chainLabel:'Arbitrum', balance:'148.200',  usdValue:126.80, type:'dust', typeLabel:'Dust'  },
  { id:'5',  symbol:'XSPAM',  name:'FreeTokenXYZ',   chain:'eth',      chainLabel:'Ethereum', balance:'100,000',  usdValue:0.00,   type:'spam', typeLabel:'Spam'  },
  { id:'6',  symbol:'GIFT',   name:'GiftDrop',       chain:'base',     chainLabel:'Base',     balance:'50,000',   usdValue:0.00,   type:'spam', typeLabel:'Spam'  },
  { id:'7',  symbol:'AIRDROP',name:'AirdropToken',   chain:'polygon',  chainLabel:'Polygon',  balance:'999,999',  usdValue:0.00,   type:'spam', typeLabel:'Spam'  },
  { id:'8',  symbol:'RUGGED', name:'RuggedProject',  chain:'polygon',  chainLabel:'Polygon',  balance:'999',      usdValue:0.00,   type:'zero', typeLabel:'Zero'  },
  { id:'9',  symbol:'DEAD',   name:'DeadToken',      chain:'eth',      chainLabel:'Ethereum', balance:'10,000',   usdValue:0.00,   type:'zero', typeLabel:'Zero'  },
  { id:'10', symbol:'OP',     name:'Optimism',       chain:'optimism', chainLabel:'Optimism', balance:'1.400',    usdValue:2.80,   type:'dust', typeLabel:'Dust'  },
];

const GAS_ESTIMATES: Record<string, { eth: string; savings: string }> = {
  recover: { eth: '~0.0018 ETH', savings: '91%' },
  burn:    { eth: '~0.0022 ETH', savings: '87%' },
  sweep:   { eth: '~0.0031 ETH', savings: '94%' },
};

const TYPE_TABS: { id: ItemType; label: string; color: string }[] = [
  { id: 'all',  label: 'All',  color: 'var(--text-secondary)' },
  { id: 'dust', label: 'Dust', color: 'var(--accent)'         },
  { id: 'spam', label: 'Spam', color: 'var(--red)'            },
  { id: 'zero', label: 'Zero', color: 'var(--text-tertiary)'  },
];

// ─── COMPONENT ────────────────────────────────────────────────────────
export default function RecoveryPage() {
  const [typeFilter, setTypeFilter]     = useState<ItemType>('all');
  const [selected,   setSelected]       = useState<Set<string>>(new Set());
  const [confirming, setConfirming]     = useState<'recover'|'burn'|'sweep'|null>(null);
  const [lastAction, setLastAction]     = useState<string | null>(null);

  // ── derived items ────────────────────────────────────────────────
  const visibleItems = useMemo(
    () => typeFilter === 'all' ? ALL_ITEMS : ALL_ITEMS.filter(t => t.type === typeFilter),
    [typeFilter]
  );

  const selectedItems  = ALL_ITEMS.filter(t => selected.has(t.id));
  const selectedValue  = selectedItems.reduce((s, t) => s + t.usdValue, 0);
  const dustTotal      = ALL_ITEMS.filter(t => t.type === 'dust').reduce((s,t) => s + t.usdValue, 0);
  const spamCount      = ALL_ITEMS.filter(t => t.type === 'spam').length;
  const zeroCount      = ALL_ITEMS.filter(t => t.type === 'zero').length;

  // ── selection helpers ─────────────────────────────────────────────
  const toggle    = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll = () => setSelected(new Set(visibleItems.map(t => t.id)));
  const clearAll  = () => setSelected(new Set());
  const allVisibleSelected = visibleItems.length > 0 && visibleItems.every(t => selected.has(t.id));

  // ── actions ──────────────────────────────────────────────────────
  const handleActionSuccess = (action: string) => {
    setLastAction(action);
    setSelected(new Set());
    setConfirming(null);
  };

  return (
    <div className="recovery-page">

      {/* ── PAGE HEADER ──────────────────────────────────────────── */}
      <div className="rp-header anim-fade-up">
        <div className="rp-header-text">
          <p className="label-eyebrow">Recovery Center</p>
          <h1 className="display-card">Recover &amp; Clean</h1>
        </div>
        {lastAction && (
          <div className="rp-success-banner animate-pop-in">
            <span style={{ color: 'var(--green)' }}>✓</span>
            {lastAction}
          </div>
        )}
      </div>

      {/* ── STAT RAIL ──────────────────────────────────────────────── */}
      <div className="rp-stats card anim-fade-up delay-1">
        <div className="stat-rail">
          <div className="stat-rail-item">
            <div className="stat-rail-value mono-value pnl-positive">${dustTotal.toFixed(2)}</div>
            <div className="stat-rail-label">Dust Available</div>
          </div>
          <div className="stat-rail-item">
            <div className="stat-rail-value mono-value" style={{ color: 'var(--red)' }}>{spamCount}</div>
            <div className="stat-rail-label">Spam Tokens</div>
          </div>
          <div className="stat-rail-item">
            <div className="stat-rail-value mono-value" style={{ color: 'var(--text-tertiary)' }}>{zeroCount}</div>
            <div className="stat-rail-label">Zero-Value</div>
          </div>
          <div className="stat-rail-item">
            <div className="stat-rail-value mono-value" style={{ color: 'var(--amber)' }}>{ALL_ITEMS.length}</div>
            <div className="stat-rail-label">Total Items</div>
          </div>
        </div>
      </div>

      {/* ── MAIN GRID ───────────────────────────────────────────── */}
      <div className="rp-grid">

        {/* LEFT — token list ─────────────────────────────────────── */}
        <div className="rp-list-col">
          <div className="rp-list-card card anim-fade-up delay-2">

            {/* List header */}
            <div className="rp-list-header">

              {/* Type filter tabs */}
              <div className="rp-type-tabs">
                {TYPE_TABS.map(tab => {
                  const count = tab.id === 'all'
                    ? ALL_ITEMS.length
                    : ALL_ITEMS.filter(t => t.type === tab.id).length;
                  return (
                    <button
                      key={tab.id}
                      className={`rp-type-tab ${typeFilter === tab.id ? 'active' : ''}`}
                      style={typeFilter === tab.id ? { color: tab.color, borderBottomColor: tab.color } : {}}
                      onClick={() => { setTypeFilter(tab.id); clearAll(); }}
                    >
                      {tab.label}
                      <span className="rp-type-count">{count}</span>
                    </button>
                  );
                })}
              </div>

              {/* Select all / clear */}
              <div className="rp-select-row">
                <label className="rp-select-all-label">
                  <div
                    className={`rr-checkbox ${allVisibleSelected ? 'checked' : ''}`}
                    onClick={allVisibleSelected ? clearAll : selectAll}
                  >
                    {allVisibleSelected && <span>✓</span>}
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
                  </span>
                </label>
                {selected.size > 0 && (
                  <button className="btn btn-ghost btn-sm" onClick={clearAll}>Clear</button>
                )}
              </div>
            </div>

            <div className="divider" />

            {/* Col headers */}
            <div className="rp-col-headers">
              <span style={{ gridColumn: '1 / 3' }}>Token</span>
              <span>Balance</span>
              <span style={{ textAlign: 'right' }}>Value</span>
            </div>

            {/* Item rows */}
            <div className="rp-list">
              {visibleItems.map((item, i) => (
                <RecoveryRow
                  key={item.id}
                  item={item}
                  selected={selected.has(item.id)}
                  onToggle={() => toggle(item.id)}
                  index={i}
                />
              ))}
              {visibleItems.length === 0 && (
                <div className="rp-empty">
                  <span>✓</span>
                  <p>No {typeFilter} items found</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — action panel ───────────────────────────────────── */}
        <div className="rp-action-col">
          <div className="rp-action-panel card anim-fade-up delay-3">
            <div className="rp-action-header">
              <span className="label-eyebrow">Selected</span>
              <div className="rp-selected-summary">
                <span className="mono-value pnl-positive" style={{ fontSize: 22 }}>
                  ${selectedValue.toFixed(2)}
                </span>
                {selected.size > 0 && (
                  <span className="rp-selected-count">{selected.size} tokens</span>
                )}
              </div>
            </div>

            <div className="divider" />

            {/* Action buttons */}
            <div className="rp-action-btns">
              <RecoverDustButton
                count={selected.size}
                disabled={selected.size === 0 || selectedItems.every(t => t.type !== 'dust')}
                onSuccess={() => handleActionSuccess(`Recovered $${selectedValue.toFixed(2)} in dust`)}
              />
              <BatchBurnButton
                count={selected.size}
                disabled={selected.size === 0}
                onSuccess={() => handleActionSuccess(`Burned ${selected.size} tokens`)}
              />
              <SweepSpamButton
                spamCount={spamCount}
                onSuccess={() => handleActionSuccess(`Swept ${spamCount} spam tokens`)}
              />
            </div>

            {/* Gas note */}
            <div className="rp-gas-note">
              <span className="rp-gas-icon">⛽</span>
              <span>Batch tx saves ~<strong style={{ color: 'var(--green)' }}>94% gas</strong> vs individual burns</span>
            </div>
          </div>

          {/* Gas estimator */}
          <div className="rp-gas-card card anim-fade-up delay-4">
            <span className="label-eyebrow">Gas Estimate</span>
            <div className="rp-gas-rows">
              {Object.entries(GAS_ESTIMATES).map(([op, est]) => (
                <div key={op} className="rp-gas-row">
                  <div className="rp-gas-op">
                    <span className="rp-gas-op-dot" />
                    <span style={{ textTransform: 'capitalize' }}>{op}</span>
                  </div>
                  <span className="mono-value" style={{ fontSize: 13 }}>{est.eth}</span>
                  <span className="pnl-badge positive" style={{ fontSize: 11 }}>-{est.savings}</span>
                </div>
              ))}
            </div>
            <div className="rp-gas-footer">
              <span className="rp-gas-network">
                <span className="chain-badge chain-eth"><span className="chain-dot" />Ethereum</span>
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>estimates only</span>
            </div>
          </div>

          {/* Recent activity */}
          <div className="rp-activity-card card anim-fade-up delay-5">
            <span className="label-eyebrow">Recent Activity</span>
            <div className="rp-activity-list">
              {RECENT_ACTIVITY.map(a => (
                <div key={a.id} className="rp-activity-row">
                  <span className={`rp-activity-icon ${a.type}`}>{a.icon}</span>
                  <div className="rp-activity-info">
                    <span className="rp-activity-label">{a.label}</span>
                    <span className="rp-activity-time">{a.time}</span>
                  </div>
                  {a.value && (
                    <span className="mono-value pnl-positive" style={{ fontSize: 12 }}>{a.value}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── RECOVERY ROW ─────────────────────────────────────────────────────
function RecoveryRow({ item, selected, onToggle, index }: {
  item: RecoveryItem;
  selected: boolean;
  onToggle: () => void;
  index: number;
}) {
  return (
    <div
      className={`rp-row animate-slide-up stagger-${Math.min(index + 1, 8)} ${selected ? 'selected' : ''}`}
      onClick={onToggle}
    >
      {/* Checkbox */}
      <div className={`rr-checkbox ${selected ? 'checked' : ''}`}>
        {selected && <span>✓</span>}
      </div>

      {/* Token icon */}
      <div className="token-icon">
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
          {item.symbol[0]}
        </span>
        {item.type === 'spam' && <div className="rp-spam-dot" title="Spam" />}
      </div>

      {/* Token info */}
      <div className="token-info">
        <div className="token-name">{item.symbol}</div>
        <div className="token-meta">
          <span className={`chain-badge chain-${item.chain}`}>
            <span className="chain-dot" />{item.chainLabel}
          </span>
          <span className={`rr-type-badge ${item.type}`}>{item.typeLabel}</span>
        </div>
      </div>

      {/* Balance */}
      <div className="rp-row-balance">
        <span className="mono-value" style={{ fontSize: 13 }}>{item.balance}</span>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{item.symbol}</span>
      </div>

      {/* USD value */}
      <div className="rp-row-value">
        {item.usdValue > 0 ? (
          <span className="mono-value pnl-positive" style={{ fontSize: 13 }}>
            ${item.usdValue.toFixed(2)}
          </span>
        ) : (
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>—</span>
        )}
      </div>
    </div>
  );
}

// ─── MOCK RECENT ACTIVITY ─────────────────────────────────────────────
const RECENT_ACTIVITY = [
  { id:1, type:'recover', icon:'◈', label:'Recovered ETH dust',      time:'2h ago',  value:'+$320.40' },
  { id:2, type:'burn',    icon:'🔥', label:'Burned 3 spam tokens',    time:'5h ago',  value:null       },
  { id:3, type:'sweep',   icon:'⬡', label:'Swept 7 zero-value',       time:'1d ago',  value:null       },
  { id:4, type:'recover', icon:'◈', label:'Recovered MATIC dust',     time:'2d ago',  value:'+$189.20' },
];
