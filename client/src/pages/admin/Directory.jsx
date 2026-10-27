import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { Card, Field, Input, Select, Button, Alert, apiError } from '../../components/ui';
import { Avatar } from '../../components/ProfileView';

const EMPTY_EMPLOYEE = {
  employeeId: '',
  email: '',
  password: '',
  role: 'employee',
  managerId: '',
  firstName: '',
  lastName: '',
  designation: '',
  department: '',
  joiningDate: '',
  employmentType: 'full-time',
  basic: 0,
  hra: 0,
  allowances: 0,
  deductions: 0,
  currency: 'INR',
};

export default function Directory() {
  const [data, setData] = useState({ rows: [], total: 0, page: 1, pages: 1 });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [managers, setManagers] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_EMPLOYEE);
  const [msg, setMsg] = useState({ kind: 'info', text: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get('/profiles', { params: { page, limit: 10, search } });
    setData(data);
    setError('');
  }, [page, search]);

  useEffect(() => {
    const t = setTimeout(() => {
      load().catch((err) => setError(apiError(err, 'Could not load the employee directory')));
    }, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    api
      .get('/admin/managers')
      .then(({ data }) => setManagers(data.managers))
      .catch((err) => setError(apiError(err, 'Could not load manager options')));
  }, []);

  const set = (key, isNumber = false) => (e) =>
    setForm({ ...form, [key]: isNumber ? Number(e.target.value) : e.target.value });

  const createEmployee = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg({ kind: 'info', text: '' });
    try {
      await api.post('/admin/employees', {
        employeeId: form.employeeId.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        managerId: form.managerId || null,
        personal: { firstName: form.firstName, lastName: form.lastName },
        job: {
          designation: form.designation,
          department: form.department,
          joiningDate: form.joiningDate || undefined,
          employmentType: form.employmentType,
        },
        salary: {
          basic: form.basic,
          hra: form.hra,
          allowances: form.allowances,
          deductions: form.deductions,
          currency: form.currency,
        },
      });
      setForm(EMPTY_EMPLOYEE);
      setShowAdd(false);
      setMsg({ kind: 'success', text: 'Employee account created. They can sign in immediately.' });
      setPage(1);
      await load();
    } catch (err) {
      setMsg({ kind: 'error', text: apiError(err, 'Could not create the employee') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-slate-800">Employee directory</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search by email or employee ID…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
          <Button onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? 'Close form' : 'Add employee'}
          </Button>
        </div>
      </div>

      <Alert>{error}</Alert>
      <Alert kind={msg.kind}>{msg.text}</Alert>

      {showAdd && (
        <Card>
          <h2 className="mb-3 font-semibold text-slate-700">Create employee account</h2>
          <form onSubmit={createEmployee} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Employee ID">
                <Input required value={form.employeeId} onChange={set('employeeId')} />
              </Field>
              <Field label="Email">
                <Input type="email" required value={form.email} onChange={set('email')} />
              </Field>
              <Field label="Temporary password">
                <Input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={set('password')}
                />
              </Field>
              <Field label="Role">
                <Select value={form.role} onChange={set('role')}>
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                  <option value="admin">HR / Admin</option>
                </Select>
              </Field>
              <Field label="Manager (optional)">
                <Select value={form.managerId} onChange={set('managerId')}>
                  <option value="">No manager</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.employeeId} · {m.email}
                      {m.name ? ` (${m.name})` : ''}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="First name">
                <Input value={form.firstName} onChange={set('firstName')} />
              </Field>
              <Field label="Last name">
                <Input value={form.lastName} onChange={set('lastName')} />
              </Field>
              <Field label="Designation">
                <Input value={form.designation} onChange={set('designation')} />
              </Field>
              <Field label="Department">
                <Input value={form.department} onChange={set('department')} />
              </Field>
              <Field label="Joining date">
                <Input type="date" value={form.joiningDate} onChange={set('joiningDate')} />
              </Field>
              <Field label="Employment type">
                <Select value={form.employmentType} onChange={set('employmentType')}>
                  <option value="full-time">Full-time</option>
                  <option value="part-time">Part-time</option>
                  <option value="contract">Contract</option>
                  <option value="intern">Intern</option>
                </Select>
              </Field>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-600">Salary structure</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Field label="Basic">
                  <Input type="number" min="0" value={form.basic} onChange={set('basic', true)} />
                </Field>
                <Field label="HRA">
                  <Input type="number" min="0" value={form.hra} onChange={set('hra', true)} />
                </Field>
                <Field label="Allowances">
                  <Input
                    type="number"
                    min="0"
                    value={form.allowances}
                    onChange={set('allowances', true)}
                  />
                </Field>
                <Field label="Deductions">
                  <Input
                    type="number"
                    min="0"
                    value={form.deductions}
                    onChange={set('deductions', true)}
                  />
                </Field>
                <Field label="Currency">
                  <Input value={form.currency} onChange={set('currency')} />
                </Field>
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? 'Creating…' : 'Create account'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setForm(EMPTY_EMPLOYEE);
                  setShowAdd(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Employee ID</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Designation</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.rows.map(({ user, profile }) => (
              <tr key={user.id} className="hover:bg-slate-50">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-3">
                    <Avatar url={profile?.profilePictureUrl} size="h-8 w-8" />
                    <div>
                      <div className="font-medium text-slate-800">
                        {profile?.personal?.firstName
                          ? `${profile.personal.firstName} ${profile.personal.lastName || ''}`
                          : '—'}
                      </div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2 font-mono text-xs">{user.employeeId}</td>
                <td className="px-4 py-2">{profile?.job?.department || '—'}</td>
                <td className="px-4 py-2">{profile?.job?.designation || '—'}</td>
                <td className="px-4 py-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase text-slate-600">
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      user.isActive
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <Link to={`/admin/employees/${user.id}`} className="hover:underline" style={{ color: '#2563EB' }}>
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
            {data.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No employees found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          Page {data.page} of {data.pages} · {data.total} people
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ← Prev
          </Button>
          <Button variant="secondary" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>
            Next →
          </Button>
        </div>
      </div>
    </div>
  );
}
