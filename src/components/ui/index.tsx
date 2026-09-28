import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

// ------------------------------------------------------------------ Button
type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'ghost';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-teal-700 text-white hover:bg-teal-800 focus-visible:ring-teal-600',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus-visible:ring-slate-400',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500',
  warning: 'bg-amber-500 text-white hover:bg-amber-600 focus-visible:ring-amber-400',
  ghost: 'text-teal-700 hover:bg-teal-50 focus-visible:ring-teal-500',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  testId?: string;
}

export function Button({ variant = 'primary', size = 'md', testId, className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      data-testid={testId}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    />
  );
}

// ------------------------------------------------------------------ Form fields
interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  /** Extra content after the label text, e.g. an <InfoTip>. */
  labelExtra?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Label + control + hint + error. The error element's test id is always
 * `<control id>-error`, e.g. `customer-form-nid-error`.
 */
export function Field({ id, label, required, error, hint, labelExtra, children, className }: FieldProps) {
  return (
    <div className={cx('flex flex-col gap-1', className)} data-testid={`${id}-field`}>
      <label htmlFor={id} className="text-sm font-medium text-slate-700" data-testid={`${id}-label`}>
        {label}
        {required && <span className="ml-0.5 text-rose-600" aria-hidden="true">*</span>}
        {labelExtra}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs text-slate-500" data-testid={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="text-xs font-medium text-rose-600" id={`${id}-error`} data-testid={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const controlClass = (invalid?: boolean, readOnly?: boolean) =>
  cx(
    'w-full rounded-md border px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2',
    invalid ? 'border-rose-500 focus:ring-rose-300' : 'border-slate-300 focus:border-teal-600 focus:ring-teal-200',
    readOnly && 'bg-slate-100 text-slate-600',
  );

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}
export const TextInput = forwardRef<HTMLInputElement, InputProps>(({ invalid, className, id, readOnly, ...rest }, ref) => (
  <input
    ref={ref}
    id={id}
    data-testid={id}
    aria-invalid={invalid || undefined}
    aria-describedby={invalid ? `${id}-error` : undefined}
    readOnly={readOnly}
    className={cx(controlClass(invalid, readOnly), className)}
    {...rest}
  />
));
TextInput.displayName = 'TextInput';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  options: { value: string; label: string }[];
  placeholder?: string;
}
export const SelectInput = forwardRef<HTMLSelectElement, SelectProps>(({ invalid, className, id, options, placeholder, ...rest }, ref) => (
  <select
    ref={ref}
    id={id}
    data-testid={id}
    aria-invalid={invalid || undefined}
    className={cx(controlClass(invalid, rest.disabled), 'bg-white', className)}
    {...rest}
  >
    {placeholder !== undefined && <option value="">{placeholder}</option>}
    {options.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
));
SelectInput.displayName = 'SelectInput';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(({ invalid, className, id, ...rest }, ref) => (
  <textarea ref={ref} id={id} data-testid={id} aria-invalid={invalid || undefined} rows={2} className={cx(controlClass(invalid), className)} {...rest} />
));
TextArea.displayName = 'TextArea';

// ------------------------------------------------------------------ Layout pieces
export function PageHeader({ title, subtitle, actions, testId }: { title: string; subtitle?: ReactNode; actions?: ReactNode; testId?: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900" data-testid={testId ?? 'page-title'}>
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500" data-testid="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, actions, testId, className }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; testId?: string; className?: string }) {
  return (
    <section className={cx('rounded-lg border border-slate-200 bg-white shadow-sm', className)} data-testid={testId}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          {title && <h2 className="text-sm font-semibold text-slate-800">{title}</h2>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

/** Read-only label/value grid. Each value gets `data-testid="<prefix>-<key>"`. */
export function DetailGrid({ prefix, items, cols = 3 }: { prefix: string; items: { key: string; label: string; value: ReactNode; raw?: string | number }[]; cols?: 2 | 3 | 4 }) {
  const grid = cols === 2 ? 'sm:grid-cols-2' : cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3';
  return (
    <dl className={cx('grid grid-cols-1 gap-x-6 gap-y-3', grid)}>
      {items.map((it) => (
        <div key={it.key} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{it.label}</dt>
          <dd className="mt-0.5 break-words text-sm text-slate-900" data-testid={`${prefix}-${it.key}`} data-value={it.raw}>
            {it.value ?? '-'}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ------------------------------------------------------------------ Status badge
const BADGE_COLORS: Record<string, string> = {
  Active: 'bg-emerald-100 text-emerald-800',
  Verified: 'bg-emerald-100 text-emerald-800',
  Posted: 'bg-emerald-100 text-emerald-800',
  Paid: 'bg-emerald-100 text-emerald-800',
  Approved: 'bg-sky-100 text-sky-800',
  Applied: 'bg-amber-100 text-amber-800',
  Pending: 'bg-amber-100 text-amber-800',
  'Pending Approval': 'bg-amber-100 text-amber-800',
  Overdue: 'bg-rose-100 text-rose-800',
  Rejected: 'bg-rose-100 text-rose-800',
  Frozen: 'bg-indigo-100 text-indigo-800',
  Locked: 'bg-rose-100 text-rose-800',
  Inactive: 'bg-slate-200 text-slate-700',
  Closed: 'bg-slate-200 text-slate-700',
  Reversed: 'bg-slate-200 text-slate-700',
  Matured: 'bg-violet-100 text-violet-800',
  'Written Off': 'bg-rose-200 text-rose-900',
};

export function StatusBadge({ status, testId }: { status: string; testId?: string }) {
  return (
    <span
      className={cx('inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', BADGE_COLORS[status] ?? 'bg-slate-100 text-slate-700')}
      data-testid={testId}
      data-status={status}
    >
      {status}
    </span>
  );
}

export function Alert({ kind = 'error', children, testId }: { kind?: 'error' | 'info' | 'warning' | 'success'; children: ReactNode; testId?: string }) {
  const c = {
    error: 'border-rose-200 bg-rose-50 text-rose-800',
    info: 'border-sky-200 bg-sky-50 text-sky-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  }[kind];
  return (
    <div className={cx('rounded-md border px-3 py-2 text-sm', c)} role={kind === 'error' ? 'alert' : 'status'} data-testid={testId}>
      {children}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cx('inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent', className)} aria-hidden="true" />;
}
