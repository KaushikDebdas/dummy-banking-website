import { useId } from 'react';
import { cx } from './ui';

/**
 * KD Demo Bank logo mark: bank roof with a gold coin over a "KD" monogram.
 * Drawn with vector paths (no font), identical to public/favicon.svg.
 */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  const gradientId = `kd-bg-${useId().replace(/:/g, '')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="KD Demo Bank logo" data-testid="app-logo" className={cx('shrink-0', className)}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#14b8a6" />
          <stop offset="1" stopColor="#0f5f58" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill={`url(#${gradientId})`} />
      <path d="M32 8.5 55 20.5H9Z" fill="#fff" />
      <circle cx="32" cy="16" r="2.6" fill="#fbbf24" />
      <g fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 26v21M29 26 19.5 36.5 29 47" />
        <path d="M36 26v21h3.5a10.5 10.5 0 0 0 0-21Z" />
      </g>
      <rect x="9" y="51" width="46" height="4.5" rx="1.5" fill="#fff" />
    </svg>
  );
}

/** Mark + "KD Demo Bank" wordmark with an optional tagline. */
export function Logo({ size = 32, tagline, dark = false, className }: { size?: number; tagline?: string; dark?: boolean; className?: string }) {
  return (
    <div className={cx('flex items-center gap-2.5', className)}>
      <LogoMark size={size} />
      <div className="leading-tight">
        <div className={cx('font-semibold tracking-tight', dark ? 'text-white' : 'text-slate-900', size >= 40 ? 'text-xl' : 'text-sm')} data-testid="app-name">
          KD <span className={dark ? 'text-teal-300' : 'text-teal-700'}>Demo Bank</span>
        </div>
        {tagline && <div className={cx('text-[11px]', dark ? 'text-slate-400' : 'text-slate-500')}>{tagline}</div>}
      </div>
    </div>
  );
}
