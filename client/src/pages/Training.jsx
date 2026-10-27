import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Card, Field, Input, Button, Alert, apiError } from '../components/ui';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');
const safeLink = (url) => /^https?:\/\//i.test(url || '');

const EMPTY = {
  title: '',
  category: 'General',
  description: '',
  startDate: '',
  endDate: '',
  link: '',
  mandatory: false,
};

export default function Training() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState({ kind: 'info', text: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get(isAdmin ? '/trainings/admin' : '/trainings');
    setItems(data.trainings);
  }, [isAdmin]);

  useEffect(() => {
    load().catch((err) =>
      setMsg({ kind: 'error', text: apiError(err, 'Could not load training programmes') })
    );
  }, [load]);

  const set = (key) => (e) =>
    setForm({ ...form, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg({ kind: 'info', text: '' });
    try {
      const payload = { ...form };
      if (!payload.startDate) delete payload.startDate;
      if (!payload.endDate) delete payload.endDate;
      await api.post('/trainings', payload);
      setForm(EMPTY);
      setMsg({ kind: 'success', text: 'Training programme created.' });
      await load();
    } catch (err) {
      setMsg({ kind: 'error', text: apiError(err, 'Could not create the training programme') });
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (item) => {
    setMsg({ kind: 'info', text: '' });
    try {
      await api.patch(`/trainings/${item._id}`, { isActive: !item.isActive });
      await load();
    } catch (err) {
      setMsg({ kind: 'error', text: apiError(err, 'Could not update the training programme') });
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    setMsg({ kind: 'info', text: '' });
    try {
      await api.delete(`/trainings/${item._id}`);
      setMsg({ kind: 'success', text: 'Training programme deleted.' });
      await load();
    } catch (err) {
      setMsg({ kind: 'error', text: apiError(err, 'Could not delete the training programme') });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Training</h1>
        <p className="text-sm text-slate-500">
          {isAdmin ? 'Create programmes and control what staff see.' : 'Learning programmes available to you.'}
        </p>
      </div>
      <Alert kind={msg.kind}>{msg.text}</Alert>

      {isAdmin && (
        <Card>
          <h2 className="mb-3 font-semibold text-slate-700">New training programme</h2>
          <form onSubmit={create} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Title">
                <Input required maxLength={120} value={form.title} onChange={set('title')} />
              </Field>
              <Field label="Category">
                <Input maxLength={60} value={form.category} onChange={set('category')} />
              </Field>
            </div>
            <Field label="Description">
              <textarea
                rows={2}
                maxLength={2000}
                value={form.description}
                onChange={set('description')}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Starts">
                <Input type="date" value={form.startDate} onChange={set('startDate')} />
              </Field>
              <Field label="Ends">
                <Input type="date" value={form.endDate} onChange={set('endDate')} />
              </Field>
            </div>
            <Field label="Link (optional)">
              <Input
                type="url"
                maxLength={500}
                placeholder="https://…"
                value={form.link}
                onChange={set('link')}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.mandatory} onChange={set('mandatory')} />
              Mandatory for staff
            </label>
            <Button type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Create programme'}
            </Button>
          </form>
        </Card>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {items.map((item) => (
          <Card key={item._id} className={item.isActive ? '' : 'opacity-70'}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold text-slate-800">{item.title}</h2>
                <p className="text-xs text-slate-500">
                  {item.category || 'General'} · {fmtDate(item.startDate)} → {fmtDate(item.endDate)}
                  {!item.isActive && ' · hidden from staff'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {item.mandatory && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                    Mandatory
                  </span>
                )}
                {isAdmin && (
                  <>
                    <Button variant="secondary" onClick={() => toggle(item)}>
                      {item.isActive ? 'Hide' : 'Publish'}
                    </Button>
                    <Button variant="danger" onClick={() => remove(item)}>
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
            {item.description && (
              <p className="mt-3 whitespace-pre-line text-sm text-slate-600">{item.description}</p>
            )}
            {safeLink(item.link) && (
              <a
                href={item.link}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-sm font-medium hover:underline"
                style={{ color: '#2563EB' }}
              >
                Open training material →
              </a>
            )}
          </Card>
        ))}
        {items.length === 0 && (
          <Card>
            <p className="text-sm text-slate-500">No training programmes yet.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
