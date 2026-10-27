import { useCallback, useEffect, useState } from 'react';
import api from '../../api/axios';
import { Card, Input, Select, Button, Alert, apiError } from '../../components/ui';
import StatusBadge from '../../components/StatusBadge';

const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');
const fmtDate = (d) => new Date(d).toLocaleDateString();

export default function AttendanceRecords({ canMarkAbsentees = true }) {
  const [data, setData] = useState({ records: [], total: 0, page: 1, pages: 1 });
  const [filters, setFilters] = useState({ from: '', to: '', status: '' });
  const [page, setPage] = useState(1);
  const [msg, setMsg] = useState({ kind: 'info', text: '' });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const params = { page, limit: 15 };
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    if (filters.status) params.status = filters.status;
    const { data } = await api.get('/attendance', { params });
    setData(data);
    setError('');
  }, [page, filters]);

  useEffect(() => {
    load().catch((err) => setError(apiError(err, 'Could not load attendance records')));
  }, [load]);

  const markAbsentees = async () => {
    setMsg({ kind: 'info', text: '' });
    try {
      const { data } = await api.post('/attendance/mark-absentees', {});
      const skipped =
        data.skipped === 'weekend'
          ? ' (weekend - nothing to mark)'
          : data.skipped === 'holiday'
            ? ' (holiday - nothing to mark)'
            : '';
      setMsg({ kind: 'success', text: `Marked ${data.marked} absentee(s) for today${skipped}.` });
      await load();
    } catch (err) {
      setMsg({ kind: 'error', text: apiError(err) });
    }
  };

  const set = (k) => (e) => {
    setFilters({ ...filters, [k]: e.target.value });
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-slate-800">
          {canMarkAbsentees ? 'Attendance records' : 'Team attendance'}
        </h1>
        {canMarkAbsentees && (
          <Button variant="secondary" onClick={markAbsentees}>
            Mark today's absentees
          </Button>
        )}
      </div>
      <Alert kind={msg.kind}>{msg.text}</Alert>
      <Alert>{error}</Alert>

      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm text-slate-600">
            From
            <Input type="date" value={filters.from} onChange={set('from')} />
          </label>
          <label className="text-sm text-slate-600">
            To
            <Input type="date" value={filters.to} onChange={set('to')} />
          </label>
          <label className="text-sm text-slate-600">
            Status
            <Select value={filters.status} onChange={set('status')}>
              <option value="">All</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="half-day">Half-day</option>
              <option value="leave">Leave</option>
            </Select>
          </label>
        </div>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Check in</th>
              <th className="px-4 py-3">Check out</th>
              <th className="px-4 py-3">Hours</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.records.map((r) => (
              <tr key={r._id}>
                <td className="px-4 py-2">
                  <div className="font-medium text-slate-800">{r.user?.employeeId}</div>
                  <div className="text-xs text-slate-500">{r.user?.email}</div>
                </td>
                <td className="px-4 py-2">{fmtDate(r.date)}</td>
                <td className="px-4 py-2">{fmtTime(r.checkIn)}</td>
                <td className="px-4 py-2">{fmtTime(r.checkOut)}</td>
                <td className="px-4 py-2">{r.workHours || '—'}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
            {data.records.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No records match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          Page {data.page} of {data.pages} · {data.total} records
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
