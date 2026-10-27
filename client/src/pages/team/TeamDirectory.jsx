import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { Card, Input, Button, Alert, apiError } from '../../components/ui';
import { Avatar } from '../../components/ProfileView';

export default function TeamDirectory() {
  const [data, setData] = useState({ rows: [], total: 0, page: 1, pages: 1 });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      api
        .get('/profiles/team', { params: { page, limit: 10, search } })
        .then(({ data }) => {
          setData(data);
          setError('');
        })
        .catch((err) => setError(apiError(err, 'Could not load your team')));
    }, 250);
    return () => clearTimeout(t);
  }, [page, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">My team</h1>
          <p className="text-sm text-slate-500">Direct reports assigned to you by HR.</p>
        </div>
        <Input
          placeholder="Search by email or employee ID…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
      </div>

      <Alert>{error}</Alert>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Employee ID</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Designation</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.rows.map(({ user, profile }) => (
              <tr key={user.id} className="hover:bg-slate-50">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-3">
                    <Avatar url={profile?.profilePictureUrl} size="h-8 w-8" />
                    <div>
                      <div className="font-medium text-slate-800">
                        {profile?.personal?.firstName
                          ? `${profile.personal.firstName} ${profile.personal.lastName || ''}`
                          : '—'}
                      </div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2 font-mono text-xs">{user.employeeId}</td>
                <td className="px-4 py-2">{profile?.job?.department || '—'}</td>
                <td className="px-4 py-2">{profile?.job?.designation || '—'}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      user.isActive
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <Link to={`/team/members/${user.id}`} className="hover:underline" style={{ color: '#2563EB' }}>
                    View →
                  </Link>
                </td>
              </tr>
            ))}
            {data.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No direct reports assigned yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          Page {data.page} of {data.pages} · {data.total} people
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ← Prev
          </Button>
          <Button variant="secondary" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>
            Next →
          </Button>
        </div>
      </div>
    </div>
  );
}
