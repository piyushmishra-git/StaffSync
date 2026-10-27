import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, homePathFor } from '../../context/AuthContext';
import { Field, Input, Button, Alert, Card, apiError } from '../../components/ui';

export default function SignIn() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const notice = location.state?.notice;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(form.email, form.password);
      navigate(homePathFor(user), { replace: true });
    } catch (err) {
      setError(apiError(err, 'Sign in failed'));
    } finally {
      setBusy(false);
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
        <h1 className="mb-1 text-xl font-semibold text-slate-800">Sign in to your account</h1>
        <p className="mb-4 text-sm text-slate-500">Use your work email and password.</p>
        <div className="space-y-3">
          <Alert kind="info">{notice}</Alert>
          <Alert>{error}</Alert>
          <form onSubmit={onSubmit} className="space-y-3">
            <Field label="Email">
              <Input
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                required
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
            <div className="text-right">
              <Link to="/forgot-password" className="text-sm font-medium hover:underline" style={{ color: '#2563EB' }}>
                Forgot password?
              </Link>
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
          <p className="text-center text-sm text-slate-500">
            No account?{' '}
            <Link to="/register" className="font-medium hover:underline" style={{ color: '#2563EB' }}>
              Create one
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
