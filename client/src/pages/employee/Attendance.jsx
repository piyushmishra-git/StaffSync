import { useCallback, useEffect, useState } from 'react';
import api from '../../api/axios';
import { Card, Button, Alert, apiError } from '../../components/ui';
import StatusBadge from '../../components/StatusBadge';

const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');
const fmtDate = (d) => new Date(d).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
const isoDay = (d) => d.toISOString().slice(0, 10);

export default function EmployeeAttendance() {
  const [records, setRecords] = useState([]);
  const [msg, setMsg] = useState({ kind: 'info', text: '' });
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const { data } = await api.get('/attendance/me', { params: { from: isoDay(from) } });
    setRecords(data.records);
    setLoadError('');
  }, []);

  useEffect(() => {
    load().catch((err) => setLoadError(apiError(err, 'Could not load your attendance')));
  }, [load]);

  const todayKey = isoDay(new Date());
  const today = records.find((r) => r.date.slice(0, 10) === todayKey);

  const act = async (endpoint) => {
    setBusy(true);
    setMsg({ kind: 'info', text: '' });
    try {
      await api.post(endpoint);
      setMsg({
        kind: 'success',
        text: endpoint.endsWith('check-in') ? 'Checked in.' : 'Checked out.',
      });
      await load();
    } catch (err) {
      setMsg({ kind: 'error', text: apiError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">My attendance</h1>
      <Alert kind={msg.kind}>{msg.text}</Alert>
      <Alert>{loadError}</Alert>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-slate-700">Today</h2>
            <p className="text-sm text-slate-500">
              {today
                ? `Checked in ${fmtTime(today.checkIn)} · Checked out ${fmtTime(today.checkOut)}${
                    today.workHours ? ` · ${today.workHours}h` : ''
                  }`
                : 'Not checked in yet.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {today && <StatusBadge status={today.status} />}
            <Button
              variant="success"
              disabled={busy || Boolean(today?.checkIn)}
              onClick={() => act('/attendance/check-in')}
            >
              Check in
            </Button>
            <Button
              variant="danger"
              disabled={busy || !today?.checkIn || Boolean(today?.checkOut)}
              onClick={() => act('/attendance/check-out')}
            >
              Check out
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Check in</th>
              <th className="px-4 py-3">Check out</th>
              <th className="px-4 py-3">Hours</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.map((r) => (
              <tr key={r._id}>
                <td className="px-4 py-2">{fmtDate(r.date)}</td>
                <td className="px-4 py-2">{fmtTime(r.checkIn)}</td>
                <td className="px-4 py-2">{fmtTime(r.checkOut)}</td>
                <td className="px-4 py-2">{r.workHours || '—'}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No attendance recorded in the last 30 days.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
