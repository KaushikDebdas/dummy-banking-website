import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PERMISSION_LABELS, type Permission } from './permissions';
import { useAuth } from './AuthContext';
import { ROLE_LABELS } from '../data/reference';

export function AccessDenied({ perm }: { perm?: Permission }) {
  const { user } = useAuth();
  return (
    <div className="mx-auto mt-12 max-w-lg rounded-lg border border-rose-200 bg-white p-8 text-center shadow-sm" data-testid="access-denied">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-2xl text-rose-600" aria-hidden="true">
        ⛔
      </div>
      <h1 className="text-lg font-semibold text-slate-900" data-testid="access-denied-title">
        Access Denied
      </h1>
      <p className="mt-2 text-sm text-slate-600" data-testid="access-denied-message">
        {perm
          ? `Your role (${user ? ROLE_LABELS[user.role] : 'Guest'}) does not have permission to ${PERMISSION_LABELS[perm]}.`
          : 'You do not have permission to view this page.'}
      </p>
      <Link to="/dashboard" className="mt-5 inline-block text-sm font-medium text-teal-700 hover:underline" data-testid="access-denied-home-link">
        Go to Dashboard
      </Link>
    </div>
  );
}

export function RequirePermission({ perm, children }: { perm: Permission | Permission[]; children: ReactNode }) {
  const { can } = useAuth();
  const perms = Array.isArray(perm) ? perm : [perm];
  if (!perms.some((p) => can(p))) return <AccessDenied perm={perms[0]} />;
  return <>{children}</>;
}
