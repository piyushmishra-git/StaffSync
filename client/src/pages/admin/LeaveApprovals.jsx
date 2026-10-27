import { useCallback, useEffect, useState } from 'react';
import api from '../../api/axios';
import { Card, Select, Button, Alert, Input, apiError } from '../../components/ui';
import StatusBadge from '../../components/StatusBadge';

const fmt = (d) => new Date(d).toLocaleDateString();

function RequestRow({ request, onDecide }) {
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const decide = async (status) => {
    setBusy(true);
    try {
      await onDecide(request._id, status, comment);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium text-slate-800">{request.user?.employeeId}</span>
          <span className="ml-2 text-sm text-slate-500">{request.user?.email}</span>
        </div>
        <StatusBadge status={request.status} />
      </div>
      <div className="text-sm text-slate-600">
        <span className="capitalize">{request.type}</span> leave · {fmt(request.startDate)} →{' '}
        {fmt(request.endDate)}
        {request.days ? <span className="ml-1 text-slate-500">({request.days} working day{request.days === 1 ? '' : 's'})</span> : null}
        {request.remarks && <span className="ml-2 italic text-slate-500">“{request.remarks}”</span>}
      </div>
      {request.status === 'pending' ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Feedback comment (optional)…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="max-w-sm"
          />
          <Button variant="success" disabled={busy} onClick={() => decide('approved')}>
            Approve
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => decide('rejected')}>
            Reject
          </Button>
        </div>
      ) : (
        <div className="text-xs text-slate-500">
          {request.adminComment && <>Comment: “{request.adminComment}” · </>}
          Reviewed by {request.reviewedBy?.employeeId || '—'}
          {request.reviewedAt && ` on ${fmt(request.reviewedAt)}`}
        </div>
      )}
    </li>
  );
}

export default function LeaveApprovals() {
  const [data, setData] = useState({ requests: [], total: 0, page: 1, pages: 1 });
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [msg, setMsg] = useState({ kind: 'info', text: '' });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const params = { page, limit: 15 };
    if (status) params.status = status;
    const { data } = await api.get('/leaves', { params });
    setData(data);
    setError('');
  }, [page, status]);

  useEffect(() => {
    load().catch((err) => setError(apiError(err, 'Could not load leave requests')));
  }, [load]);

  const onDecide = async (id, decision, comment) => {
    setMsg({ kind: 'info', text: '' });
    try {
      await api.patch(`/leaves/${id}/decision`, { status: decision, adminComment: comment });
      setMsg({ kind: 'success', text: `Request ${decision}.` });
      await load();
    } catch (err) {
      setMsg({ kind: 'error', text: apiError(err) });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-slate-800">Leave approvals</h1>
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="max-w-40"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="">All</option>
        </Select>
      </div>
      <Alert kind={msg.kind}>{msg.text}</Alert>
      <Alert>{error}</Alert>

      <Card className="p-0">
        <ul className="divide-y divide-slate-100">
          {data.requests.map((r) => (
            <RequestRow key={r._id} request={r} onDecide={onDecide} />
          ))}
          {data.requests.length === 0 && (
            <li className="px-4 py-8 text-center text-slate-500">Queue is empty. 🎉</li>
          )}
        </ul>
      </Card>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          Page {data.page} of {data.pages} · {data.total} requests
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
