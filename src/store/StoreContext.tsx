import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import type { BankState, Result } from '../types';
import { freshSeed, loadState, saveState } from './storage';

interface StoreApi {
  state: BankState;
  /** Runs a service against a draft copy; commits + persists only when it succeeds. */
  run: <T>(fn: (draft: BankState) => Result<T>) => Result<T>;
  reset: () => void;
  /** Replaces all data (used by Data Backup -> Import). */
  replaceState: (next: BankState) => void;
}

const StoreContext = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BankState>(() => loadState());
  const ref = useRef(state);
  ref.current = state;

  const run = useCallback(<T,>(fn: (draft: BankState) => Result<T>): Result<T> => {
    const draft = structuredClone(ref.current);
    const result = fn(draft);
    // Failed logins still need to persist their attempt counters/audit entries.
    const persistOnFail = !result.ok && draft.users.some((u, i) => u.failedAttempts !== ref.current.users[i]?.failedAttempts);
    if (result.ok || persistOnFail) {
      ref.current = draft;
      saveState(draft);
      setState(draft);
    }
    return result;
  }, []);

  const reset = useCallback(() => {
    const seed = freshSeed();
    ref.current = seed;
    setState(seed);
  }, []);

  const replaceState = useCallback((next: BankState) => {
    saveState(next);
    ref.current = next;
    setState(next);
  }, []);

  return <StoreContext.Provider value={{ state, run, reset, replaceState }}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
