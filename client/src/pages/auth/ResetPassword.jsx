import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import { Card, Field, Input, Button, Alert, apiError } from '../../components/ui';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [state, setState] = useState({ busy: false, error: '' });

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setState({ busy: false, error: 'Passwords do not match' });
      return;
    }
    setState({ busy: true, error: '' });
    try {
      await api.post('/auth/reset-password', { token, password: form.password });
      navigate('/login', {
        state: { notice: 'Password updated. Sign in with your new password.' },
      });
    } catch (err) {
      setState({ busy: false, error: apiError(err, 'Could not reset the password') });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold text-white" style={{ backgroundColor: '#142D4E' }}>
            <span style={{ color: '#2563EB' }}>S</span>
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight" style={{ color: '#142D4E' }}>StaffSync</div>
            <div className="text-xs text-slate-500">A smarter way to manage people.</div>
          </div>
        </div>
        <h1 className="mb-1 text-xl font-semibold text-slate-800">Choose a new password</h1>
        <p className="mb-4 text-sm text-slate-500">
          Password needs 8+ characters with upper case, lower case and a number.
        </p>

        <div className="space-y-3">
          <Alert>{state.error}</Alert>
          {!token ? (
            <Alert>
              This reset link is missing its token.{' '}
              <Link to="/forgot-password" className="font-medium underline">
                Request a new one
              </Link>
              .
            </Alert>
          ) : (
            <form onSubmit={onSubmit} className="space-y-3">
              <Field label="New password">
                <Input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={form.password}
                  onChange={set('password')}
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
              <Button type="submit" disabled={state.busy} className="w-full">
                {state.busy ? 'Updating…' : 'Update password'}
              </Button>
            </form>
          )}
          <p className="text-center text-sm text-slate-500">
            <Link to="/login" className="font-medium hover:underline" style={{ color: '#2563EB' }}>
              ← Back to sign in
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
