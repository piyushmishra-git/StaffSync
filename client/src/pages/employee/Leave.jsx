import { useCallback, useEffect, useState } from 'react';
import api from '../../api/axios';
import { Card, Field, Input, Select, Button, Alert, apiError } from '../../components/ui';
import StatusBadge from '../../components/StatusBadge';
import LeaveCalendar from '../../components/LeaveCalendar';
import MonthlyLeaveTable from '../../components/MonthlyLeaveTable';

const isoDay = (d) => d.toISOString().slice(0, 10);
const fmt = (d) => new Date(d).toLocaleDateString();
const fmtHoliday = (d) =>
  new Date(d).toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

export default function EmployeeLeave() {
  const [month, setMonth] = useState(new Date());
  const [monthLeaves, setMonthLeaves] = useState([]);
  const [history, setHistory] = useState([]);
  const [leaveMonths, setLeaveMonths] = useState([]);
  const [balances, setBalances] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [form, setForm] = useState({ type: 'paid', startDate: '', endDate: '', remarks: '' });
  const [msg, setMsg] = useState({ kind: 'info', text: '' });
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadMonth = useCallback(async () => {
    const from = new Date(month.getFullYear(), month.getMonth(), 1);
    const to = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const { data } = await api.get('/leaves/me', { params: { from: isoDay(from), to: isoDay(to) } });
    setMonthLeaves(data.requests);
  }, [month]);

  const loadHistory = useCallback(async () => {
    const { data } = await api.get('/leaves/me');
    setHistory(data.requests);
  }, []);

  const loadSummary = useCallback(async () => {
    const { data } = await api.get('/attendance/me/leave-summary');
    setLeaveMonths(data.months);
  }, []);

  const loadBalances = useCallback(async () => {
    const { data } = await api.get('/leaves/balances');
    setBalances(data);
  }, []);

  const loadHolidays = useCallback(async () => {
    const { data } = await api.get('/holidays', { params: { from: isoDay(new Date()) } });
    setHolidays(data.holidays.slice(0, 5));
  }, []);

  useEffect(() => {
    loadMonth().catch((err) => setLoadError(apiError(err, 'Could not load your leave calendar')));
  }, [loadMonth]);

  useEffect(() => {
    loadHistory().catch((err) => setLoadError(apiError(err, 'Could not load your leave history')));
    const auxiliary = (message) => (err) =>
      setLoadError((prev) => prev || apiError(err, message));
    loadSummary().catch(auxiliary('Could not load your monthly leave summary'));
    loadBalances().catch(auxiliary('Could not load your leave balance'));
    loadHolidays().catch(auxiliary('Could not load upcoming holidays'));
  }, [loadHistory, loadSummary, loadBalances, loadHolidays]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg({ kind: 'info', text: '' });
    try {
      await api.post('/leaves', form);
      setMsg({ kind: 'success', text: 'Leave request submitted for approval.' });
      setForm({ type: 'paid', startDate: '', endDate: '', remarks: '' });
      await Promise.all([loadMonth(), loadHistory(), loadBalances()]);
    } catch (err) {
      setMsg({ kind: 'error', text: apiError(err) });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id) => {
    setMsg({ kind: 'info', text: '' });
    try {
      await api.delete(`/leaves/${id}`);
      setMsg({ kind: 'success', text: 'Leave request cancelled.' });
      await Promise.all([loadMonth(), loadHistory(), loadBalances()]);
    } catch (err) {
      setMsg({ kind: 'error', text: apiError(err) });
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">Leave & time off</h1>
      <Alert kind={msg.kind}>{msg.text}</Alert>
      <Alert>{loadError}</Alert>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold text-slate-700">Request leave</h2>
          <form onSubmit={submit} className="space-y-3">
            <Field label="Leave type">
              <Select value={form.type} onChange={set('type')}>
                <option value="paid">Paid leave</option>
                <option value="sick">Sick leave</option>
                <option value="unpaid">Unpaid leave</option>
              </Select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="From">
                <Input type="date" required value={form.startDate} onChange={set('startDate')} />
              </Field>
              <Field label="To">
                <Input type="date" required value={form.endDate} onChange={set('endDate')} />
              </Field>
            </div>
            <p className="text-xs text-slate-500">
              Weekends and public holidays are excluded from the working-day count and balance.
            </p>
            <Field label="Remarks (optional)">
              <textarea
                value={form.remarks}
                onChange={set('remarks')}
                rows={3}
                maxLength={500}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Reason or notes for HR…"
              />
            </Field>
            <Button type="submit" disabled={busy}>
              {busy ? 'Submitting…' : 'Submit request'}
            </Button>
          </form>
        </Card>

        <LeaveCalendar month={month} onMonthChange={setMonth} leaves={monthLeaves} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold text-slate-700">
            Leave balance{balances ? ` · ${balances.year}` : ''}
          </h2>
          {balances ? (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Entitled</th>
                  <th className="py-2 pr-3">Approved</th>
                  <th className="py-2 pr-3">Pending</th>
                  <th className="py-2">Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {balances.balances.map((b) => (
                  <tr key={b.type}>
                    <td className="py-2 pr-3 capitalize">{b.type}</td>
                    <td className="py-2 pr-3">{b.entitled}</td>
                    <td className="py-2 pr-3">{b.used}</td>
                    <td className="py-2 pr-3">{b.pending}</td>
                    <td className="py-2 font-semibold text-slate-800">{b.available}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-slate-500">Balance unavailable.</p>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold text-slate-700">Upcoming holidays</h2>
          {holidays.length === 0 ? (
            <p className="text-sm text-slate-500">No upcoming holidays configured.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {holidays.map((h) => (
                <li key={h._id} className="flex items-center justify-between py-2">
                  <span className="font-medium text-slate-700">{h.name}</span>
                  <span className="text-slate-500">{fmtHoliday(h.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">From</th>
              <th className="px-4 py-3">To</th>
              <th className="px-4 py-3">Days</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">HR comment</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {history.map((r) => (
              <tr key={r._id}>
                <td className="px-4 py-2 capitalize">{r.type}</td>
                <td className="px-4 py-2">{fmt(r.startDate)}</td>
                <td className="px-4 py-2">{fmt(r.endDate)}</td>
                <td className="px-4 py-2">{r.days ?? '—'}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-2 text-slate-500">{r.adminComment || '—'}</td>
                <td className="px-4 py-2 text-right">
                  {r.status === 'pending' && (
                    <button onClick={() => cancel(r._id)} className="text-red-600 hover:underline">
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  You haven't requested any leave yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <MonthlyLeaveTable title="Your leaves by month" months={leaveMonths} />
    </div>
  );
}
