import { Link } from 'react-router-dom';

export function EntityNotFound({ testId, message }: { testId: string; message: string }) {
  return (
    <div className="mx-auto mt-10 max-w-lg rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm" data-testid={testId}>
      <h1 className="text-lg font-semibold text-slate-900">Record not found</h1>
      <p className="mt-2 text-sm text-slate-600" data-testid={`${testId}-message`}>
        {message}
      </p>
      <Link to="/dashboard" className="mt-4 inline-block text-sm font-medium text-teal-700 hover:underline">
        Go to Dashboard
      </Link>
    </div>
  );
}

export function CustomerLink({ id }: { id: string }) {
  return (
    <Link to={`/customers/${id}`} className="text-teal-700 hover:underline" data-testid={`customer-link-${id}`}>
      {id}
    </Link>
  );
}

export function AccountLink({ accountNo }: { accountNo: string }) {
  const to = accountNo.startsWith('LN-') ? `/loans/${accountNo}` : `/deposits/${accountNo}`;
  return (
    <Link to={to} className="font-medium text-teal-700 hover:underline" data-testid={`account-link-${accountNo}`}>
      {accountNo}
    </Link>
  );
}
