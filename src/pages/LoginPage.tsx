import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { LogoMark } from '../components/Logo';
import { Alert, Button, Field, TextInput } from '../components/ui';
import { useFeedback } from '../components/ui/feedback';
import { ROLE_LABELS, branchName } from '../data/reference';
import { useStore } from '../store/StoreContext';

export function LoginPage() {
  const { login } = useAuth();
  const { state, reset } = useStore();
  const { withLoading, toast, confirm } = useFeedback();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const [formError, setFormError] = useState('');
  const [showCreds, setShowCreds] = useState(true);
  const [params] = useSearchParams();
  const expired = params.get('expired') === '1';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    const fieldErrors: typeof errors = {};
    if (!username.trim()) fieldErrors.username = 'Username is required';
    if (!password) fieldErrors.password = 'Password is required';
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return;
    const res = await withLoading(() => login(username, password));
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    // The /login route redirects to `next` (or the dashboard) as soon as the user is set.
    toast('success', res.message);
  };

  const doReset = async () => {
    const { confirmed } = await confirm({ title: 'Reset Demo Data', message: 'Restore all users and data to the original demo seed?', confirmLabel: 'Reset Data', variant: 'danger' });
    if (!confirmed) return;
    await withLoading(() => reset());
    setFormError('');
    toast('success', 'Demo data has been reset to the original seed');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 px-4 py-10">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="self-start rounded-xl bg-white p-8 shadow-2xl">
          <div className="mb-6 flex items-center gap-3">
            <LogoMark size={48} />
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900" data-testid="login-title">
                KD <span className="text-teal-700">Demo Bank</span>
              </h1>
              <p className="text-xs text-slate-500">Sign in to the core banking simulator</p>
            </div>
          </div>
          <form onSubmit={submit} noValidate data-testid="login-form" className="flex flex-col gap-4">
            {expired && !formError && (
              <Alert kind="warning" testId="login-session-expired">
                Your session expired due to inactivity. Please sign in again.
              </Alert>
            )}
            {formError && <Alert testId="login-error">{formError}</Alert>}
            <Field id="login-username" label="Username" required error={errors.username}>
              <TextInput
                id="login-username"
                name="username"
                autoComplete="username"
                value={username}
                invalid={!!errors.username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. manager.dhaka"
              />
            </Field>
            <Field id="login-password" label="Password" required error={errors.password}>
              <div className="relative">
                <TextInput
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  invalid={!!errors.password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-16"
                />
                <button
                  type="button"
                  data-testid="login-toggle-password"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-2 text-xs font-medium text-teal-700"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </Field>
            <Button type="submit" testId="login-submit-btn" className="w-full">
              Sign In
            </Button>
          </form>
          <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
            <span>
              3 failed attempts lock the account.{' '}
              <Link to="/guide" className="font-medium text-teal-700 hover:underline" data-testid="login-guide-link">
                User Guide
              </Link>
            </span>
            <button type="button" className="font-medium text-teal-700 hover:underline" data-testid="login-reset-data-btn" onClick={doReset}>
              Reset demo data
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-white/95 p-6 shadow-2xl" data-testid="demo-credentials">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Demo Credentials</h2>
            <button type="button" className="text-xs font-medium text-teal-700" data-testid="demo-credentials-toggle" onClick={() => setShowCreds((v) => !v)}>
              {showCreds ? 'Hide' : 'Show'}
            </button>
          </div>
          {showCreds && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs" data-testid="demo-credentials-table">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-1 pr-3">Username</th>
                    <th className="py-1 pr-3">Password</th>
                    <th className="py-1 pr-3">Role</th>
                    <th className="py-1 pr-3">Branch</th>
                    <th className="py-1" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.users.map((u) => (
                    <tr key={u.username} data-testid={`demo-user-row-${u.username}`} data-row-id={u.username}>
                      <td className="py-1.5 pr-3 font-mono" data-testid="cell-username">
                        {u.username}
                      </td>
                      <td className="py-1.5 pr-3 font-mono" data-testid="cell-password">
                        {u.password}
                      </td>
                      <td className="py-1.5 pr-3" data-testid="cell-role">
                        {ROLE_LABELS[u.role]}
                        {u.status === 'Locked' && <span className="ml-1 rounded bg-rose-100 px-1 text-rose-700">Locked</span>}
                      </td>
                      <td className="py-1.5 pr-3" data-testid="cell-branch">
                        {branchName(u.branch)}
                      </td>
                      <td className="py-1.5 text-right">
                        <button
                          type="button"
                          className="rounded border border-teal-600 px-2 py-0.5 font-medium text-teal-700 hover:bg-teal-50"
                          data-testid={`use-demo-user-${u.username}`}
                          onClick={() => {
                            setUsername(u.username);
                            setPassword(u.password);
                            setErrors({});
                            setFormError('');
                          }}
                        >
                          Use
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
