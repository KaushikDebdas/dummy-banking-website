import { STATE_VERSION, buildSeedState } from '../data/seed';
import type { BankState } from '../types';

export const STORAGE_KEY = 'demobank:v1';
export const SESSION_KEY = 'demobank:session';

export function loadState(): BankState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BankState;
      if (parsed.version === STATE_VERSION && Array.isArray(parsed.customers)) return parsed;
    }
  } catch {
    // corrupted or unavailable storage: fall through to seed
  }
  const seed = buildSeedState();
  saveState(seed);
  return seed;
}

export function saveState(state: BankState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full / disabled: app keeps working in memory
  }
}

export function freshSeed(): BankState {
  const seed = buildSeedState();
  saveState(seed);
  return seed;
}

/** `?reset=1` on any URL restores seed data and logs out (handy for automated tests). */
export function handleResetQueryParam(): void {
  const url = new URL(window.location.href);
  if (url.searchParams.get('reset') === '1') {
    freshSeed();
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    url.searchParams.delete('reset');
    window.history.replaceState(null, '', url.pathname + (url.search ? url.search : '') + url.hash);
  }
}

/** Validates an uploaded backup file (see Profile -> Data Backup). */
export function parseBackup(text: string): { ok: true; state: BankState } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'The file is not valid JSON.' };
  }
  const s = data as Partial<BankState> | null;
  if (!s || typeof s !== 'object') return { ok: false, error: 'The file does not contain QA Demo Bank data.' };
  if (s.version !== STATE_VERSION) return { ok: false, error: `Unsupported backup version (${String(s.version)}). Expected version ${STATE_VERSION}.` };
  const lists = ['users', 'customers', 'deposits', 'loans', 'transactions', 'auditLogs'] as const;
  const missing = lists.filter((k) => !Array.isArray(s[k]));
  if (missing.length || !s.counters || typeof s.counters !== 'object') return { ok: false, error: `The backup is incomplete (missing: ${[...missing, ...(s.counters ? [] : ['counters'])].join(', ')}).` };
  if (!s.users!.some((u) => u.role === 'ADMIN')) return { ok: false, error: 'The backup has no Admin user.' };
  return { ok: true, state: s as BankState };
}
