import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { Card, Field, Input, Select, Button, Alert, Spinner, apiError } from '../../components/ui';
import { Avatar, DocumentsCard } from '../../components/ProfileView';
import MonthlyLeaveTable from '../../components/MonthlyLeaveTable';

const emptyForm = (p) => ({
  personal: {
    firstName: p.personal?.firstName || '',
    lastName: p.personal?.lastName || '',
    phone: p.personal?.phone || '',
    address: p.personal?.address || '',
    emergencyContact: p.personal?.emergencyContact || '',
  },
  job: {
    designation: p.job?.designation || '',
    department: p.job?.department || '',
    joiningDate: p.job?.joiningDate ? p.job.joiningDate.slice(0, 10) : '',
    employmentType: p.job?.employmentType || 'full-time',
  },
  salary: {
    basic: p.salary?.basic ?? 0,
    hra: p.salary?.hra ?? 0,
    allowances: p.salary?.allowances ?? 0,
    deductions: p.salary?.deductions ?? 0,
    currency: p.salary?.currency || 'INR',
  },
});

const THIS_YEAR = new Date().getFullYear();
const YEARS = [THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1, THIS_YEAR + 2];

export default function EmployeeDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState({ kind: 'info', text: '' });
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [leaveMonths, setLeaveMonths] = useState([]);
  const [loadError, setLoadError] = useState('');

  const [managers, setManagers] = useState([]);
  const [account, setAccount] = useState({ role: 'employee', managerId: '', isActive: true });
  const [accountBusy, setAccountBusy] = useState(false);
  const [auxError, setAuxError] = useState('');

  const [balanceYear, setBalanceYear] = useState(THIS_YEAR);
  const [balanceRows, setBalanceRows] = useState([]);
  const [entitlements, setEntitlements] = useState({ paid: 0, sick: 0 });
  const [balanceError, setBalanceError] = useState('');
  const [balanceBusy, setBalanceBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/profiles/${userId}`)
      .then(({ data }) => {
        if (cancelled) return;
        setProfile(data.profile);
        setForm(emptyForm(data.profile));
        setAccount({
          role: data.profile.user?.role || 'employee',
          managerId: data.profile.user?.manager ? String(data.profile.user.manager) : '',
          isActive: data.profile.user?.isActive !== false,
        });
        setLoadError('');
      })
      .catch((err) => {
        if (!cancelled) setLoadError(apiError(err, 'Could not load this employee'));
      });
    api
      .get('/attendance/leave-summary/' + userId)
      .then(({ data }) => {
        if (!cancelled) setLeaveMonths(data.months);
      })
      .catch((err) => {
        if (!cancelled) setAuxError(apiError(err, 'Could not load the leave summary'));
      });
    api
      .get('/admin/managers')
      .then(({ data }) => {
        if (!cancelled) setManagers(data.managers);
      })
      .catch((err) => {
        if (!cancelled) setAuxError(apiError(err, 'Could not load manager options'));
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const loadBalances = useCallback(async () => {
    const { data } = await api.get(`/leaves/balances/${userId}`, {
      params: { year: balanceYear },
    });
    setBalanceRows(data.balances);
    setEntitlements({
      paid: data.balances.find((b) => b.type === 'paid')?.entitled ?? 0,
      sick: data.balances.find((b) => b.type === 'sick')?.entitled ?? 0,
    });
    setBalanceError('');
  }, [userId, balanceYear]);

  useEffect(() => {
    loadBalances().catch((err) =>
      setBalanceError(apiError(err, 'Could not load leave balances'))
    );
  }, [loadBalances]);

  if (loadError) {
    return (
      <div className="space-y-4">
        <Link to="/admin/employees" className="text-sm hover:underline" style={{ color: '#2563EB' }}>
          ← Directory
        </Link>
        <Alert>{loadError}</Alert>
      </div>
    );
  }

  if (!profile || !form) return <Spinner />;

  const set = (section, key, isNumber) => (e) =>
    setForm({
      ...form,
      [section]: { ...form[section], [key]: isNumber ? Number(e.target.value) : e.target.value },
    });

  const isOwnAccount = String(profile.user?._id || profile.user?.id || '') === String(me?.id || '');

  const deleteAccount = async () => {
    setDeleting(true);
    setMsg({ kind: 'info', text: '' });
    try {
      await api.delete(`/profiles/${userId}`);
      navigate('/admin/employees', { replace: true });
    } catch (err) {
      setMsg({ kind: 'error', text: apiError(err) });
      setConfirmDelete(false);
      setDeleting(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg({ kind: 'info', text: '' });
    try {
      const payload = {
        ...form,
        job: { ...form.job, joiningDate: form.job.joiningDate || undefined },
      };
      const { data } = await api.put(`/profiles/${userId}`, payload);
      setProfile(data.profile);
      setMsg({ kind: 'success', text: 'Profile saved.' });
    } catch (err) {
      setMsg({ kind: 'error', text: apiError(err) });
    } finally {
      setBusy(false);
    }
  };

  const saveAccount = async (e) => {
    e.preventDefault();
    setAccountBusy(true);
    setMsg({ kind: 'info', text: '' });
    try {
      const { data } = await api.patch(`/admin/employees/${userId}`, {
        role: account.role,
        managerId: account.managerId || null,
        isActive: account.isActive,
      });
      setProfile((prev) => ({ ...prev, user: { ...prev.user, ...data.user } }));
      setMsg({
        kind: 'success',
        text: data.user.isActive
          ? 'Account settings saved.'
          : 'Account deactivated. The employee has been signed out everywhere.',
      });
    } catch (err) {
      setMsg({ kind: 'error', text: apiError(err, 'Could not update the account') });
    } finally {
      setAccountBusy(false);
    }
  };

  const saveEntitlements = async (e) => {
    e.preventDefault();
    setBalanceBusy(true);
    setBalanceError('');
    try {
      const { data } = await api.put(`/leaves/entitlements/${userId}`, {
        year: balanceYear,
        entitlements: {
          paid: Number(entitlements.paid),
          sick: Number(entitlements.sick),
        },
      });
      setBalanceRows(data.balances);
      setMsg({ kind: 'success', text: `Leave entitlements saved for ${data.year}.` });
    } catch (err) {
      setBalanceError(apiError(err, 'Could not save leave entitlements'));
    } finally {
      setBalanceBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Link to="/admin/employees" className="text-sm hover:underline" style={{ color: '#2563EB' }}>
          ← Directory
        </Link>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar url={profile.profilePictureUrl} />
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-slate-800">
              {profile.personal?.firstName || profile.user?.employeeId}{' '}
              {profile.personal?.lastName || ''}
            </h1>
            <p className="text-sm text-slate-500">
              {profile.user?.email} · {profile.user?.employeeId} ·{' '}
              <span className="uppercase">{profile.user?.role}</span>
            </p>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              profile.user?.isActive
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {profile.user?.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </Card>

      <Alert kind={msg.kind}>{msg.text}</Alert>
      <Alert>{auxError}</Alert>

      <Card>
        <h2 className="mb-3 font-semibold text-slate-700">Account & access</h2>
        <form onSubmit={saveAccount} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <Field label="Role">
            <Select
              value={account.role}
              onChange={(e) => setAccount({ ...account, role: e.target.value })}
              disabled={isOwnAccount}
            >
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="admin">HR / Admin</option>
            </Select>
          </Field>
          <Field label="Reports to">
            <Select
              value={account.managerId}
              onChange={(e) => setAccount({ ...account, managerId: e.target.value })}
            >
              <option value="">No manager</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.employeeId} · {m.email}
                  {m.name ? ` (${m.name})` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={account.isActive}
              disabled={isOwnAccount}
              onChange={(e) => setAccount({ ...account, isActive: e.target.checked })}
            />
            Active account
          </label>
          <Button type="submit" disabled={accountBusy}>
            {accountBusy ? 'Saving…' : 'Save account settings'}
          </Button>
        </form>
        {isOwnAccount && (
          <p className="mt-2 text-xs text-slate-500">
            You cannot change your own role or deactivate your own account.
          </p>
        )}
      </Card>

      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 font-semibold text-slate-700">Personal</h2>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="First name">
                  <Input value={form.personal.firstName} onChange={set('personal', 'firstName')} />
                </Field>
                <Field label="Last name">
                  <Input value={form.personal.lastName} onChange={set('personal', 'lastName')} />
                </Field>
              </div>
              <Field label="Phone">
                <Input value={form.personal.phone} onChange={set('personal', 'phone')} />
              </Field>
              <Field label="Address">
                <Input value={form.personal.address} onChange={set('personal', 'address')} />
              </Field>
              <Field label="Emergency contact">
                <Input
                  value={form.personal.emergencyContact}
                  onChange={set('personal', 'emergencyContact')}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold text-slate-700">Job</h2>
            <div className="space-y-3">
              <Field label="Designation">
                <Input value={form.job.designation} onChange={set('job', 'designation')} />
              </Field>
              <Field label="Department">
                <Input value={form.job.department} onChange={set('job', 'department')} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Joining date">
                  <Input type="date" value={form.job.joiningDate} onChange={set('job', 'joiningDate')} />
                </Field>
                <Field label="Employment type">
                  <Select value={form.job.employmentType} onChange={set('job', 'employmentType')}>
                    <option value="full-time">Full-time</option>
                    <option value="part-time">Part-time</option>
                    <option value="contract">Contract</option>
                    <option value="intern">Intern</option>
                  </Select>
                </Field>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <h2 className="mb-3 font-semibold text-slate-700">Salary structure (admin only)</h2>
          <div className="grid gap-3 sm:grid-cols-5">
            <Field label="Basic">
              <Input type="number" min="0" value={form.salary.basic} onChange={set('salary', 'basic', true)} />
            </Field>
            <Field label="HRA">
              <Input type="number" min="0" value={form.salary.hra} onChange={set('salary', 'hra', true)} />
            </Field>
            <Field label="Allowances">
              <Input
                type="number"
                min="0"
                value={form.salary.allowances}
                onChange={set('salary', 'allowances', true)}
              />
            </Field>
            <Field label="Deductions">
              <Input
                type="number"
                min="0"
                value={form.salary.deductions}
                onChange={set('salary', 'deductions', true)}
              />
            </Field>
            <Field label="Currency">
              <Input value={form.salary.currency} onChange={set('salary', 'currency')} />
            </Field>
          </div>
        </Card>

        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save all changes'}
        </Button>
      </form>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-700">Leave balances</h2>
          <Select
            value={balanceYear}
            onChange={(e) => setBalanceYear(Number(e.target.value))}
            className="max-w-32"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
        <Alert>{balanceError}</Alert>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Entitled</th>
              <th className="py-2 pr-4">Approved</th>
              <th className="py-2 pr-4">Pending</th>
              <th className="py-2">Available</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {balanceRows.map((b) => (
              <tr key={b.type}>
                <td className="py-2 pr-4 capitalize">{b.type}</td>
                <td className="py-2 pr-4">{b.entitled}</td>
                <td className="py-2 pr-4">{b.used}</td>
                <td className="py-2 pr-4">{b.pending}</td>
                <td className="py-2 font-semibold text-slate-800">{b.available}</td>
              </tr>
            ))}
            {balanceRows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-slate-500">
                  No balance data.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <form onSubmit={saveEntitlements} className="mt-4 flex flex-wrap items-end gap-3">
          <Field label="Paid entitlement (days)">
            <Input
              type="number"
              min="0"
              max="366"
              value={entitlements.paid}
              onChange={(e) => setEntitlements({ ...entitlements, paid: e.target.value })}
              className="w-40"
            />
          </Field>
          <Field label="Sick entitlement (days)">
            <Input
              type="number"
              min="0"
              max="366"
              value={entitlements.sick}
              onChange={(e) => setEntitlements({ ...entitlements, sick: e.target.value })}
              className="w-40"
            />
          </Field>
          <Button type="submit" variant="secondary" disabled={balanceBusy}>
            {balanceBusy ? 'Saving…' : 'Save entitlements'}
          </Button>
        </form>
      </Card>

      <DocumentsCard documents={profile.documents} />

      <MonthlyLeaveTable title="Leaves by month" months={leaveMonths} />

      {!isOwnAccount && (
        <Card className="border-red-200">
          <h2 className="mb-1 font-semibold text-red-700">Danger zone</h2>
          {confirmDelete ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                This permanently removes {profile.user?.email} and all of their attendance, leave,
                payroll and notification data. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button variant="danger" onClick={deleteAccount} disabled={deleting}>
                  {deleting ? 'Deleting…' : 'Yes, delete this account'}
                </Button>
                <Button variant="secondary" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Permanently delete this account and every record tied to it. To keep records but
                block access, deactivate the account instead.
              </p>
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                Delete this account
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
