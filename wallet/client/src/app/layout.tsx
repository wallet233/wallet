import { useState, useEffect } from 'react';
import LandingPage from './page';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import '../styles/globals.css';
import '../styles/animations.css';

// ─── NAV ICONS ───────────────────────────────────────────────────────
const IconDashboard = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);

const IconAutomation = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
  </svg>
);

const IconRecovery = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </svg>
);

const IconSettings = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconWallet = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
  </svg>
);

// ─── CONSTANTS ───────────────────────────────────────────────────────
const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: IconDashboard },
  { to: '/automation', label: 'Automation', icon: IconAutomation },
  { to: '/recovery', label: 'Recovery', icon: IconRecovery },
  { to: '/settings', label: 'Settings', icon: IconSettings },
];

// ─── SIDEBAR COMPONENT ───────────────────────────────────────────────
function Sidebar({ walletAddress }: { walletAddress: string | null }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark"><span>W</span></div>
        <div className="logo-text">
          <span className="logo-name">WIP</span>
          <span className="logo-sub">Protocol</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        {walletAddress ? (
          <div className="wallet-pill-sidebar">
            <div className="pulse-dot" />
            <span className="mono-address">
              {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
            </span>
          </div>
        ) : (
          <button className="btn btn-ghost btn-sm w-full">
            <IconWallet />
            Connect Wallet
          </button>
        )}
      </div>
    </aside>
  );
}

// ─── TOP NAVBAR ──────────────────────────────────────────────────────
function TopNav({ scrolled, walletAddress }: { scrolled: boolean; walletAddress: string | null }) {
  return (
    <header className={`topnav ${scrolled ? 'scrolled' : ''}`}>
      <div className="topnav-inner">
        <div className="topnav-logo mobile-only">
          <div className="logo-mark sm">W</div>
          <span className="logo-name">WIP</span>
        </div>

        <div className="topnav-brand desktop-only">WALLET INTELLIGENCE PROTOCOL</div>

        <div className="topnav-actions">
          {walletAddress ? (
            <div className="wallet-chip">
              <div className="pulse-dot" style={{ width: 6, height: 6 }} />
              <span className="mono-address">
                {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
              </span>
              <span className="health-chip">94</span>
            </div>
          ) : (
            <button className="btn btn-primary btn-sm">
              <IconWallet />
              Connect
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── MOBILE TAB BAR ──────────────────────────────────────────────────
function MobileTabBar() {
  return (
    <nav className="mobile-tabbar">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `mobile-tab-item ${isActive ? 'active' : ''}`}
        >
          <Icon />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

// ─── ROOT LAYOUT ─────────────────────────────────────────────────────
export default function Layout() {
  const [scrolled, setScrolled] = useState(false);
  const [walletAddress] = useState(null);
  const location = useLocation();
  const isLanding = location.pathname === '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);


  return (
    <div className="app-shell">
      <Sidebar walletAddress={walletAddress} />
      <div className="main-content">
        <TopNav scrolled={scrolled} walletAddress={walletAddress} />
        <main className="page-container page-enter">
          <Outlet />
        </main>
      </div>
      <MobileTabBar />
    </div>
  );
}
