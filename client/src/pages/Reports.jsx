import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import { Card, Field, Input, Select, Button, Alert, apiError } from '../components/ui';
import StatusBadge from '../components/StatusBadge';

const pad = (n) => String(n).padStart(2, '0');
const localKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const monthStart = () => {
  const d = new Date();
  return localKey(new Date(d.getFullYear(), d.getMonth(), 1));
};

const fmtDate = (d) => new Date(d).toLocaleDateString();
const fmtTime = (d) =>
  d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

const ATTENDANCE_STATUSES = ['present', 'absent', 'half-day', 'leave'];
const LEAVE_STATUSES = ['pending', 'approved', 'rejected'];

function Tile({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-xl font-bold text-slate-800">{value ?? 0}</div>
    </div>
  );
}

export default function Reports() {
  const [tab, setTab] = useState('attendance');
  const [filters, setFilters] = useState({
    from: monthStart(),
    to: localKey(new Date()),
    status: '',
    type: '',
  });
  const [data, setData] = useState({ rows: [], summary: null });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ kind: 'info', text: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setMsg({ kind: 'info', text: '' });
    const params = {};
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    if (filters.status) params.status = filters.status;
    if (tab === 'leaves' && filters.type) params.type = filters.type;
    try {
      const { data: result } = await api.get(`/reports/${tab}`, { params });
      setData(result);
    } catch (err) {
      setData({ rows: [], summary: null });
      setMsg({ kind: 'error', text: apiError(err, 'Could not load the report') });
    } finally {
      setLoading(false);
    }
  }, [tab, filters]);

  useEffect(() => {
    load();
  }, [load]);

  const switchTab = (next) => {
    setTab(next);
    setFilters((prev) => ({ ...prev, status: '', type: '' }));
    setData({ rows: [], summary: null });
  };

  const set = (key) => (e) => setFilters({ ...filters, [key]: e.target.value });

  const downloadCsv = async () => {
    const params = {};
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    if (filters.status) params.status = filters.status;
    if (tab === 'leaves' && filters.type) params.type = filters.type;
    try {
      const response = await api.get(`/reports/${tab}.csv`, { params, responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${tab}-report-${localKey(new Date())}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMsg({ kind: 'error', text: apiError(err, 'Could not download the report') });
    }
  };

  const statusOptions = tab === 'attendance' ? ATTENDANCE_STATUSES : LEAVE_STATUSES;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Reports</h1>
          <p className="text-sm text-slate-500">
            Filter attendance and leave records, then export the result as CSV.
          </p>
        </div>
        <Button variant="secondary" onClick={downloadCsv}>
          Download CSV
        </Button>
      </div>

      <div className="flex gap-2">
        <Button variant={tab === 'attendance' ? 'primary' : 'secondary'} onClick={() => switchTab('attendance')}>
          Attendance
        </Button>
        <Button variant={tab === 'leaves' ? 'primary' : 'secondary'} onClick={() => switchTab('leaves')}>
          Leave
        </Button>
      </div>

      <Alert kind={msg.kind}>{msg.text}</Alert>

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="From">
            <Input type="date" value={filters.from} onChange={set('from')} />
          </Field>
          <Field label="To">
            <Input type="date" value={filters.to} onChange={set('to')} />
          </Field>
          <Field label="Status">
            <Select value={filters.status} onChange={set('status')}>
              <option value="">All</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          {tab === 'leaves' && (
            <Field label="Leave type">
              <Select value={filters.type} onChange={set('type')}>
                <option value="">All</option>
                <option value="paid">Paid</option>
                <option value="sick">Sick</option>
                <option value="unpaid">Unpaid</option>
              </Select>
            </Field>
          )}
        </div>
      </Card>

      {data.summary && (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {tab === 'attendance' ? (
            <>
              <Tile label="Records" value={data.summary.total} />
              <Tile label="Present" value={data.summary.present} />
              <Tile label="Absent" value={data.summary.absent} />
              <Tile label="Half-day" value={data.summary['half-day']} />
              <Tile label="Leave" value={data.summary.leave} />
            </>
          ) : (
            <>
              <Tile label="Requests" value={data.summary.total} />
              <Tile label="Working days" value={data.summary.days} />
              <Tile label="Pending" value={data.summary.pending} />
              <Tile label="Approved" value={data.summary.approved} />
              <Tile label="Rejected" value={data.summary.rejected} />
            </>
          )}
        </div>
      )}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Employee</th>
              {tab === 'attendance' ? (
                <>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Check in</th>
                  <th className="px-4 py-3">Check out</th>
                  <th className="px-4 py-3">Hours</th>
                  <th className="px-4 py-3">Status</th>
                </>
              ) : (
                <>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">From</th>
                  <th className="px-4 py-3">To</th>
                  <th className="px-4 py-3">Days</th>
                  <th className="px-4 py-3">Status</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.rows.map((row) => (
              <tr key={row._id}>
                <td className="px-4 py-2">
                  <div className="font-medium text-slate-800">{row.user?.employeeId}</div>
                  <div className="text-xs text-slate-500">{row.user?.email}</div>
                </td>
                {tab === 'attendance' ? (
                  <>
                    <td className="px-4 py-2">{fmtDate(row.date)}</td>
                    <td className="px-4 py-2">{fmtTime(row.checkIn)}</td>
                    <td className="px-4 py-2">{fmtTime(row.checkOut)}</td>
                    <td className="px-4 py-2">{row.workHours || '—'}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={row.status} />
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2 capitalize">{row.type}</td>
                    <td className="px-4 py-2">{fmtDate(row.startDate)}</td>
                    <td className="px-4 py-2">{fmtDate(row.endDate)}</td>
                    <td className="px-4 py-2">{row.days}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={row.status} />
                    </td>
                  </>
                )}
              </tr>
            ))}
            {!loading && data.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No records match these filters.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
