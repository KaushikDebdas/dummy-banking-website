import type { ReactNode } from 'react';
import { cx } from '../ui';

export interface SimpleColumn<T> {
  key: string;
  header: string;
  value: (row: T) => string | number | undefined;
  render?: (row: T) => ReactNode;
  align?: 'left' | 'right';
}

/** Small read-only table (dashboard widgets). Same row/cell selector contract as DataTable. */
export function SimpleTable<T>({
  id,
  columns,
  rows,
  rowId,
  rowTestIdPrefix,
  emptyMessage = 'No records found.',
}: {
  id: string;
  columns: SimpleColumn<T>[];
  rows: T[];
  rowId: (row: T) => string;
  rowTestIdPrefix: string;
  emptyMessage?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm" data-testid={`${id}-table`}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} data-col={c.key} className={cx('whitespace-nowrap px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500', c.align === 'right' ? 'text-right' : 'text-left')}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-2 py-6 text-center text-slate-500" data-testid={`${id}-empty`}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((r) => {
              const rid = rowId(r);
              return (
                <tr key={rid} data-testid={`${rowTestIdPrefix}-${rid}`} data-row-id={rid}>
                  {columns.map((c) => (
                    <td key={c.key} data-testid={`cell-${c.key}`} data-col={c.key} data-value={c.value(r) ?? ''} className={cx('whitespace-nowrap px-2 py-2', c.align === 'right' ? 'text-right' : 'text-left')}>
                      {c.render ? c.render(r) : (c.value(r) ?? '-')}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
