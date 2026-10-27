import { useState } from 'react';
import api from '../api/axios';
import { Card, Field, Input, Button, Alert, apiError } from '../components/ui';

export default function Security() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [msg, setMsg] = useState({ kind: 'info', text: '' });
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) {
      setMsg({ kind: 'error', text: 'New passwords do not match.' });
      return;
    }
    setBusy(true);
    setMsg({ kind: 'info', text: '' });
    try {
      await api.post('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      setMsg({
        kind: 'success',
        text: 'Password changed. Other devices have been signed out.',
      });
    } catch (err) {
      setMsg({ kind: 'error', text: apiError(err, 'Could not change the password') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Security</h1>
        <p className="text-sm text-slate-500">Change your password and sign out other sessions.</p>
      </div>

      <Card>
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="Current password">
            <Input
              type="password"
              required
              autoComplete="current-password"
              value={form.currentPassword}
              onChange={set('currentPassword')}
            />
          </Field>
          <Field label="New password">
            <Input
              type="password"
              required
              autoComplete="new-password"
              value={form.newPassword}
              onChange={set('newPassword')}
            />
          </Field>
          <Field label="Confirm new password">
            <Input
              type="password"
              required
              autoComplete="new-password"
              value={form.confirm}
              onChange={set('confirm')}
            />
          </Field>
          <p className="text-xs text-slate-500">
            Password needs 8+ characters with upper case, lower case and a number.
          </p>
          <Button type="submit" disabled={busy}>
            {busy ? 'Updating…' : 'Change password'}
          </Button>
        </form>
        <div className="mt-3">
          <Alert kind={msg.kind}>{msg.text}</Alert>
        </div>
      </Card>
    </div>
  );
}
