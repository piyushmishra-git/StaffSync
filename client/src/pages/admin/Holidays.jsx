import { useCallback, useEffect, useState } from 'react';
import api from '../../api/axios';
import { Card, Field, Input, Button, Alert, apiError } from '../../components/ui';

const fmt = (d) =>
  new Date(d).toLocaleDateString([], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

export default function Holidays() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name: '', date: '' });
  const [msg, setMsg] = useState({ kind: 'info', text: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get('/holidays');
    setItems(data.holidays);
  }, []);

  useEffect(() => {
    load().catch((err) => setMsg({ kind: 'error', text: apiError(err, 'Could not load holidays') }));
  }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg({ kind: 'info', text: '' });
    try {
      await api.post('/holidays', form);
      setForm({ name: '', date: '' });
      setMsg({ kind: 'success', text: 'Holiday added.' });
      await load();
    } catch (err) {
      setMsg({ kind: 'error', text: apiError(err, 'Could not add the holiday') });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Remove ${item.name}?`)) return;
    setMsg({ kind: 'info', text: '' });
    try {
      await api.delete(`/holidays/${item._id}`);
      setMsg({ kind: 'success', text: 'Holiday removed.' });
      await load();
    } catch (err) {
      setMsg({ kind: 'error', text: apiError(err, 'Could not remove the holiday') });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Holidays</h1>
        <p className="text-sm text-slate-500">
          Holidays and weekends are excluded from leave day counts.
        </p>
      </div>
      <Alert kind={msg.kind}>{msg.text}</Alert>

      <Card>
        <h2 className="mb-3 font-semibold text-slate-700">Add a holiday</h2>
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <Field label="Name">
            <Input
              required
              maxLength={120}
              placeholder="e.g. Diwali"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Date">
            <Input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? 'Adding…' : 'Add holiday'}
          </Button>
        </form>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Holiday</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((h) => (
              <tr key={h._id}>
                <td className="px-4 py-2 font-medium text-slate-800">{h.name}</td>
                <td className="px-4 py-2">{fmt(h.date)}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => remove(h)} className="text-red-600 hover:underline">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                  No holidays configured.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
