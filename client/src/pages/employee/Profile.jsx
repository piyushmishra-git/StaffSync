import { useEffect, useRef, useState } from 'react';
import api from '../../api/axios';
import { Card, Field, Input, Button, Alert, Spinner, apiError } from '../../components/ui';
import { Avatar, InfoGrid, SalaryCard, JobCard, DocumentsCard } from '../../components/ProfileView';

export default function EmployeeProfile() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState({ kind: 'info', text: '' });
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const pictureInput = useRef();
  const docInput = useRef();

  useEffect(() => {
    api
      .get('/profiles/me')
      .then(({ data }) => {
        setProfile(data.profile);
        setForm({
          firstName: data.profile.personal?.firstName || '',
          lastName: data.profile.personal?.lastName || '',
          phone: data.profile.personal?.phone || '',
          address: data.profile.personal?.address || '',
          emergencyContact: data.profile.personal?.emergencyContact || '',
        });
      })
      .catch((err) => setLoadError(apiError(err, 'Could not load your profile')));
  }, []);

  if (loadError) return <Alert>{loadError}</Alert>;

  if (!profile || !form) return <Spinner />;

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg({ kind: 'info', text: '' });
    try {
      const { data } = await api.patch('/profiles/me', { personal: form });
      setProfile(data.profile);
      setMsg({ kind: 'success', text: 'Profile updated.' });
    } catch (err) {
      setMsg({ kind: 'error', text: apiError(err) });
    } finally {
      setBusy(false);
    }
  };

  const upload = async (endpoint, file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    setBusy(true);
    setMsg({ kind: 'info', text: '' });
    try {
      const { data } = await api.post(endpoint, fd);
      setProfile(data.profile);
      setMsg({ kind: 'success', text: 'Upload complete.' });
    } catch (err) {
      setMsg({ kind: 'error', text: apiError(err, 'Upload failed') });
    } finally {
      setBusy(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-4">
          <Avatar url={profile.profilePictureUrl} />
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-slate-800">
              {profile.personal?.firstName || profile.user?.employeeId}{' '}
              {profile.personal?.lastName || ''}
            </h1>
            <p className="text-sm text-slate-500">
              {profile.user?.email} · {profile.user?.employeeId}
            </p>
          </div>
          <Button variant="secondary" onClick={() => pictureInput.current.click()} disabled={busy}>
            Change photo
          </Button>
          <input
            ref={pictureInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => upload('/profiles/me/picture', e.target.files[0])}
          />
        </div>
      </Card>

      <Alert kind={msg.kind}>{msg.text}</Alert>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold text-slate-700">Contact details (editable)</h2>
          <form onSubmit={save} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="First name">
                <Input value={form.firstName} onChange={set('firstName')} />
              </Field>
              <Field label="Last name">
                <Input value={form.lastName} onChange={set('lastName')} />
              </Field>
            </div>
            <Field label="Phone">
              <Input value={form.phone} onChange={set('phone')} />
            </Field>
            <Field label="Address">
              <Input value={form.address} onChange={set('address')} />
            </Field>
            <Field label="Emergency contact">
              <Input value={form.emergencyContact} onChange={set('emergencyContact')} />
            </Field>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </Button>
          </form>
        </Card>

        <div className="space-y-4">
          <JobCard job={profile.job} />
          <SalaryCard salary={profile.salary} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DocumentsCard documents={profile.documents} />
        <Card>
          <h2 className="mb-3 font-semibold text-slate-700">Upload a document</h2>
          <p className="mb-3 text-sm text-slate-500">PDF or image, up to 5 MB.</p>
          <Button variant="secondary" onClick={() => docInput.current.click()} disabled={busy}>
            Choose file…
          </Button>
          <input
            ref={docInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => upload('/profiles/me/documents', e.target.files[0])}
          />
        </Card>
      </div>
    </div>
  );
}
