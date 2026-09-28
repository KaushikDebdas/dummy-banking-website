import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth, useCurrentUser } from '../auth/AuthContext';
import type { Permission } from '../auth/permissions';
import { LogoMark } from '../components/Logo';
import { cx } from '../components/ui';
import { Tooltip } from '../components/ui/advanced';
import { useFeedback } from '../components/ui/feedback';
import { ROLE_LABELS, branchName } from '../data/reference';
import { useStore } from '../store/StoreContext';
import * as svc from '../store/services';
import { Breadcrumbs, CommandPalette, NotificationsPopover, SessionManager, ShortcutsModal, UserMenu } from './shell';

export interface NavItem {
  to: string;
  label: string;
  testId: string;
  icon: string;
  perm?: Permission[];
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', testId: 'nav-dashboard', icon: '▦' },
  { to: '/customers', label: 'Customer Management', testId: 'nav-customers', icon: '👤', perm: ['customer.view'] },
  { to: '/deposits', label: 'Deposit Accounts', testId: 'nav-deposits', icon: '🏦', perm: ['deposit.view'] },
  { to: '/loans', label: 'Loan Accounts', testId: 'nav-loans', icon: '💳', perm: ['loan.view'], end: true },
  { to: '/loans/pipeline', label: 'Loan Pipeline', testId: 'nav-pipeline', icon: '⇶', perm: ['loan.view'] },
  { to: '/schedules', label: 'Repayment Schedules', testId: 'nav-schedules', icon: '📅', perm: ['schedule.view'] },
  { to: '/statements', label: 'Account Statements', testId: 'nav-statements', icon: '📄', perm: ['statement.view'] },
  { to: '/transactions', label: 'Transactions', testId: 'nav-transactions', icon: '⇄', perm: ['txn.view'] },
  { to: '/approvals', label: 'Approvals', testId: 'nav-approvals', icon: '✔', perm: ['kyc.verify', 'deposit.approve', 'loan.approve', 'txn.approve'] },
  { to: '/reports', label: 'Reports', testId: 'nav-reports', icon: '📊', perm: ['report.view'] },
  { to: '/audit', label: 'Audit Logs', testId: 'nav-audit', icon: '🕒', perm: ['audit.view'] },
  { to: '/tools/emi-calculator', label: 'EMI Calculator', testId: 'nav-emi-calculator', icon: '🧮' },
  { to: '/admin/users', label: 'User Management', testId: 'nav-users', icon: '⚙', perm: ['user.manage'] },
  { to: '/profile', label: 'User Profile', testId: 'nav-profile', icon: '☺' },
  { to: '/guide', label: 'User Guide', testId: 'nav-guide', icon: '?' },
];

const COLLAPSE_KEY = 'demobank:sidebar-collapsed';
const GOTO: Record<string, string> = { d: '/dashboard', c: '/customers', a: '/deposits', l: '/loans', p: '/loans/pipeline', s: '/statements', t: '/transactions', e: '/tools/emi-calculator' };

function isTyping(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

export function AppLayout() {
  const user = useCurrentUser();
  const { can, logout } = useAuth();
  const { reset, run } = useStore();
  const { confirm, toast, withLoading } = useFeedback();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const pendingG = useRef<number | null>(null);

  const items = NAV_ITEMS.filter((i) => !i.perm || i.perm.some((p) => can(p)));

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !c;
    });

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen(true);
      } else if (e.key === '[') {
        toggleCollapsed();
      } else if (e.key === 'g') {
        window.clearTimeout(pendingG.current ?? undefined);
        pendingG.current = window.setTimeout(() => (pendingG.current = null), 1000);
      } else if (pendingG.current && GOTO[e.key]) {
        window.clearTimeout(pendingG.current);
        pendingG.current = null;
        const to = GOTO[e.key];
        if (items.some((i) => i.to === to)) navigate(to);
        else toast('error', 'You do not have access to that page');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const doLogout = async () => {
    const { confirmed } = await confirm({ title: 'Logout', message: 'Are you sure you want to log out?', confirmLabel: 'Logout' });
    if (!confirmed) return;
    logout();
    navigate('/login');
    toast('info', 'You have been logged out');
  };

  const doReset = async () => {
    const { confirmed } = await confirm({
      title: 'Reset Demo Data',
      message: 'All customers, accounts and transactions you created will be removed and the original demo data restored. Continue?',
      confirmLabel: 'Reset Data',
      variant: 'danger',
    });
    if (!confirmed) return;
    await withLoading(() => {
      reset();
      run((d) => {
        svc.recordReset(d, user);
        return { ok: true, data: undefined, message: '' };
      });
    });
    toast('success', 'Demo data has been reset to the original seed');
    navigate('/dashboard');
  };

  return (
    <div className="flex min-h-screen bg-slate-100">
      {open && <div className="fixed inset-0 z-20 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)} data-testid="sidebar-backdrop" />}
      <aside
        data-testid="sidebar"
        data-collapsed={collapsed}
        className={cx(
          'fixed inset-y-0 left-0 z-30 flex flex-col bg-slate-900 text-slate-200 transition-all lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'w-64 lg:w-16' : 'w-64',
        )}
      >
        <div className={cx('flex items-center gap-2 border-b border-slate-800 py-4', collapsed ? 'px-5 lg:justify-center lg:px-2' : 'px-5')}>
          <LogoMark size={34} />
          <div className={cx(collapsed && 'lg:hidden')}>
            <div className="text-sm font-semibold tracking-tight text-white" data-testid="app-name">
              KD <span className="text-teal-300">Demo Bank</span>
            </div>
            <div className="text-[11px] text-slate-400">Core Banking Simulator</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main navigation" data-testid="sidebar-nav">
          <ul className="flex flex-col gap-0.5">
            {items.map((i) => {
              const link = (
                <NavLink
                  to={i.to}
                  end={i.end}
                  data-testid={i.testId}
                  aria-label={collapsed ? i.label : undefined}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cx(
                      'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm',
                      collapsed && 'lg:justify-center lg:px-0',
                      isActive ? 'bg-teal-700 font-medium text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                    )
                  }
                >
                  <span className="w-5 text-center" aria-hidden="true">
                    {i.icon}
                  </span>
                  <span className={cx(collapsed && 'lg:hidden')}>{i.label}</span>
                </NavLink>
              );
              return (
                <li key={i.to} className="flex">
                  {collapsed ? (
                    <Tooltip content={i.label} testId={`${i.testId}-tooltip`} side="right">
                      {link}
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              );
            })}
            <li>
              <button
                type="button"
                data-testid="nav-logout"
                onClick={doLogout}
                aria-label={collapsed ? 'Logout' : undefined}
                className={cx('flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white', collapsed && 'lg:justify-center lg:px-0')}
              >
                <span className="w-5 text-center" aria-hidden="true">
                  ⎋
                </span>
                <span className={cx(collapsed && 'lg:hidden')}>Logout</span>
              </button>
            </li>
          </ul>
        </nav>
        <div className="hidden border-t border-slate-800 p-2 lg:block">
          <button
            type="button"
            data-testid="sidebar-collapse-btn"
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={toggleCollapsed}
            className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <span aria-hidden="true">{collapsed ? '»' : '«'}</span>
            <span className={cx(collapsed && 'hidden')}>Collapse sidebar</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 sm:gap-3 sm:px-6" data-testid="topbar">
          <button type="button" className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} data-testid="sidebar-toggle" aria-label="Open menu">
            ☰
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-slate-900" data-testid="topbar-username" data-username={user.username}>
              {user.fullName} <span className="font-normal text-slate-500">({user.username})</span>
            </div>
            <div className="flex flex-wrap gap-x-3 text-xs text-slate-500">
              <span data-testid="topbar-role" data-role={user.role}>
                {ROLE_LABELS[user.role]}
              </span>
              <span data-testid="topbar-branch" data-branch={user.branch}>
                {branchName(user.branch)}
              </span>
            </div>
          </div>
          <button
            type="button"
            data-testid="command-palette-btn"
            onClick={() => setPaletteOpen(true)}
            className="hidden items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 md:flex"
          >
            🔍 Search <kbd className="rounded bg-slate-100 px-1 font-mono">Ctrl K</kbd>
          </button>
          <SessionManager />
          <NotificationsPopover />
          <button type="button" onClick={doReset} data-testid="reset-data-btn" className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
            Reset Demo Data
          </button>
          <button type="button" onClick={doLogout} data-testid="logout-btn" className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700">
            Logout
          </button>
          <UserMenu onShortcuts={() => setShortcutsOpen(true)} onLogout={doLogout} />
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6" data-testid="main-content">
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} pages={items} />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
