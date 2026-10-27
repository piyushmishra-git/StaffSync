import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api/axios';
import { Card, Alert, Spinner, apiError } from '../../components/ui';
import { Avatar, InfoGrid, JobCard } from '../../components/ProfileView';
import MonthlyLeaveTable from '../../components/MonthlyLeaveTable';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');

export default function TeamMember() {
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [leaveMonths, setLeaveMonths] = useState([]);
  const [error, setError] = useState('');
  const [summaryError, setSummaryError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/profiles/${userId}`)
      .then(({ data }) => {
        if (!cancelled) setProfile(data.profile);
      })
      .catch((err) => {
        if (!cancelled) setError(apiError(err, 'Could not load this team member'));
      });
    api
      .get(`/attendance/leave-summary/${userId}`)
      .then(({ data }) => {
        if (!cancelled) setLeaveMonths(data.months);
      })
      .catch((err) => {
        if (!cancelled) setSummaryError(apiError(err, 'Could not load the leave summary'));
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (error) {
    return (
      <div className="space-y-4">
        <Link to="/team" className="text-sm hover:underline" style={{ color: '#2563EB' }}>
          ← My team
        </Link>
        <Alert>{error}</Alert>
      </div>
    );
  }

  if (!profile) return <Spinner />;

  const personal = profile.personal || {};
  const user = profile.user || {};

  return (
    <div className="space-y-4">
      <Link to="/team" className="text-sm hover:underline" style={{ color: '#2563EB' }}>
        ← My team
      </Link>

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar url={profile.profilePictureUrl} />
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-slate-800">
              {personal.firstName || user.employeeId} {personal.lastName || ''}
            </h1>
            <p className="text-sm text-slate-500">
              {user.email} · {user.employeeId} · <span className="capitalize">{user.role}</span>
            </p>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              user.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {user.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold text-slate-700">Contact details</h2>
          <InfoGrid
            rows={[
              ['Phone', personal.phone],
              ['Address', personal.address],
              ['Emergency contact', personal.emergencyContact],
              ['Date of birth', personal.dob ? fmtDate(personal.dob) : ''],
            ]}
          />
        </Card>
        <JobCard job={profile.job} />
      </div>

      <p className="text-xs text-slate-500">
        Salary and private documents are visible to HR only.
      </p>

      <Alert>{summaryError}</Alert>
      <MonthlyLeaveTable title="Leaves by month" months={leaveMonths} />
    </div>
  );
}
