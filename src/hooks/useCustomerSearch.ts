import { useCallback } from 'react';
import { useCurrentUser } from '../auth/AuthContext';
import type { ComboOption } from '../components/ui/advanced';
import { branchName } from '../data/reference';
import { useStore } from '../store/StoreContext';
import { visibleCustomers } from '../store/selectors';

export const CUSTOMER_SEARCH_LATENCY_MS = 400;

/**
 * Simulated server-side customer search for autocomplete fields: matches ID, name
 * or mobile within the user's branch scope and resolves after a short delay.
 */
export function useCustomerSearch(onlyActive = true) {
  const { state } = useStore();
  const user = useCurrentUser();
  return useCallback(
    (query: string) =>
      new Promise<ComboOption[]>((resolve) => {
        const q = query.trim().toLowerCase();
        const results = visibleCustomers(state, user)
          .filter((c) => (!onlyActive || c.status === 'Active') && (c.customerId.toLowerCase().includes(q) || c.fullName.toLowerCase().includes(q) || c.mobile.includes(q)))
          .slice(0, 8)
          .map((c) => ({
            value: c.customerId,
            label: `${c.customerId} — ${c.fullName}`,
            description: `${c.mobile} · ${branchName(c.branch)} · ${c.customerType} · KYC ${c.kycStatus}`,
          }));
        window.setTimeout(() => resolve(results), CUSTOMER_SEARCH_LATENCY_MS);
      }),
    [state, user, onlyActive],
  );
}
