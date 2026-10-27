import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import { Card, Field, Input, Button, Alert, apiError } from '../../components/ui';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [state, setState] = useState({ status: 'verifying', message: '' });
  const [email, setEmail] = useState('');
  const [resend, setResend] = useState({ busy: false, message: '' });
  const requested = useRef(false);

  useEffect(() => {
    // StrictMode mounts effects twice in dev; only send the request once.
    if (requested.current) return;
    requested.current = true;

    const token = params.get('token');
    if (!token) {
      setState({ status: 'error', message: 'Missing verification token.' });
      return;
    }
    api
      .get('/auth/verify-email', { params: { token } })
      .then(() => setState({ status: 'ok', message: 'Your email is approved — you can sign in now.' }))
      .catch((err) => setState({ status: 'error', message: apiError(err, 'Verification failed') }));
  }, [params]);

  const resendLink = async (e) => {
    e.preventDefault();
    setResend({ busy: true, message: '' });
    try {
      await api.post('/auth/resend-verification', { email });
      setResend({
        busy: false,
        message: 'If an unverified account exists for this email, a new link is on its way. It is valid for 5 minutes.',
      });
    } catch (err) {
      setResend({ busy: false, message: apiError(err) });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <h1 className="mb-3 text-xl font-semibold">Email verification</h1>
        {state.status === 'verifying' && <p className="text-sm text-slate-500">Verifying…</p>}
        {state.status === 'ok' && (
          <div className="space-y-3">
            <Alert kind="success">{state.message}</Alert>
            <Link to="/login" className="inline-block font-medium hover:underline" style={{ color: '#2563EB' }}>
              Continue to sign in →
            </Link>
          </div>
        )}
        {state.status === 'error' && (
          <div className="space-y-4">
            <Alert>{state.message}</Alert>
            <form onSubmit={resendLink} className="space-y-3 text-left">
              <p className="text-sm text-slate-500">
                Link expired? Enter your email and we'll send a fresh one.
              </p>
              <Field label="Email">
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </Field>
              <Button type="submit" disabled={resend.busy} className="w-full">
                {resend.busy ? 'Sending…' : 'Resend verification email'}
              </Button>
              <Alert kind="info">{resend.message}</Alert>
            </form>
          </div>
        )}
      </Card>
    </div>
  );
}
