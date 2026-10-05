import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { RECORD_STATUS } from '@nawi/shared';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ROLE_LABELS } from '../../lib/format.js';
import { Icon } from '../ui/Icon.jsx';
import { CommandPalette } from './CommandPalette.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/records/new', label: 'New test record', icon: 'plus', permission: 'record:create' },
  { to: '/repository?status=SUBMITTED', label: 'Approvals', icon: 'inbox', permission: 'record:review', badge: 'approvals' },
  { to: '/repository', label: 'Report repository', icon: 'folder' },
  { to: '/weights', label: 'Reference weights', icon: 'scale', permission: 'weights:view' },
  { to: '/users', label: 'Users', icon: 'users', permission: 'users:manage' },
];

const PALETTE_PAGES = [...NAV, { to: '/profile', label: 'My profile & signature', icon: 'user' }];

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

/** Records awaiting review, refreshed on navigation so the badge follows approvals. */
function useApprovalCount(enabled) {
  const location = useLocation();
  const [count, setCount] = useState(null);
  useEffect(() => {
    if (!enabled) return;
    api.records
      .list({ status: RECORD_STATUS.SUBMITTED, current: 'true', pageSize: 1 })
      .then((r) => setCount(r.total))
      .catch(() => {});
  }, [enabled, location.pathname]);
  return count;
}

function NavItems({ onNavigate, badges }) {
  const { can } = useAuth();
  const location = useLocation();
  const items = NAV.filter((n) => !n.permission || can(n.permission));
  // NavLink ignores the query string, so prefer an exact path+query match when one exists.
  const current = location.pathname + location.search;
  const exact = items.find((n) => n.to === current)?.to;

  return (
    <nav className="space-y-0.5">
      {items.map((n) => {
        const badge = n.badge ? badges[n.badge] : null;
        return (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
                (exact ? exact === n.to : isActive && !n.to.includes('?'))
                  ? 'bg-white/10 text-white shadow-inner'
                  : 'text-brand-200 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <Icon name={n.icon} className="h-[18px] w-[18px] opacity-80 group-hover:opacity-100" />
            <span className="flex-1">{n.label}</span>
            {badge > 0 && (
              <span className="num rounded-full bg-amber-400 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-amber-950" aria-label={`${badge} awaiting`}>
                {badge}
              </span>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}

export function AppLayout() {
  const { user, logout, can } = useAuth();
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const approvals = useApprovalCount(can('record:review'));

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const sidebar = (
    <div className="flex h-full flex-col bg-gradient-to-b from-brand-950 to-brand-900 px-3 py-5">
      <Link to="/" className="mb-7 flex items-center gap-3 px-2" onClick={() => setOpen(false)}>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white ring-1 ring-white/20">
          <Icon name="scale" className="h-5 w-5" />
        </span>
        <span>
          <span className="block text-[15px] font-semibold leading-tight text-white">NAWI Test Records</span>
          <span className="block text-[11px] uppercase tracking-wider text-brand-300">Legal Metrology · R 76</span>
        </span>
      </Link>
      <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-brand-400">Workspace</p>
      <NavItems onNavigate={() => setOpen(false)} badges={{ approvals }} />

      <div className="mt-auto space-y-3">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setPalette(true);
          }}
          className="flex w-full items-center gap-3 rounded-md border border-white/10 px-3 py-2 text-sm text-brand-200 hover:bg-white/5 hover:text-white"
        >
          <Icon name="search" className="h-4 w-4" />
          <span className="flex-1 text-left">Quick search</span>
          <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">Ctrl K</span>
        </button>
        <div className="flex items-center gap-3 rounded-lg bg-white/5 p-2.5">
          <Link to="/profile" onClick={() => setOpen(false)} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-90">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white">
              {initials(user.name)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-white">{user.name}</span>
              <span className="block truncate text-xs text-brand-300">{ROLE_LABELS[user.role]}</span>
            </span>
          </Link>
          <button type="button" onClick={logout} className="rounded-md p-1.5 text-brand-300 hover:bg-white/10 hover:text-white" title="Sign out" aria-label="Sign out">
            <Icon name="logout" className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="sticky top-0 h-screen">{sidebar}</div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fade-in absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 shadow-xl">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur sm:px-6 lg:hidden">
          <button className="btn-ghost px-2" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Icon name="menu" />
          </button>
          <span className="font-semibold text-slate-900">NAWI Test Records</span>
          <button className="btn-ghost ml-auto px-2" onClick={() => setPalette(true)} aria-label="Quick search">
            <Icon name="search" />
          </button>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </main>
        <footer className="no-print border-t border-slate-200 px-6 py-3 text-xs text-slate-400">
          {[user.lab, 'OIML R 76-1 (2006)'].filter(Boolean).join(' · ')} · Signed in as <span className="num">{user.username}</span>
        </footer>
      </div>

      <CommandPalette open={palette} onClose={() => setPalette(false)} pages={PALETTE_PAGES} />
    </div>
  );
}
