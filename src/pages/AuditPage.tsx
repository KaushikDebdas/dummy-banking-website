import { useEffect, useRef, useState } from 'react';
import { useCurrentUser } from '../auth/AuthContext';
import { DataTable } from '../components/table/DataTable';
import { Card, PageHeader, Spinner, cx } from '../components/ui';
import { branchName } from '../data/reference';
import { formatDateTime } from '../lib/dates';
import { useStore } from '../store/StoreContext';
import { visibleAudit } from '../store/selectors';
import type { AuditLog } from '../types';

type Tab = 'table' | 'timeline';

export function AuditPage() {
  const user = useCurrentUser();
  const { state } = useStore();
  const [tab, setTab] = useState<Tab>('table');
  const rows = [...visibleAudit(state, user)].reverse();
  const actions = Array.from(new Set(state.auditLogs.map((a) => a.action))).sort();

  return (
    <div data-testid="audit-page">
      <PageHeader title="Audit Logs" subtitle={`Activity history for ${branchName(user.branch)}. Every change is recorded with the user and time.`} />
      <div className="mb-4 flex gap-1 border-b border-slate-200" role="tablist">
        {(
          [
            ['table', 'Table View'],
            ['timeline', 'Activity Timeline'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            data-testid={`audit-tab-${key}`}
            onClick={() => setTab(key)}
            className={cx('-mb-px border-b-2 px-4 py-2 text-sm font-medium', tab === key ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-700')}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'table' ? (
        <Card>
          <DataTable<AuditLog>
            id="audit"
            rowTestIdPrefix="audit-row"
            rows={rows}
            rowId={(a) => a.id}
            searchPlaceholder="Search by entity ID, user or details"
            filters={[
              { key: 'action', label: 'Action', options: actions.map((a) => ({ value: a, label: a })) },
              { key: 'entityType', label: 'Entity', options: ['Customer', 'Deposit', 'Loan', 'Transaction', 'User', 'Auth', 'System'].map((e) => ({ value: e, label: e })) },
            ]}
            dateFilter={{ label: 'Date', value: (a) => a.timestamp }}
            exportFileName="audit_logs.csv"
            emptyMessage="No audit records found."
            columns={[
              { key: 'id', header: 'Audit ID' },
              { key: 'timestamp', header: 'Timestamp', searchable: false, render: (a) => formatDateTime(a.timestamp) },
              { key: 'username', header: 'User' },
              { key: 'role', header: 'Role', searchable: false },
              { key: 'action', header: 'Action', searchable: false },
              { key: 'entityType', header: 'Entity', searchable: false },
              { key: 'entityId', header: 'Entity ID' },
              { key: 'details', header: 'Details', className: 'whitespace-normal min-w-[14rem]' },
            ]}
          />
        </Card>
      ) : (
        <ActivityTimeline logs={rows} />
      )}
    </div>
  );
}

const PAGE = 20;
const LOAD_DELAY_MS = 700;

/**
 * Infinite scroll: the next 20 entries load (after a short simulated delay) when the
 * sentinel at the bottom scrolls into view. Test ids: activity-item-<id>, activity-loading,
 * activity-sentinel, activity-end, activity-count (data-count = items shown).
 */
function ActivityTimeline({ logs }: { logs: AuditLog[] }) {
  const [shown, setShown] = useState(PAGE);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const hasMore = shown < logs.length;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loading) {
        setLoading(true);
        window.setTimeout(() => {
          setShown((s) => Math.min(s + PAGE, logs.length));
          setLoading(false);
        }, LOAD_DELAY_MS);
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, logs.length]);

  return (
    <Card title="Activity Timeline" testId="activity-timeline">
      <p className="mb-3 text-xs text-slate-500" data-testid="activity-count" data-count={Math.min(shown, logs.length)} data-total={logs.length}>
        Showing {Math.min(shown, logs.length)} of {logs.length} activities · scroll down to load more
      </p>
      <ol className="relative ml-2 border-l border-slate-200" data-testid="activity-list">
        {logs.slice(0, shown).map((a) => (
          <li key={a.id} className="mb-4 ml-4" data-testid={`activity-item-${a.id}`} data-row-id={a.id}>
            <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-teal-600" aria-hidden="true" />
            <div className="text-xs text-slate-500">
              {formatDateTime(a.timestamp)} · {a.id}
            </div>
            <div className="text-sm">
              <span className="font-semibold text-slate-900">{a.username}</span> <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px]">{a.action}</span>{' '}
              <span className="text-slate-700">
                {a.entityType} {a.entityId}
              </span>
            </div>
            <div className="text-sm text-slate-600">{a.details}</div>
          </li>
        ))}
      </ol>
      {hasMore ? (
        <div ref={sentinel} data-testid="activity-sentinel" className="flex h-12 items-center justify-center text-sm text-slate-500">
          {loading && (
            <span className="flex items-center gap-2" data-testid="activity-loading">
              <Spinner className="text-teal-700" /> Loading more activity...
            </span>
          )}
        </div>
      ) : (
        <p className="py-4 text-center text-sm text-slate-500" data-testid="activity-end">
          You have reached the end of the activity log.
        </p>
      )}
    </Card>
  );
}
