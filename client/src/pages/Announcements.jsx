import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Card, Field, Input, Button, Alert, apiError } from '../components/ui';

const fmt = (d) => new Date(d).toLocaleString();

export default function Announcements() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ title: '', body: '' });
  const [msg, setMsg] = useState({ kind: 'info', text: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get(isAdmin ? '/announcements/admin' : '/announcements');
    setItems(data.announcements);
  }, [isAdmin]);

  useEffect(() => {
    load().catch((err) =>
      setMsg({ kind: 'error', text: apiError(err, 'Could not load announcements') })
    );
  }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg({ kind: 'info', text: '' });
    try {
      await api.post('/announcements', form);
      setForm({ title: '', body: '' });
      setMsg({ kind: 'success', text: 'Announcement published.' });
      await load();
    } catch (err) {
      setMsg({ kind: 'error', text: apiError(err, 'Could not publish the announcement') });
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (item) => {
    setMsg({ kind: 'info', text: '' });
    try {
      await api.patch(`/announcements/${item._id}`, { isActive: !item.isActive });
      await load();
    } catch (err) {
      setMsg({ kind: 'error', text: apiError(err, 'Could not update the announcement') });
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    setMsg({ kind: 'info', text: '' });
    try {
      await api.delete(`/announcements/${item._id}`);
      setMsg({ kind: 'success', text: 'Announcement deleted.' });
      await load();
    } catch (err) {
      setMsg({ kind: 'error', text: apiError(err, 'Could not delete the announcement') });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Announcements</h1>
        <p className="text-sm text-slate-500">
          {isAdmin ? 'Publish company updates and manage what staff can see.' : 'Company updates from HR.'}
        </p>
      </div>
      <Alert kind={msg.kind}>{msg.text}</Alert>

      {isAdmin && (
        <Card>
          <h2 className="mb-3 font-semibold text-slate-700">New announcement</h2>
          <form onSubmit={create} className="space-y-3">
            <Field label="Title">
              <Input
                required
                maxLength={120}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </Field>
            <Field label="Message">
              <textarea
                required
                rows={3}
                maxLength={2000}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </Field>
            <Button type="submit" disabled={busy}>
              {busy ? 'Publishing…' : 'Publish'}
            </Button>
          </form>
        </Card>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item._id} className={item.isActive ? '' : 'opacity-70'}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold text-slate-800">{item.title}</h2>
                <p className="text-xs text-slate-500">
                  {fmt(item.createdAt)}
                  {item.createdBy?.email && ` · ${item.createdBy.email}`}
                  {!item.isActive && ' · hidden from staff'}
                </p>
              </div>
              {isAdmin && (
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => toggle(item)}>
                    {item.isActive ? 'Hide' : 'Publish'}
                  </Button>
                  <Button variant="danger" onClick={() => remove(item)}>
                    Delete
                  </Button>
                </div>
              )}
            </div>
            <p className="mt-3 whitespace-pre-line text-sm text-slate-600">{item.body}</p>
          </Card>
        ))}
        {items.length === 0 && (
          <Card>
            <p className="text-sm text-slate-500">No announcements yet.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
