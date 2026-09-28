import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useCurrentUser } from '../auth/AuthContext';
import { DataTable } from '../components/table/DataTable';
import { Alert, Button, Card, Field, PageHeader, SelectInput, StatusBadge, TextInput } from '../components/ui';
import { useFeedback } from '../components/ui/feedback';
import { Modal } from '../components/ui/Modal';
import { BRANCHES, ROLE_LABELS, branchName } from '../data/reference';
import { useAction } from '../hooks/useAction';
import { formatDateTime } from '../lib/dates';
import { PASSWORD_MESSAGE, makeResolver, validateUser, type UserFormValues } from '../lib/validation';
import { useStore } from '../store/StoreContext';
import * as svc from '../store/services';
import type { Role, User } from '../types';

const EMPTY: UserFormValues = { username: '', fullName: '', email: '', role: '', branch: '', password: '' };

export function UserManagementPage() {
  const me = useCurrentUser();
  const { state, run } = useStore();
  const { confirm, toast, withLoading } = useFeedback();
  const act = useAction();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<UserFormValues>({ resolver: makeResolver(validateUser), defaultValues: EMPTY, mode: 'onTouched' });
  const err = (f: keyof UserFormValues) => errors[f]?.message as string | undefined;

  const submit = handleSubmit(async (values) => {
    setFormError('');
    const res = await act((d, u) => svc.createUser(d, u, values), { toastOnError: false });
    if (!res.ok) {
      setFormError(res.error);
      if (res.field) setError(res.field as keyof UserFormValues, { type: 'server', message: res.error });
      return;
    }
    setOpen(false);
    reset(EMPTY);
  });

  const saveField = async (u: User, field: 'fullName' | 'email', value: string) => {
    const res = await withLoading(() => run((d) => svc.updateUserDetails(d, me, u.username, { [field]: value })));
    if (!res.ok) return res.error;
    toast('success', res.message);
    return null;
  };

  const toggle = async (u: User) => {
    const target = u.status === 'Active' ? 'Locked' : 'Active';
    const { confirmed } = await confirm({ title: `${target === 'Locked' ? 'Lock' : 'Unlock'} User`, message: `${target === 'Locked' ? 'Lock' : 'Unlock'} user ${u.username}?`, confirmLabel: target === 'Locked' ? 'Lock' : 'Unlock', variant: target === 'Locked' ? 'danger' : 'success' });
    if (confirmed) await act((d, a) => svc.setUserStatus(d, a, u.username, target));
  };

  return (
    <div data-testid="user-management-page">
      <PageHeader
        title="User Management"
        subtitle="Create users, assign roles and branches, lock or unlock accounts."
        actions={
          <Button
            testId="new-user-btn"
            onClick={() => {
              reset(EMPTY);
              setFormError('');
              setOpen(true);
            }}
          >
            + New User
          </Button>
        }
      />
      <Card>
        <DataTable<User>
          id="users"
          rowTestIdPrefix="user-row"
          rows={state.users}
          rowId={(u) => u.username}
          searchPlaceholder="Search by username, name or email"
          filters={[
            { key: 'role', label: 'Role', options: Object.entries(ROLE_LABELS).map(([v, l]) => ({ value: v, label: l })) },
            { key: 'status', label: 'Status', options: ['Active', 'Locked'].map((s) => ({ value: s, label: s })) },
          ]}
          columns={[
            { key: 'username', header: 'Username' },
            { key: 'fullName', header: 'Full Name', editable: { onSave: (u, v) => saveField(u, 'fullName', v) } },
            { key: 'email', header: 'Email', editable: { inputType: 'email', onSave: (u, v) => saveField(u, 'email', v) } },
            { key: 'role', header: 'Role', searchable: false, render: (u) => ROLE_LABELS[u.role] },
            { key: 'branch', header: 'Branch', searchable: false, render: (u) => branchName(u.branch) },
            { key: 'failedAttempts', header: 'Failed Logins', searchable: false, align: 'right' },
            { key: 'lastLogin', header: 'Last Login', searchable: false, render: (u) => formatDateTime(u.lastLogin) },
            { key: 'status', header: 'Status', searchable: false, render: (u) => <StatusBadge status={u.status} /> },
          ]}
          actions={(u) =>
            u.username === me.username ? (
              <span className="text-xs text-slate-400">You</span>
            ) : (
              <Button size="sm" variant={u.status === 'Active' ? 'danger' : 'success'} testId={`toggle-user-btn-${u.username}`} onClick={() => toggle(u)}>
                {u.status === 'Active' ? 'Lock' : 'Unlock'}
              </Button>
            )
          }
        />
      </Card>

      <Modal
        open={open}
        title="Create User"
        testId="user-modal"
        size="lg"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" testId="user-form-cancel-btn" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button testId="user-form-submit-btn" onClick={submit}>
              Create User
            </Button>
          </>
        }
      >
        <form onSubmit={submit} noValidate data-testid="user-form" className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {formError && (
            <div className="md:col-span-2">
              <Alert testId="user-form-error">{formError}</Alert>
            </div>
          )}
          <Field id="user-form-username" label="Username" required error={err('username')}>
            <TextInput id="user-form-username" invalid={!!err('username')} {...register('username')} />
          </Field>
          <Field id="user-form-fullName" label="Full Name" required error={err('fullName')}>
            <TextInput id="user-form-fullName" invalid={!!err('fullName')} {...register('fullName')} />
          </Field>
          <Field id="user-form-email" label="Email" required error={err('email')}>
            <TextInput id="user-form-email" type="email" invalid={!!err('email')} {...register('email')} />
          </Field>
          <Field id="user-form-role" label="Role" required error={err('role')}>
            <SelectInput id="user-form-role" invalid={!!err('role')} placeholder="-- Select Role --" options={(Object.keys(ROLE_LABELS) as Role[]).map((r) => ({ value: r, label: ROLE_LABELS[r] }))} {...register('role')} />
          </Field>
          <Field id="user-form-branch" label="Branch" required error={err('branch')} hint="Admin and Auditor must use All Branches">
            <SelectInput id="user-form-branch" invalid={!!err('branch')} placeholder="-- Select Branch --" options={[{ value: 'ALL', label: 'All Branches' }, ...BRANCHES.map((b) => ({ value: b.code, label: b.name }))]} {...register('branch')} />
          </Field>
          <Field id="user-form-password" label="Password" required error={err('password')} hint={PASSWORD_MESSAGE}>
            <TextInput id="user-form-password" type="password" invalid={!!err('password')} {...register('password')} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
