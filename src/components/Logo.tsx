import { useId } from 'react';
import { cx } from './ui';

/**
 * QA Demo Bank logo mark: bank building with a gold "verified" check badge.
 * Drawn with vector paths (no font), identical to public/favicon.svg.
 */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  const gradientId = `qa-bg-${useId().replace(/:/g, '')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="QA Demo Bank logo" data-testid="app-logo" className={cx('shrink-0', className)}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#14b8a6" />
          <stop offset="1" stopColor="#0f5f58" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill={`url(#${gradientId})`} />
      <path d="M30 8 50 20H10Z" fill="#fff" />
      <g fill="#fff">
        <rect x="13" y="24" width="6" height="18" rx="1.2" />
        <rect x="25" y="24" width="6" height="18" rx="1.2" />
        <rect x="37" y="24" width="6" height="18" rx="1.2" />
        <rect x="9" y="45" width="38" height="5" rx="1.5" />
      </g>
      <circle cx="47" cy="46" r="12" fill="#fbbf24" stroke="#0f5f58" strokeWidth="3" />
      <path d="M41 46.5 45.5 51 53 42" fill="none" stroke="#0f5f58" strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Mark + "QA Demo Bank" wordmark with an optional tagline. */
export function Logo({ size = 32, tagline, dark = false, className }: { size?: number; tagline?: string; dark?: boolean; className?: string }) {
  return (
    <div className={cx('flex items-center gap-2.5', className)}>
      <LogoMark size={size} />
      <div className="leading-tight">
        <div className={cx('font-semibold tracking-tight', dark ? 'text-white' : 'text-slate-900', size >= 40 ? 'text-xl' : 'text-sm')} data-testid="app-name">
          QA <span className={dark ? 'text-teal-300' : 'text-teal-700'}>Demo Bank</span>
        </div>
        {tagline && <div className={cx('text-[11px]', dark ? 'text-slate-400' : 'text-slate-500')}>{tagline}</div>}
      </div>
    </div>
  );
}
