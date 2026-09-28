/** App-shell widgets: session timeout, command palette, shortcuts, breadcrumbs, notifications, user menu. */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, useCurrentUser } from '../auth/AuthContext';
import { getTimeoutMinutes, markExpired, remainingMs, touchActivity } from '../auth/session';
import { Button, cx } from '../components/ui';
import { Popover } from '../components/ui/advanced';
import { Modal } from '../components/ui/Modal';
import { ROLE_LABELS, branchName } from '../data/reference';
import { today } from '../lib/dates';
import { installmentStatus } from '../lib/loanCalc';
import { useStore } from '../store/StoreContext';
import { visibleCustomers, visibleDeposits, visibleLoans, visibleTransactions } from '../store/selectors';
import type { NavItem } from './AppLayout';

// ================================================================== session timeout
const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Tracks activity (clicks and key presses) and logs the user out after the
 * configured idle time (Profile → Session Timeout). A warning modal with a live
 * countdown appears before expiry; on expiry a native alert() is shown.
 */
export function SessionManager() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [left, setLeft] = useState(remainingMs());
  const expired = useRef(false);
  const warnMs = Math.min(60_000, (getTimeoutMinutes() * 60_000) / 2);

  useEffect(() => {
    let last = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - last < 1000) return;
      last = now;
      if (remainingMs() > warnMs) touchActivity(); // while warning, only "Stay signed in" extends
    };
    window.addEventListener('click', onActivity, true);
    window.addEventListener('keydown', onActivity, true);
    const timer = window.setInterval(() => setLeft(remainingMs()), 1000);
    return () => {
      window.removeEventListener('click', onActivity, true);
      window.removeEventListener('keydown', onActivity, true);
      window.clearInterval(timer);
    };
  }, [warnMs]);

  useEffect(() => {
    if (left > 0 || expired.current) return;
    expired.current = true;
    window.alert('Your session has expired due to inactivity. Please log in again.');
    // The route guard redirects to /login?expired=1 once the user is cleared.
    markExpired();
    logout();
  }, [left, logout]);

  const stay = () => {
    touchActivity();
    setLeft(remainingMs());
  };

  return (
    <>
      <span
        className={cx('hidden rounded-md px-2 py-1 font-mono text-xs sm:inline', left <= warnMs ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600')}
        data-testid="session-timer"
        data-remaining-seconds={Math.max(0, Math.ceil(left / 1000))}
        title="Time left before automatic logout"
      >
        ⏱ {fmt(left)}
      </span>
      <Modal
        open={left > 0 && left <= warnMs}
        title="Session About to Expire"
        testId="session-warning-modal"
        onClose={stay}
        footer={
          <>
            <Button
              variant="secondary"
              testId="session-logout-btn"
              onClick={() => {
                expired.current = true;
                logout();
                navigate('/login');
              }}
            >
              Log Out Now
            </Button>
            <Button testId="session-stay-btn" onClick={stay}>
              Stay Signed In
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-700">
          You have been inactive for a while. You will be logged out in{' '}
          <strong data-testid="session-countdown" data-seconds={Math.max(0, Math.ceil(left / 1000))}>
            {Math.max(0, Math.ceil(left / 1000))}
          </strong>{' '}
          seconds.
        </p>
      </Modal>
    </>
  );
}

// ================================================================== command palette
interface Command {
  key: string;
  label: string;
  hint: string;
  to: string;
}

/** Ctrl+K quick search. Input `command-palette-input`, options `command-option-<key>`; ↑ ↓ Enter Esc. */
export function CommandPalette({ open, onClose, pages }: { open: boolean; onClose: () => void; pages: NavItem[] }) {
  const user = useCurrentUser();
  const { state } = useStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  const results = useMemo<Command[]>(() => {
    const q = query.trim().toLowerCase();
    const pageCmds = pages.filter((p) => !q || p.label.toLowerCase().includes(q)).map((p) => ({ key: `page-${p.testId.replace('nav-', '')}`, label: p.label, hint: 'Page', to: p.to }));
    if (q.length < 2) return pageCmds.slice(0, 8);
    const customers = visibleCustomers(state, user)
      .filter((c) => c.customerId.toLowerCase().includes(q) || c.fullName.toLowerCase().includes(q) || c.mobile.includes(q))
      .slice(0, 5)
      .map((c) => ({ key: `customer-${c.customerId}`, label: `${c.customerId} — ${c.fullName}`, hint: 'Customer', to: `/customers/${c.customerId}` }));
    const deposits = visibleDeposits(state, user)
      .filter((d) => d.accountNo.toLowerCase().includes(q))
      .slice(0, 5)
      .map((d) => ({ key: `deposit-${d.accountNo}`, label: `${d.accountNo} — ${d.customerName}`, hint: 'Deposit account', to: `/deposits/${d.accountNo}` }));
    const loans = visibleLoans(state, user)
      .filter((l) => l.loanAccountNo.toLowerCase().includes(q))
      .slice(0, 5)
      .map((l) => ({ key: `loan-${l.loanAccountNo}`, label: `${l.loanAccountNo} — ${l.customerName}`, hint: 'Loan account', to: `/loans/${l.loanAccountNo}` }));
    return [...pageCmds, ...customers, ...deposits, ...loans];
  }, [query, pages, state, user]);

  const go = (c: Command) => {
    onClose();
    navigate(c.to);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      go(results[active]);
    }
  };

  return (
    <Modal open={open} title="Quick Search" testId="command-palette" onClose={onClose} size="lg">
      <input
        autoFocus
        data-testid="command-palette-input"
        role="combobox"
        aria-expanded="true"
        aria-controls="command-palette-results"
        aria-activedescendant={results[active] ? `cmd-${active}` : undefined}
        placeholder="Search pages, customers, account or loan numbers..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-200"
      />
      <ul id="command-palette-results" role="listbox" data-testid="command-palette-results" className="mt-3 max-h-80 overflow-y-auto">
        {results.length === 0 && (
          <li className="px-3 py-4 text-center text-sm text-slate-500" data-testid="command-palette-empty">
            No results for "{query}"
          </li>
        )}
        {results.map((r, i) => (
          <li
            key={r.key}
            id={`cmd-${i}`}
            role="option"
            aria-selected={i === active}
            data-testid={`command-option-${r.key}`}
            onMouseEnter={() => setActive(i)}
            onClick={() => go(r)}
            className={cx('flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm', i === active ? 'bg-teal-50 text-teal-900' : 'text-slate-800')}
          >
            <span>{r.label}</span>
            <span className="text-xs text-slate-500">{r.hint}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-500">↑ ↓ to move · Enter to open · Esc to close</p>
    </Modal>
  );
}

// ================================================================== keyboard shortcuts help
export const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Ctrl + K', action: 'Open quick search (command palette)' },
  { keys: '?', action: 'Show this list of shortcuts' },
  { keys: '[', action: 'Collapse / expand the sidebar' },
  { keys: 'g then d', action: 'Go to Dashboard' },
  { keys: 'g then c', action: 'Go to Customer Management' },
  { keys: 'g then a', action: 'Go to Deposit Accounts' },
  { keys: 'g then l', action: 'Go to Loan Accounts' },
  { keys: 'g then p', action: 'Go to Loan Pipeline' },
  { keys: 'g then s', action: 'Go to Account Statements' },
  { keys: 'g then t', action: 'Go to Transactions' },
  { keys: 'g then e', action: 'Go to EMI Calculator' },
  { keys: 'Esc', action: 'Close dialogs, menus and dropdowns' },
];

export function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} title="Keyboard Shortcuts" testId="shortcuts-modal" onClose={onClose}>
      <table className="w-full text-sm" data-testid="shortcuts-table">
        <tbody className="divide-y divide-slate-100">
          {SHORTCUTS.map((s) => (
            <tr key={s.keys}>
              <td className="py-1.5 pr-4">
                <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-xs">{s.keys}</kbd>
              </td>
              <td className="py-1.5 text-slate-700">{s.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-slate-500">Shortcuts are ignored while you are typing in a field (except Ctrl + K).</p>
    </Modal>
  );
}

// ================================================================== breadcrumbs
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  customers: 'Customers',
  deposits: 'Deposit Accounts',
  loans: 'Loan Accounts',
  schedules: 'Repayment Schedules',
  schedule: 'Repayment Schedule',
  pipeline: 'Pipeline Board',
  statements: 'Account Statements',
  transactions: 'Transactions',
  approvals: 'Approvals',
  reports: 'Reports',
  audit: 'Audit Logs',
  admin: 'Administration',
  users: 'User Management',
  profile: 'User Profile',
  tools: 'Tools',
  'emi-calculator': 'EMI Calculator',
  new: 'New',
  edit: 'Edit',
};
const NOT_A_PAGE = new Set(['/admin', '/tools']);

/** Home › Customers › CUS-DHK-000002 › Edit. Items `breadcrumb-<index>`; the last has aria-current="page". */
export function Breadcrumbs() {
  const { pathname } = useLocation();
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0 || (parts.length === 1 && parts[0] === 'dashboard')) return null;
  const crumbs = [{ label: 'Home', to: '/dashboard' }, ...parts.map((p, i) => ({ label: SEGMENT_LABELS[p] ?? decodeURIComponent(p), to: '/' + parts.slice(0, i + 1).join('/') }))];
  return (
    <nav aria-label="Breadcrumb" data-testid="breadcrumbs" className="mb-4 text-sm">
      <ol className="flex flex-wrap items-center gap-1 text-slate-500">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={c.to} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden="true">›</span>}
              {last || NOT_A_PAGE.has(c.to) ? (
                <span data-testid={`breadcrumb-${i}`} aria-current={last ? 'page' : undefined} className={cx(last && 'font-medium text-slate-800')}>
                  {c.label}
                </span>
              ) : (
                <Link to={c.to} data-testid={`breadcrumb-${i}`} className="text-teal-700 hover:underline">
                  {c.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ================================================================== notifications popover
export function NotificationsPopover() {
  const user = useCurrentUser();
  const { can } = useAuth();
  const { state } = useStore();
  const customers = visibleCustomers(state, user);
  const deposits = visibleDeposits(state, user);
  const loans = visibleLoans(state, user);
  const txns = visibleTransactions(state, user);

  const items: { key: string; text: string; to: string; show: boolean }[] = [
    { key: 'kyc', text: `${customers.filter((c) => c.kycStatus === 'Pending').length} customer(s) waiting for KYC verification`, to: '/approvals', show: can('kyc.verify') && customers.some((c) => c.kycStatus === 'Pending') },
    { key: 'deposits', text: `${deposits.filter((d) => d.status === 'Pending Approval').length} deposit account(s) pending approval`, to: '/approvals', show: can('deposit.approve') && deposits.some((d) => d.status === 'Pending Approval') },
    { key: 'loans', text: `${loans.filter((l) => l.status === 'Applied').length} loan application(s) waiting for approval`, to: '/approvals', show: can('loan.approve') && loans.some((l) => l.status === 'Applied') },
    { key: 'withdrawals', text: `${txns.filter((t) => t.status === 'Pending Approval').length} large withdrawal(s) pending approval`, to: '/approvals', show: can('txn.approve') && txns.some((t) => t.status === 'Pending Approval') },
    {
      key: 'overdue',
      text: `${loans.filter((l) => l.status === 'Active' && l.schedule.some((i) => installmentStatus(i) === 'Overdue')).length} active loan(s) have overdue installments`,
      to: can('report.view') ? '/reports' : '/loans',
      show: loans.some((l) => l.status === 'Active' && l.schedule.some((i) => installmentStatus(i) === 'Overdue')),
    },
    {
      key: 'matured',
      text: `${deposits.filter((d) => d.status === 'Active' && d.maturityDate && d.maturityDate <= today()).length} term deposit(s) matured and awaiting processing`,
      to: can('report.view') ? '/reports' : '/deposits',
      show: deposits.some((d) => d.status === 'Active' && d.maturityDate && d.maturityDate <= today()),
    },
  ];
  const visible = items.filter((i) => i.show);

  return (
    <Popover
      id="notifications"
      label="Notifications"
      triggerClassName="relative rounded-md p-2 text-slate-600 hover:bg-slate-100"
      trigger={
        <>
          <span aria-hidden="true">🔔</span>
          {visible.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white" data-testid="notifications-count" data-count={visible.length}>
              {visible.length}
            </span>
          )}
        </>
      }
    >
      {(close) => (
        <div>
          <div className="border-b border-slate-100 px-4 py-2 text-sm font-semibold text-slate-800">Notifications</div>
          {visible.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500" data-testid="notifications-empty">
              You're all caught up.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {visible.map((n) => (
                <li key={n.key}>
                  <Link to={n.to} onClick={close} data-testid={`notification-item-${n.key}`} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                    {n.text}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Popover>
  );
}

// ================================================================== user menu popover
export function UserMenu({ onShortcuts, onLogout }: { onShortcuts: () => void; onLogout: () => void }) {
  const user = useCurrentUser();
  const initials = user.fullName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <Popover
      id="user-menu"
      label="User menu"
      triggerClassName="flex h-8 w-8 items-center justify-center rounded-full bg-teal-700 text-xs font-bold text-white hover:bg-teal-800"
      trigger={<span data-testid="user-menu-initials">{initials}</span>}
    >
      {(close) => (
        <div className="py-1 text-sm">
          <div className="border-b border-slate-100 px-4 py-2">
            <div className="font-semibold text-slate-900">{user.fullName}</div>
            <div className="text-xs text-slate-500">
              {ROLE_LABELS[user.role]} · {branchName(user.branch)}
            </div>
          </div>
          <Link to="/profile" onClick={close} data-testid="user-menu-profile" className="block px-4 py-2 hover:bg-slate-50">
            My Profile
          </Link>
          <Link to="/guide" onClick={close} data-testid="user-menu-guide" className="block px-4 py-2 hover:bg-slate-50">
            User Guide
          </Link>
          <button
            type="button"
            data-testid="user-menu-shortcuts"
            onClick={() => {
              close();
              onShortcuts();
            }}
            className="block w-full px-4 py-2 text-left hover:bg-slate-50"
          >
            Keyboard Shortcuts
          </button>
          <button
            type="button"
            data-testid="user-menu-logout"
            onClick={() => {
              close();
              onLogout();
            }}
            className="block w-full px-4 py-2 text-left text-rose-700 hover:bg-rose-50"
          >
            Logout
          </button>
        </div>
      )}
    </Popover>
  );
}
