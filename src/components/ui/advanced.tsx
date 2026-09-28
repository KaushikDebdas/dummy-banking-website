/**
 * Richer interactive components. Every one of them is plain DOM + ARIA so it can
 * be driven with Playwright via test ids, roles or the keyboard.
 */
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { DOCUMENT_RULES } from '../../data/reference';
import { documentError } from '../../lib/validation';
import type { DocMeta } from '../../types';
import { Spinner, cx } from './index';

const inputBase = 'w-full rounded-md border px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2';
const inputOk = 'border-slate-300 focus:border-teal-600 focus:ring-teal-200';
const inputBad = 'border-rose-500 focus:ring-rose-300';

// ================================================================== Combobox
export interface ComboOption {
  value: string;
  label: string;
  description?: string;
}

interface ComboboxProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  /** Static options (filtered locally as the user types). */
  options?: ComboOption[];
  /** Async options, called (debounced) with the typed text — simulates a server search. */
  loadOptions?: (query: string) => Promise<ComboOption[]>;
  /** Autocomplete mode: the typed text *is* the value; options are suggestions. */
  freeText?: boolean;
  minChars?: number;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  emptyText?: string;
}

/**
 * Searchable single-select dropdown / autocomplete.
 * Test ids: input `<id>`, toggle `<id>-toggle`, clear `<id>-clear`, list `<id>-listbox`,
 * options `<id>-option-<value>`, `<id>-loading`, `<id>-no-results`.
 * Keyboard: ArrowDown/ArrowUp move, Enter selects, Escape closes, Home/End jump.
 */
export function Combobox({ id, value, onChange, onBlur, options = [], loadOptions, freeText, minChars = 0, placeholder, invalid, disabled, emptyText = 'No matches found' }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const [asyncOptions, setAsyncOptions] = useState<ComboOption[]>([]);
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const reqId = useRef(0);

  const selected = options.find((o) => o.value === value) ?? asyncOptions.find((o) => o.value === value);
  const text = freeText ? value : open ? query : (selected?.label ?? value);
  const q = (freeText ? value : query).trim().toLowerCase();

  useEffect(() => {
    if (!loadOptions || !open) return;
    if (q.length < minChars) {
      setAsyncOptions([]);
      setLoading(false);
      return;
    }
    const my = ++reqId.current;
    setLoading(true);
    const t = window.setTimeout(() => {
      loadOptions(q).then((res) => {
        if (my !== reqId.current) return; // a newer search replaced this one
        setAsyncOptions(res);
        setLoading(false);
        setActive(res.length ? 0 : -1);
      });
    }, 250);
    return () => window.clearTimeout(t);
  }, [q, open, loadOptions, minChars]);

  const list = loadOptions
    ? asyncOptions
    : options.filter((o) => !q || o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q));

  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const openList = () => {
    if (disabled) return;
    setOpen(true);
    if (!freeText) setQuery('');
    setActive(loadOptions ? -1 : Math.max(0, options.findIndex((o) => o.value === value)));
  };
  const close = () => {
    setOpen(false);
    setActive(-1);
  };
  const select = (o: ComboOption) => {
    onChange(o.value);
    close();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) return openList();
      setActive((a) => Math.min(a + 1, list.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Home' && open) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End' && open) {
      e.preventDefault();
      setActive(list.length - 1);
    } else if (e.key === 'Enter') {
      if (open && active >= 0 && list[active]) {
        e.preventDefault();
        select(list[active]);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    } else if (e.key === 'Tab') close();
  };

  const showList = open && (!loadOptions || q.length >= minChars);

  return (
    <div className="relative" data-testid={`${id}-combobox`}>
      <input
        id={id}
        data-testid={id}
        role="combobox"
        aria-expanded={showList}
        aria-controls={`${id}-listbox`}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${id}-opt-${active}` : undefined}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        disabled={disabled}
        value={text}
        placeholder={placeholder}
        onFocus={openList}
        onClick={() => !open && openList()}
        onChange={(e) => {
          if (freeText) onChange(e.target.value);
          else setQuery(e.target.value);
          setOpen(true);
          if (!loadOptions) setActive(0);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          close();
          onBlur?.();
        }}
        className={cx(inputBase, invalid ? inputBad : inputOk, 'pr-14', disabled && 'bg-slate-100')}
      />
      <div className="absolute inset-y-0 right-2 flex items-center gap-1">
        {value && !disabled && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Clear selection"
            data-testid={`${id}-clear`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange('');
              setQuery('');
            }}
            className="px-1 text-xs text-slate-400 hover:text-slate-700"
          >
            ✕
          </button>
        )}
        {!freeText && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Toggle options"
            data-testid={`${id}-toggle`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => (open ? close() : (document.getElementById(id) as HTMLInputElement | null)?.focus())}
            className="px-1 text-xs text-slate-500"
          >
            ▾
          </button>
        )}
      </div>
      {showList && (
        <ul
          ref={listRef}
          id={`${id}-listbox`}
          role="listbox"
          data-testid={`${id}-listbox`}
          className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
        >
          {loading ? (
            <li className="flex items-center gap-2 px-3 py-2 text-slate-500" data-testid={`${id}-loading`}>
              <Spinner /> Searching...
            </li>
          ) : list.length === 0 ? (
            <li className="px-3 py-2 text-slate-500" data-testid={`${id}-no-results`}>
              {emptyText}
            </li>
          ) : (
            list.map((o, i) => (
              <li
                key={o.value}
                id={`${id}-opt-${i}`}
                role="option"
                data-index={i}
                data-testid={`${id}-option-${o.value}`}
                aria-selected={o.value === value}
                data-active={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => select(o)}
                className={cx('cursor-pointer px-3 py-2', i === active ? 'bg-teal-50 text-teal-900' : 'text-slate-800', o.value === value && 'font-semibold')}
              >
                <div>{o.label}</div>
                {o.description && <div className="text-xs text-slate-500">{o.description}</div>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

// ================================================================== MultiSelect
interface MultiSelectProps {
  id: string;
  value: string[];
  onChange: (value: string[]) => void;
  options: ComboOption[];
  placeholder?: string;
  invalid?: boolean;
  onBlur?: () => void;
}

/**
 * Searchable multi-select with chips.
 * Test ids: input `<id>`, chips `<id>-chip-<value>`, chip remove `<id>-remove-<value>`,
 * clear all `<id>-clear`, list `<id>-listbox`, options `<id>-option-<value>`.
 * Keyboard: ArrowUp/Down, Enter toggles, Backspace (empty input) removes the last chip, Escape closes.
 */
export function MultiSelect({ id, value, onChange, options, placeholder = 'Search and select...', invalid, onBlur }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const q = query.trim().toLowerCase();
  const list = options.filter((o) => !q || o.label.toLowerCase().includes(q));
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, list.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && list[active]) {
        toggle(list[active].value);
        setQuery('');
      }
    } else if (e.key === 'Backspace' && !query && value.length) {
      onChange(value.slice(0, -1));
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="relative" data-testid={`${id}-multiselect`}>
      <div className={cx('flex min-h-[2.5rem] flex-wrap items-center gap-1 rounded-md border bg-white px-2 py-1 shadow-sm', invalid ? 'border-rose-500' : 'border-slate-300')}>
        {value.map((v) => (
          <span key={v} data-testid={`${id}-chip-${v}`} className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-900">
            {options.find((o) => o.value === v)?.label ?? v}
            <button type="button" aria-label={`Remove ${v}`} data-testid={`${id}-remove-${v}`} onClick={() => toggle(v)} className="text-teal-700 hover:text-teal-950">
              ✕
            </button>
          </span>
        ))}
        <input
          id={id}
          data-testid={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          value={query}
          placeholder={value.length ? '' : placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            setOpen(false);
            onBlur?.();
          }}
          className="min-w-[8rem] flex-1 border-0 py-1 text-sm focus:outline-none"
        />
        {value.length > 0 && (
          <button type="button" data-testid={`${id}-clear`} onMouseDown={(e) => e.preventDefault()} onClick={() => onChange([])} className="text-xs text-slate-500 hover:text-slate-800">
            Clear all
          </button>
        )}
      </div>
      <div className="mt-1 text-xs text-slate-500" data-testid={`${id}-count`} data-count={value.length}>
        {value.length} selected
      </div>
      {open && (
        <ul id={`${id}-listbox`} role="listbox" aria-multiselectable="true" data-testid={`${id}-listbox`} className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
          {list.length === 0 ? (
            <li className="px-3 py-2 text-slate-500" data-testid={`${id}-no-results`}>
              No matches found
            </li>
          ) : (
            list.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={value.includes(o.value)}
                data-testid={`${id}-option-${o.value}`}
                data-active={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => toggle(o.value)}
                className={cx('flex cursor-pointer items-center gap-2 px-3 py-2', i === active && 'bg-teal-50')}
              >
                <span className={cx('flex h-4 w-4 items-center justify-center rounded border text-[10px]', value.includes(o.value) ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300')}>
                  {value.includes(o.value) ? '✓' : ''}
                </span>
                {o.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

// ================================================================== Tooltip / InfoTip
/** Shows `content` while the child is hovered or focused. Tooltip element: role="tooltip", test id `testId`. */
export function Tooltip({ content, testId, children, side = 'top' }: { content: ReactNode; testId?: string; children: ReactNode; side?: 'top' | 'bottom' | 'right' }) {
  const [show, setShow] = useState(false);
  const tipId = useId();
  const pos = side === 'top' ? 'bottom-full left-1/2 mb-2 -translate-x-1/2' : side === 'bottom' ? 'top-full left-1/2 mt-2 -translate-x-1/2' : 'left-full top-1/2 ml-2 -translate-y-1/2';
  return (
    <span
      className="relative inline-flex"
      aria-describedby={show ? tipId : undefined}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show && (
        <span id={tipId} role="tooltip" data-testid={testId} className={cx('pointer-events-none absolute z-50 w-max max-w-xs rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-normal normal-case tracking-normal text-white shadow-lg', pos)}>
          {content}
        </span>
      )}
    </span>
  );
}

/** Small (i) button with a tooltip. Test ids: `<id>-info` and `<id>-tooltip`. */
export function InfoTip({ id, text }: { id: string; text: ReactNode }) {
  return (
    <Tooltip content={text} testId={`${id}-tooltip`}>
      <button
        type="button"
        data-testid={`${id}-info`}
        aria-label="More information"
        onClick={(e) => {
          // don't trigger a surrounding link or label
          e.preventDefault();
          e.stopPropagation();
        }}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-400 text-[10px] font-bold text-slate-500 hover:border-teal-600 hover:text-teal-700">
        i
      </button>
    </Tooltip>
  );
}

// ================================================================== Popover
/** Click-to-open panel. Test ids: `<id>-trigger`, `<id>-panel`. Closes on outside click or Escape. */
export function Popover({
  id,
  trigger,
  triggerClassName,
  label,
  children,
  align = 'right',
  onOpenChange,
}: {
  id: string;
  trigger: ReactNode;
  triggerClassName?: string;
  label: string;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
  /** Called whenever the panel opens or closes (click, Escape, outside click, close()). */
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpenState] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const openRef = useRef(false);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  // Notify synchronously (same event as the click/key), so the parent's state updates render
  // together with the panel instead of one frame later.
  const setOpen = (next: boolean | ((o: boolean) => boolean)) => {
    const value = typeof next === 'function' ? next(openRef.current) : next;
    if (value === openRef.current) return;
    openRef.current = value;
    onOpenChangeRef.current?.(value);
    setOpenState(value);
  };
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" data-testid={`${id}-trigger`} aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={triggerClassName}>
        {trigger}
      </button>
      {open && (
        <div role="dialog" aria-label={label} data-testid={`${id}-panel`} className={cx('absolute z-40 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-xl', align === 'right' ? 'right-0' : 'left-0')}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

// ================================================================== HoverCard
/** Rich preview shown after hovering the trigger for 400 ms. Panel test id: `testId`. */
export function HoverCard({ testId, trigger, children }: { testId: string; trigger: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const enter = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), 400);
  };
  const leave = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(false), 150);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <span className="relative inline-flex" onMouseEnter={enter} onMouseLeave={leave}>
      {trigger}
      {open && (
        <div data-testid={testId} role="tooltip" className="absolute left-0 top-full z-40 mt-1 w-72 whitespace-normal rounded-lg border border-slate-200 bg-white p-3 text-left text-sm shadow-xl">
          {children}
        </div>
      )}
    </span>
  );
}

// ================================================================== Accordion
export interface AccordionItem {
  id: string;
  title: ReactNode;
  content: ReactNode;
}

/** Test ids: `<id>-<item>-trigger` (aria-expanded) and `<id>-<item>-panel`. */
export function Accordion({ id, items, allowMultiple = false, defaultOpen = [] }: { id: string; items: AccordionItem[]; allowMultiple?: boolean; defaultOpen?: string[] }) {
  const [openIds, setOpenIds] = useState<string[]>(defaultOpen);
  const toggle = (itemId: string) =>
    setOpenIds((cur) => (cur.includes(itemId) ? cur.filter((x) => x !== itemId) : allowMultiple ? [...cur, itemId] : [itemId]));
  return (
    <div className="divide-y divide-slate-200 rounded-md border border-slate-200" data-testid={id}>
      {items.map((it) => {
        const isOpen = openIds.includes(it.id);
        return (
          <div key={it.id}>
            <h3>
              <button
                type="button"
                id={`${id}-${it.id}-trigger`}
                data-testid={`${id}-${it.id}-trigger`}
                aria-expanded={isOpen}
                aria-controls={`${id}-${it.id}-panel`}
                onClick={() => toggle(it.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                {it.title}
                <span aria-hidden="true" className={cx('text-slate-500 transition-transform', isOpen && 'rotate-180')}>
                  ▾
                </span>
              </button>
            </h3>
            <div
              id={`${id}-${it.id}-panel`}
              role="region"
              aria-labelledby={`${id}-${it.id}-trigger`}
              data-testid={`${id}-${it.id}-panel`}
              hidden={!isOpen}
              className="px-4 pb-4 text-sm leading-relaxed text-slate-700"
            >
              {it.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ================================================================== Toggle switch
/** `role="switch"` button with aria-checked. Test id: `id`. */
export function ToggleSwitch({ id, checked, onChange, label, description, disabled }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4" data-testid={`${id}-field`}>
      <div>
        <label htmlFor={id} className="text-sm font-medium text-slate-700" data-testid={`${id}-label`}>
          {label}
        </label>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        data-testid={id}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50', checked ? 'bg-teal-600' : 'bg-slate-300')}
      >
        <span className={cx('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0.5')} />
        <span className="sr-only">{checked ? 'On' : 'Off'}</span>
      </button>
    </div>
  );
}

// ================================================================== Radio group
/**
 * Native radio buttons. Group test id `<id>`, each radio `<id>-<value>`, error `<id>-error`.
 * Pass react-hook-form's `register(...)` result as `inputProps`, or use value/onChange.
 */
export function RadioGroup({
  id,
  label,
  options,
  error,
  required,
  inputProps,
  value,
  onChange,
  inline = true,
}: {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  error?: string;
  required?: boolean;
  inputProps?: InputHTMLAttributes<HTMLInputElement> & { name?: string };
  value?: string;
  onChange?: (v: string) => void;
  inline?: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-1" data-testid={id} role="radiogroup" aria-invalid={!!error || undefined} aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="mb-1 text-sm font-medium text-slate-700" data-testid={`${id}-label`}>
        {label}
        {required && <span className="ml-0.5 text-rose-600" aria-hidden="true">*</span>}
      </legend>
      <div className={cx('flex gap-x-5 gap-y-2', inline ? 'flex-wrap items-center pt-1' : 'flex-col')}>
        {options.map((o) => (
          <label key={o.value} className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-800">
            <input
              type="radio"
              value={o.value}
              data-testid={`${id}-${o.value}`}
              id={`${id}-${o.value}`}
              className="h-4 w-4 accent-teal-700"
              {...(inputProps ?? { name: id, checked: value === o.value, onChange: () => onChange?.(o.value) })}
            />
            {o.label}
          </label>
        ))}
      </div>
      {error && (
        <p className="text-xs font-medium text-rose-600" id={`${id}-error`} data-testid={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}

// ================================================================== File upload (with drag-and-drop)
/**
 * File picker + drop zone. Only file metadata is kept.
 * Test ids: file input `<id>` (use set_input_files), drop zone `<id>-dropzone`, list `<id>-list`,
 * file item `<id>-file-<index>`, remove `<id>-remove-<index>`, upload error `<id>-upload-error`.
 */
export function FileUpload({ id, value, onChange, invalid }: { id: string; value: DocMeta[]; onChange: (docs: DocMeta[]) => void; invalid?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState('');

  const addFiles = (files: FileList | File[]) => {
    const errors: string[] = [];
    const accepted: DocMeta[] = [];
    for (const f of Array.from(files)) {
      const meta = { name: f.name, size: f.size, type: f.type };
      const e = documentError(meta);
      if (e) errors.push(e);
      else if (value.some((d) => d.name === f.name) || accepted.some((d) => d.name === f.name)) errors.push(`${f.name}: file already added`);
      else accepted.push(meta);
    }
    let merged = [...value, ...accepted];
    if (merged.length > DOCUMENT_RULES.maxFiles) {
      errors.push(`You can upload at most ${DOCUMENT_RULES.maxFiles} documents`);
      merged = merged.slice(0, DOCUMENT_RULES.maxFiles);
    }
    setError(errors.join(' '));
    onChange(merged);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={0}
        data-testid={`${id}-dropzone`}
        data-dragover={drag}
        aria-label="Upload documents: click or drop files here"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), inputRef.current?.click())}
        onDragEnter={(e) => (e.preventDefault(), setDrag(true))}
        onDragOver={(e) => (e.preventDefault(), setDrag(true))}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={cx(
          'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-4 py-5 text-center text-sm',
          drag ? 'border-teal-600 bg-teal-50' : invalid ? 'border-rose-400 bg-rose-50/40' : 'border-slate-300 bg-slate-50 hover:border-teal-500',
        )}
      >
        <span className="text-2xl" aria-hidden="true">
          ⬆
        </span>
        <span className="font-medium text-slate-700">Drag & drop files here, or click to browse</span>
        <span className="text-xs text-slate-500">
          JPG, PNG or PDF · max {DOCUMENT_RULES.maxSizeMB} MB each · up to {DOCUMENT_RULES.maxFiles} files
        </span>
      </div>
      <input
        ref={inputRef}
        id={id}
        data-testid={id}
        type="file"
        multiple
        accept={DOCUMENT_RULES.extensions.join(',')}
        className="sr-only"
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      {error && (
        <p className="text-xs font-medium text-rose-600" data-testid={`${id}-upload-error`} role="alert">
          {error}
        </p>
      )}
      {value.length > 0 && (
        <ul className="flex flex-col gap-1" data-testid={`${id}-list`} data-count={value.length}>
          {value.map((d, i) => (
            <li key={d.name} data-testid={`${id}-file-${i}`} data-file-name={d.name} className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white px-3 py-1.5 text-sm">
              <span className="truncate">
                📄 {d.name} <span className="text-xs text-slate-500">({(d.size / 1024).toFixed(1)} KB)</span>
              </span>
              <button type="button" data-testid={`${id}-remove-${i}`} aria-label={`Remove ${d.name}`} onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-xs font-medium text-rose-600 hover:underline">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ================================================================== Range slider + number input
/** Slider `<id>-slider` kept in sync with number input `<id>`. */
export function RangeField({ id, value, onChange, min, max, step = 1, invalid, suffix, onBlur }: { id: string; value: string; onChange: (v: string) => void; min: number; max: number; step?: number; invalid?: boolean; suffix?: string; onBlur?: () => void }) {
  const num = Number(value);
  const sliderValue = Number.isFinite(num) && value !== '' ? Math.min(Math.max(num, min), max) : min;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <input
          type="range"
          data-testid={`${id}-slider`}
          aria-label={`${id} slider`}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={sliderValue}
          min={min}
          max={max}
          step={step}
          value={sliderValue}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="h-2 flex-1 cursor-pointer accent-teal-700"
        />
        <div className="relative w-32">
          <input
            id={id}
            data-testid={id}
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            aria-invalid={invalid || undefined}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            className={cx(inputBase, invalid ? inputBad : inputOk, suffix && 'pr-12')}
          />
          {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-500">{suffix}</span>}
        </div>
      </div>
      <div className="flex justify-between text-[11px] text-slate-500">
        <span data-testid={`${id}-min`}>{min.toLocaleString('en-US')}</span>
        <span data-testid={`${id}-max`}>{max.toLocaleString('en-US')}</span>
      </div>
    </div>
  );
}
