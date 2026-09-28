import { useCallback } from 'react';
import { useCurrentUser } from '../auth/AuthContext';
import { useFeedback } from '../components/ui/feedback';
import { useStore } from '../store/StoreContext';
import type { BankState, Result, User } from '../types';

/**
 * Runs a service with the loading overlay, commits on success and shows a
 * success/error toast with the service message.
 */
export function useAction() {
  const { run } = useStore();
  const user = useCurrentUser();
  const { withLoading, toast } = useFeedback();
  return useCallback(
    async <T,>(fn: (draft: BankState, user: User) => Result<T>, opts: { toastOnError?: boolean } = {}): Promise<Result<T>> => {
      const res = await withLoading(() => run((d) => fn(d, user)));
      if (res.ok) toast('success', res.message);
      else if (opts.toastOnError !== false) toast('error', res.error);
      return res;
    },
    [run, user, withLoading, toast],
  );
}
