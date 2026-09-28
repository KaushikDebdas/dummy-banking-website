import { useState, type ChangeEvent } from 'react';
import { downloadFile } from '../lib/csv';
import { today } from '../lib/dates';
import { useStore } from '../store/StoreContext';
import { parseBackup } from '../store/storage';
import { TIMEOUT_OPTIONS, getTimeoutMinutes, setTimeoutMinutes, touchActivity } from '../auth/session';
import { SelectInput } from '../components/ui';
import { useFeedback } from '../components/ui/feedback';
import { useForm } from 'react-hook-form';
import { useCurrentUser } from '../auth/AuthContext';
import { PERMISSION_LABELS, ROLE_PERMISSIONS } from '../auth/permissions';
import { Alert, Button, Card, DetailGrid, Field, PageHeader, TextInput } from '../components/ui';
import { ROLE_LABELS, branchName } from '../data/reference';
import { useAction } from '../hooks/useAction';
import { formatDateTime } from '../lib/dates';
import { PASSWORD_MESSAGE, makeResolver, validatePasswordChange, type PasswordChangeValues } from '../lib/validation';
import * as svc from '../store/services';

const EMPTY: PasswordChangeValues = { currentPassword: '', newPassword: '', confirmPassword: '' };

export function ProfilePage() {
  const user = useCurrentUser();
  const act = useAction();
  const [formError, setFormError] = useState('');
  const [timeout, setTimeoutState] = useState(String(getTimeoutMinutes()));
  const { toast } = useFeedback();
  const { state, replaceState } = useStore();
  const [importError, setImportError] = useState('');

  const exportData = () => {
    downloadFile(`kd-demo-bank-backup-${today()}.json`, JSON.stringify(state, null, 2), 'application/json');
    toast('success', `Exported ${state.customers.length} customers, ${state.deposits.length} deposit accounts and ${state.loans.length} loans`);
  };

  const importData = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setImportError('');
    if (!file) return;
    const parsed = parseBackup(await file.text());
    if (!parsed.ok) {
      setImportError(parsed.error);
      toast('error', `Import failed: ${parsed.error}`);
      return;
    }
    // Native confirm dialog before overwriting everything.
    if (!window.confirm(`Replace ALL current data with the backup "${file.name}"? This cannot be undone.`)) return;
    replaceState(parsed.state);
    toast('success', `Data imported from ${file.name}`);
  };
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<PasswordChangeValues>({ resolver: makeResolver(validatePasswordChange), defaultValues: EMPTY, mode: 'onTouched' });
  const err = (f: keyof PasswordChangeValues) => errors[f]?.message as string | undefined;

  const submit = handleSubmit(async (values) => {
    setFormError('');
    const res = await act((d, u) => svc.changePassword(d, u, values), { toastOnError: false });
    if (!res.ok) {
      setFormError(res.error);
      if (res.field) setError(res.field as keyof PasswordChangeValues, { type: 'server', message: res.error });
      return;
    }
    reset(EMPTY);
  });

  return (
    <div data-testid="profile-page">
      <PageHeader title="User Profile" />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="Profile Information" testId="profile-info-card">
          <DetailGrid
            prefix="profile"
            cols={2}
            items={[
              { key: 'username', label: 'Username', value: user.username },
              { key: 'fullName', label: 'Full Name', value: user.fullName },
              { key: 'email', label: 'Email', value: user.email },
              { key: 'role', label: 'Role', value: ROLE_LABELS[user.role], raw: user.role },
              { key: 'branch', label: 'Branch', value: branchName(user.branch), raw: user.branch },
              { key: 'lastLogin', label: 'Last Login', value: formatDateTime(user.lastLogin) },
            ]}
          />
          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">Permissions</h3>
          <ul className="mt-2 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2" data-testid="profile-permissions">
            {ROLE_PERMISSIONS[user.role].map((p) => (
              <li key={p} data-testid={`permission-${p}`} className="flex items-center gap-2">
                <span className="text-emerald-600" aria-hidden="true">
                  ✓
                </span>
                Can {PERMISSION_LABELS[p]}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Session Settings" testId="session-settings-card">
          <Field
            id="profile-session-timeout"
            label="Automatic logout after inactivity"
            hint="A warning with a countdown appears before you are logged out. Choose 1 minute to practise session-expiry scenarios."
          >
            <SelectInput
              id="profile-session-timeout"
              value={timeout}
              onChange={(e) => {
                setTimeoutState(e.target.value);
                setTimeoutMinutes(Number(e.target.value));
                touchActivity();
                toast('success', `Session timeout set to ${e.target.value} minute(s)`);
              }}
              options={TIMEOUT_OPTIONS.map((m) => ({ value: String(m), label: `${m} minute${m === 1 ? '' : 's'}` }))}
            />
          </Field>
        </Card>
        <Card title="Data Backup" testId="data-backup-card">
          <p className="text-sm text-slate-600">
            Your data is saved only in <strong>this browser</strong> (localStorage). Export it to a file to keep a copy, or import it into another browser or computer.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="secondary" testId="data-export-btn" onClick={exportData}>
              ⬇ Export Data (JSON)
            </Button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              ⬆ Import Data
              <input type="file" accept=".json,application/json" data-testid="data-import-input" className="sr-only" onChange={importData} />
            </label>
          </div>
          {importError && (
            <div className="mt-3">
              <Alert testId="data-import-error">{importError}</Alert>
            </div>
          )}
        </Card>
        <Card title="Change Password" testId="change-password-card">
          <form onSubmit={submit} noValidate className="flex flex-col gap-4" data-testid="change-password-form">
            {formError && <Alert testId="change-password-error">{formError}</Alert>}
            <Field id="change-password-current" label="Current Password" required error={err('currentPassword')}>
              <TextInput id="change-password-current" type="password" invalid={!!err('currentPassword')} {...register('currentPassword')} />
            </Field>
            <Field id="change-password-new" label="New Password" required error={err('newPassword')} hint={PASSWORD_MESSAGE}>
              <TextInput id="change-password-new" type="password" invalid={!!err('newPassword')} {...register('newPassword')} />
            </Field>
            <Field id="change-password-confirm" label="Confirm New Password" required error={err('confirmPassword')}>
              <TextInput id="change-password-confirm" type="password" invalid={!!err('confirmPassword')} {...register('confirmPassword')} />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" testId="change-password-submit-btn">
                Change Password
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
