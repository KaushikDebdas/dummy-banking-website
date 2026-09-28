/**
 * Reusable, automation-friendly data table.
 *
 * Selector contract (id = the `id` prop, e.g. "customers"):
 *   container      [data-testid="<id>-table-container"]
 *   table          [data-testid="<id>-table"]
 *   search         [data-testid="<id>-search"]
 *   filter         [data-testid="<id>-filter-<key>"]            (native <select>)
 *   date range     [data-testid="<id>-filter-date-from|to"]
 *   clear          [data-testid="<id>-clear-filters-btn"]
 *   sort header    [data-testid="<id>-sort-<columnKey>"]        (aria-sort on the <th>)
 *   row            [data-testid="<rowTestIdPrefix>-<rowId>"][data-row-id="<rowId>"]
 *   cell           row >> [data-testid="cell-<columnKey>"]      (data-value = raw value)
 *   empty state    [data-testid="<id>-empty"]
 *   record count   [data-testid="<id>-total-count"]             (data-count = number)
 *   pagination     <id>-first-page | -prev-page | -next-page | -last-page | -page-size | -page-info | -current-page
 *   export         [data-testid="<id>-export-csv-btn"]
 * Optional features:
 *   row selection  [data-testid="<id>-select-all"], row >> [data-testid="select-row-<rowId>"],
 *                  [data-testid="<id>-selection-bar"], [data-testid="<id>-selected-count"], [data-testid="<id>-clear-selection"]
 *   expandable     row >> [data-testid="expand-btn-<rowId>"], details row [data-testid="<rowTestIdPrefix>-<rowId>-details"]
 *   inline edit    double-click an editable cell -> [data-testid="inline-edit-<columnKey>"] (Enter saves, Escape cancels),
 *                  error [data-testid="inline-edit-error"]
 *   context menu   right-click a row -> [data-testid="context-menu"], items [data-testid="context-menu-item-<key>"]
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { downloadCSV, toCSV } from '../../lib/csv';
import { cx } from '../ui';

export interface Column<T> {
  key: string;
  header: string;
  /** Raw value used for sort, search, CSV and data-value. Defaults to row[key]. */
  value?: (row: T) => string | number | undefined | null;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  searchable?: boolean;
  align?: 'left' | 'right' | 'center';
  className?: string;
  /** Double-click to edit. `onSave` returns an error message, or null when saved. */
  editable?: {
    canEdit?: (row: T) => boolean;
    inputType?: 'text' | 'email' | 'number';
    onSave: (row: T, value: string) => Promise<string | null> | string | null;
  };
}

export interface FilterDef<T> {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  predicate?: (row: T, value: string) => boolean;
}

export interface ContextMenuItem {
  key: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface DataTableProps<T> {
  id: string;
  columns: Column<T>[];
  rows: T[];
  rowId: (row: T) => string;
  rowTestIdPrefix: string;
  searchPlaceholder?: string;
  filters?: FilterDef<T>[];
  dateFilter?: { label: string; value: (row: T) => string };
  actions?: (row: T) => ReactNode;
  pageSizeOptions?: number[];
  defaultPageSize?: number;
  emptyMessage?: string;
  toolbar?: ReactNode;
  exportFileName?: string;
  initialSearch?: string;
  initialFilters?: Record<string, string>;
  rowClassName?: (row: T) => string | undefined;
  hideSearch?: boolean;
  compact?: boolean;
  /** Shows row checkboxes; `bulkActions` renders buttons for the selected rows. */
  selectable?: boolean;
  bulkActions?: (selected: T[], clearSelection: () => void) => ReactNode;
  renderExpanded?: (row: T) => ReactNode;
  onRowDoubleClick?: (row: T) => void;
  contextMenu?: (row: T) => ContextMenuItem[];
}

type SortState = { key: string; dir: 'asc' | 'desc' } | null;

function rawValue<T>(col: Column<T>, row: T): string | number | undefined | null {
  if (col.value) return col.value(row);
  const v = (row as Record<string, unknown>)[col.key];
  return typeof v === 'number' || typeof v === 'string' ? v : v === undefined || v === null ? v : String(v);
}

export function DataTable<T>({
  id,
  columns,
  rows,
  rowId,
  rowTestIdPrefix,
  searchPlaceholder = 'Search...',
  filters = [],
  dateFilter,
  actions,
  pageSizeOptions = [5, 10, 25, 50, 100],
  defaultPageSize = 10,
  emptyMessage = 'No records found.',
  toolbar,
  exportFileName,
  initialSearch = '',
  initialFilters = {},
  rowClassName,
  hideSearch,
  compact,
  selectable,
  bulkActions,
  renderExpanded,
  onRowDoubleClick,
  contextMenu,
}: DataTableProps<T>) {
  const [search, setSearch] = useState(initialSearch);
  const [filterValues, setFilterValues] = useState<Record<string, string>>(initialFilters);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState<SortState>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [editing, setEditing] = useState<{ rowId: string; col: string; value: string; error: string } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; items: ContextMenuItem[]; rowId: string } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const searchCols = columns.filter((c) => c.searchable !== false);
    let out = rows.filter((row) => {
      if (q && !searchCols.some((c) => String(rawValue(c, row) ?? '').toLowerCase().includes(q))) return false;
      for (const f of filters) {
        const v = filterValues[f.key];
        if (!v) continue;
        if (f.predicate ? !f.predicate(row, v) : String((row as Record<string, unknown>)[f.key]) !== v) return false;
      }
      if (dateFilter) {
        const d = dateFilter.value(row).slice(0, 10);
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
      }
      return true;
    });
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col) {
        out = [...out].sort((a, b) => {
          const va = rawValue(col, a);
          const vb = rawValue(col, b);
          let cmp: number;
          if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
          else cmp = String(va ?? '').localeCompare(String(vb ?? ''), 'en', { numeric: true });
          return sort.dir === 'asc' ? cmp : -cmp;
        });
      }
    }
    return out;
  }, [rows, columns, search, filters, filterValues, dateFilter, dateFrom, dateTo, sort]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);
  const pageIds = pageRows.map(rowId);
  const allRowIds = useMemo(() => new Set(rows.map(rowId)), [rows, rowId]);
  const selectedIds = selected.filter((s) => allRowIds.has(s));
  const selectedRows = rows.filter((r) => selectedIds.includes(rowId(r)));
  const allOnPage = pageIds.length > 0 && pageIds.every((r) => selectedIds.includes(r));
  const someOnPage = pageIds.some((r) => selectedIds.includes(r));

  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someOnPage && !allOnPage;
  }, [someOnPage, allOnPage]);

  // close the context menu on outside click, Escape, scroll or resize
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onDown = (e: MouseEvent) => !(e.target as HTMLElement).closest('[data-testid="context-menu"]') && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [menu]);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (menu) menuRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
  }, [menu]);

  const toggleSort = (key: string) => {
    setSort((s) => (!s || s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null));
    setPage(1);
  };

  const hasActiveFilters = !!search || Object.values(filterValues).some(Boolean) || !!dateFrom || !!dateTo;
  const clearFilters = () => {
    setSearch('');
    setFilterValues({});
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const exportCsv = () => {
    const cols = columns.filter((c) => c.key !== 'actions');
    downloadCSV(
      exportFileName ?? `${id}.csv`,
      toCSV(
        cols.map((c) => c.header),
        filtered.map((r) => cols.map((c) => rawValue(c, r))),
      ),
    );
  };

  const toggleRow = (rid: string) => setSelected((s) => (s.includes(rid) ? s.filter((x) => x !== rid) : [...s, rid]));
  const togglePage = () => setSelected((s) => (allOnPage ? s.filter((x) => !pageIds.includes(x)) : Array.from(new Set([...s, ...pageIds]))));
  const toggleExpanded = (rid: string) => setExpanded((e) => (e.includes(rid) ? e.filter((x) => x !== rid) : [...e, rid]));

  const saveEdit = async (row: T, col: Column<T>) => {
    if (!editing || !col.editable) return;
    const err = await col.editable.onSave(row, editing.value);
    if (err) setEditing((e) => (e ? { ...e, error: err } : e));
    else setEditing(null);
  };

  const alignClass = (a?: string) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left');
  const cellPad = compact ? 'px-3 py-1.5' : 'px-3 py-2.5';
  const colCount = columns.length + (actions ? 1 : 0) + (selectable ? 1 : 0) + (renderExpanded ? 1 : 0);

  return (
    <div data-testid={`${id}-table-container`} className="flex flex-col gap-3">
      {(!hideSearch || filters.length > 0 || dateFilter || toolbar || exportFileName) && (
        <div className="flex flex-wrap items-end gap-2">
          {!hideSearch && (
            <div className="flex min-w-[14rem] flex-1 flex-col gap-1">
              <label htmlFor={`${id}-search`} className="text-xs font-medium text-slate-600">
                Search
              </label>
              <input
                id={`${id}-search`}
                data-testid={`${id}-search`}
                type="search"
                value={search}
                placeholder={searchPlaceholder}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-200"
              />
            </div>
          )}
          {filters.map((f) => (
            <div key={f.key} className="flex flex-col gap-1">
              <label htmlFor={`${id}-filter-${f.key}`} className="text-xs font-medium text-slate-600">
                {f.label}
              </label>
              <select
                id={`${id}-filter-${f.key}`}
                data-testid={`${id}-filter-${f.key}`}
                value={filterValues[f.key] ?? ''}
                onChange={(e) => {
                  setFilterValues((v) => ({ ...v, [f.key]: e.target.value }));
                  setPage(1);
                }}
                className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm focus:border-teal-600 focus:outline-none"
              >
                <option value="">All</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {dateFilter && (
            <>
              <div className="flex flex-col gap-1">
                <label htmlFor={`${id}-filter-date-from`} className="text-xs font-medium text-slate-600">
                  {dateFilter.label} From
                </label>
                <input
                  id={`${id}-filter-date-from`}
                  data-testid={`${id}-filter-date-from`}
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={`${id}-filter-date-to`} className="text-xs font-medium text-slate-600">
                  {dateFilter.label} To
                </label>
                <input
                  id={`${id}-filter-date-to`}
                  data-testid={`${id}-filter-date-to`}
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
            </>
          )}
          {hasActiveFilters && (
            <button type="button" data-testid={`${id}-clear-filters-btn`} onClick={clearFilters} className="rounded-md px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50">
              Clear
            </button>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            {exportFileName && (
              <button
                type="button"
                data-testid={`${id}-export-csv-btn`}
                onClick={exportCsv}
                disabled={total === 0}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Export CSV
              </button>
            )}
            {toolbar}
          </div>
        </div>
      )}

      {selectable && selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm" data-testid={`${id}-selection-bar`}>
          <span className="font-medium text-teal-900" data-testid={`${id}-selected-count`} data-count={selectedIds.length}>
            {selectedIds.length} selected
          </span>
          <div className="flex flex-wrap gap-2">{bulkActions?.(selectedRows, () => setSelected([]))}</div>
          <button type="button" data-testid={`${id}-clear-selection`} onClick={() => setSelected([])} className="ml-auto text-xs font-medium text-teal-800 hover:underline">
            Clear selection
          </button>
        </div>
      )}

      <div className="text-xs text-slate-500" data-testid={`${id}-total-count`} data-count={total}>
        {total} record{total === 1 ? '' : 's'} found
        {onRowDoubleClick && <span className="ml-2 text-slate-400">· double-click a row to open it</span>}
        {contextMenu && <span className="ml-2 text-slate-400">· right-click for more actions</span>}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm" data-testid={`${id}-table`}>
          <thead className="bg-slate-50">
            <tr>
              {selectable && (
                <th scope="col" className={cx(cellPad, 'w-8')} data-col="select">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    data-testid={`${id}-select-all`}
                    aria-label="Select all rows on this page"
                    checked={allOnPage}
                    onChange={togglePage}
                    className="h-4 w-4 accent-teal-700"
                  />
                </th>
              )}
              {renderExpanded && <th scope="col" className={cx(cellPad, 'w-8')} data-col="expand" aria-label="Expand" />}
              {columns.map((c) => {
                const sortable = c.sortable !== false;
                const ariaSort = sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
                return (
                  <th
                    key={c.key}
                    scope="col"
                    data-col={c.key}
                    data-testid={`${id}-header-${c.key}`}
                    aria-sort={sortable ? ariaSort : undefined}
                    className={cx(cellPad, 'whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-600', alignClass(c.align))}
                  >
                    {sortable ? (
                      <button type="button" data-testid={`${id}-sort-${c.key}`} onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 uppercase hover:text-teal-700">
                        {c.header}
                        <span aria-hidden="true" className="text-[10px]">
                          {sort?.key === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </button>
                    ) : (
                      c.header
                    )}
                    {c.editable && <span className="ml-1 text-[10px] normal-case text-slate-400" title="Double-click a cell to edit">✎</span>}
                  </th>
                );
              })}
              {actions && (
                <th scope="col" data-col="actions" className={cx(cellPad, 'text-right text-xs font-semibold uppercase tracking-wide text-slate-600')}>
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-3 py-8 text-center text-sm text-slate-500" data-testid={`${id}-empty`}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageRows.flatMap((row, i) => {
                const rid = rowId(row);
                const isSelected = selectedIds.includes(rid);
                const isExpanded = expanded.includes(rid);
                const out = [
                  <tr
                    key={rid}
                    data-testid={`${rowTestIdPrefix}-${rid}`}
                    data-row-id={rid}
                    data-row-index={start + i}
                    data-selected={selectable ? isSelected : undefined}
                    aria-selected={selectable ? isSelected : undefined}
                    className={cx('hover:bg-slate-50', isSelected && 'bg-teal-50/60', onRowDoubleClick && 'cursor-pointer select-none', rowClassName?.(row))}
                    onDoubleClick={(e) => {
                      if ((e.target as HTMLElement).closest('button,a,input,select,[data-editable]')) return;
                      onRowDoubleClick?.(row);
                    }}
                    onContextMenu={
                      contextMenu
                        ? (e) => {
                            e.preventDefault();
                            const items = contextMenu(row);
                            setMenu({ x: Math.min(e.clientX, window.innerWidth - 220), y: Math.min(e.clientY, window.innerHeight - items.length * 36 - 16), items, rowId: rid });
                          }
                        : undefined
                    }
                  >
                    {selectable && (
                      <td className={cellPad} data-col="select">
                        <input type="checkbox" data-testid={`select-row-${rid}`} aria-label={`Select ${rid}`} checked={isSelected} onChange={() => toggleRow(rid)} className="h-4 w-4 accent-teal-700" />
                      </td>
                    )}
                    {renderExpanded && (
                      <td className={cellPad} data-col="expand">
                        <button
                          type="button"
                          data-testid={`expand-btn-${rid}`}
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? `Collapse ${rid}` : `Expand ${rid}`}
                          onClick={() => toggleExpanded(rid)}
                          className="flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-200"
                        >
                          <span className={cx('text-xs transition-transform', isExpanded && 'rotate-90')}>▶</span>
                        </button>
                      </td>
                    )}
                    {columns.map((c) => {
                      const raw = rawValue(c, row);
                      const canEdit = c.editable && (c.editable.canEdit?.(row) ?? true);
                      const isEditing = editing?.rowId === rid && editing.col === c.key;
                      return (
                        <td
                          key={c.key}
                          data-testid={`cell-${c.key}`}
                          data-col={c.key}
                          data-value={raw ?? ''}
                          data-editable={canEdit ? 'true' : undefined}
                          title={canEdit && !isEditing ? 'Double-click to edit' : undefined}
                          onDoubleClick={canEdit ? () => setEditing({ rowId: rid, col: c.key, value: String(raw ?? ''), error: '' }) : undefined}
                          className={cx(cellPad, 'whitespace-nowrap text-slate-800', alignClass(c.align), canEdit && 'cursor-text decoration-dotted hover:underline', c.className)}
                        >
                          {isEditing ? (
                            <div className="flex flex-col gap-1">
                              <input
                                autoFocus
                                data-testid={`inline-edit-${c.key}`}
                                aria-label={`Edit ${c.header}`}
                                type={c.editable?.inputType ?? 'text'}
                                value={editing.value}
                                onChange={(e) => setEditing({ ...editing, value: e.target.value, error: '' })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    saveEdit(row, c);
                                  } else if (e.key === 'Escape') setEditing(null);
                                }}
                                className={cx('w-56 rounded border px-2 py-1 text-sm focus:outline-none focus:ring-2', editing.error ? 'border-rose-500 focus:ring-rose-200' : 'border-teal-500 focus:ring-teal-200')}
                              />
                              <div className="flex gap-2 text-xs">
                                <button type="button" data-testid="inline-edit-save" onClick={() => saveEdit(row, c)} className="font-medium text-teal-700 hover:underline">
                                  Save
                                </button>
                                <button type="button" data-testid="inline-edit-cancel" onClick={() => setEditing(null)} className="text-slate-500 hover:underline">
                                  Cancel
                                </button>
                              </div>
                              {editing.error && (
                                <span className="whitespace-normal text-xs font-medium text-rose-600" data-testid="inline-edit-error" role="alert">
                                  {editing.error}
                                </span>
                              )}
                            </div>
                          ) : c.render ? (
                            c.render(row)
                          ) : (
                            (raw ?? '-')
                          )}
                        </td>
                      );
                    })}
                    {actions && (
                      <td data-testid="cell-actions" data-col="actions" className={cx(cellPad, 'whitespace-nowrap text-right')}>
                        <div className="inline-flex justify-end gap-1.5">{actions(row)}</div>
                      </td>
                    )}
                  </tr>,
                ];
                if (renderExpanded && isExpanded)
                  out.push(
                    <tr key={`${rid}-details`} data-testid={`${rowTestIdPrefix}-${rid}-details`} className="bg-slate-50/70">
                      <td colSpan={colCount} className="px-6 py-3">
                        {renderExpanded(row)}
                      </td>
                    </tr>,
                  );
                return out;
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <label htmlFor={`${id}-page-size`} className="text-xs">
            Rows per page
          </label>
          <select
            id={`${id}-page-size`}
            data-testid={`${id}-page-size`}
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span data-testid={`${id}-page-info`}>{total === 0 ? 'Showing 0 of 0' : `Showing ${start + 1}-${Math.min(start + pageSize, total)} of ${total}`}</span>
        </div>
        <div className="flex items-center gap-1">
          <PagerButton testId={`${id}-first-page`} disabled={currentPage === 1} onClick={() => setPage(1)} label="First page">
            «
          </PagerButton>
          <PagerButton testId={`${id}-prev-page`} disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} label="Previous page">
            ‹ Prev
          </PagerButton>
          <span className="px-2 text-xs" data-testid={`${id}-current-page`} data-page={currentPage} data-total-pages={totalPages}>
            Page {currentPage} of {totalPages}
          </span>
          <PagerButton testId={`${id}-next-page`} disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)} label="Next page">
            Next ›
          </PagerButton>
          <PagerButton testId={`${id}-last-page`} disabled={currentPage >= totalPages} onClick={() => setPage(totalPages)} label="Last page">
            »
          </PagerButton>
        </div>
      </div>

      {menu && (
        <div
          ref={menuRef}
          role="menu"
          data-testid="context-menu"
          data-row-id={menu.rowId}
          style={{ left: menu.x, top: menu.y }}
          className="fixed z-50 w-52 rounded-md border border-slate-200 bg-white py-1 text-sm shadow-xl"
          onKeyDown={(e) => {
            const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []);
            const idx = items.indexOf(document.activeElement as HTMLButtonElement);
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              items[(idx + 1) % items.length]?.focus();
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              items[(idx - 1 + items.length) % items.length]?.focus();
            }
          }}
        >
          <div className="border-b border-slate-100 px-3 pb-1 text-[11px] font-semibold text-slate-500">{menu.rowId}</div>
          {menu.items.map((it) => (
            <button
              key={it.key}
              type="button"
              role="menuitem"
              data-testid={`context-menu-item-${it.key}`}
              disabled={it.disabled}
              onClick={() => {
                setMenu(null);
                it.onClick();
              }}
              className={cx('block w-full px-3 py-2 text-left hover:bg-slate-100 focus:bg-slate-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40', it.danger ? 'text-rose-700' : 'text-slate-800')}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PagerButton({ testId, disabled, onClick, label, children }: { testId: string; disabled: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
