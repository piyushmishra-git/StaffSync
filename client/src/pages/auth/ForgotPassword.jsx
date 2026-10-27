import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { Card, Field, Input, Button, Alert, apiError } from '../../components/ui';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState({ busy: false, error: '', done: false });

  const onSubmit = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: '', done: false });
    try {
      await api.post('/auth/forgot-password', { email });
      setState({ busy: false, error: '', done: true });
    } catch (err) {
      setState({ busy: false, error: apiError(err, 'Could not send the reset link'), done: false });
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
        <h1 className="mb-1 text-xl font-semibold text-slate-800">Reset your password</h1>
        <p className="mb-4 text-sm text-slate-500">
          Enter your work email and we'll send a reset link valid for 30 minutes.
        </p>

        <div className="space-y-3">
          <Alert>{state.error}</Alert>
          {state.done ? (
            <Alert kind="success">
              If an account exists for that email, a password reset link has been sent. Check your
              inbox (and the server console in development).
            </Alert>
          ) : (
            <form onSubmit={onSubmit} className="space-y-3">
              <Field label="Email">
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Button type="submit" disabled={state.busy} className="w-full">
                {state.busy ? 'Sending…' : 'Send reset link'}
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
