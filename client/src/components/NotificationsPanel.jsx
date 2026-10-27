import { useEffect, useState } from 'react';
import api from '../api/axios';
import { Card, Alert, apiError } from './ui';

const TYPE_ICONS = { leave: '🌴', attendance: '🕒', profile: '👤', payroll: '💰', system: '🔔' };

export default function NotificationsPanel() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/notifications/me')
      .then(({ data }) => setItems(data.notifications))
      .catch((err) => setError(apiError(err, 'Could not load recent activity')));
  }, []);

  const markRead = async (id) => {
    setItems((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
    try {
      await api.patch(`/notifications/${id}/read`);
    } catch (err) {
      setItems((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: false } : n)));
      setError(apiError(err, 'Could not mark the notification as read'));
    }
  };

  return (
    <Card>
      <h2 className="mb-3 font-semibold text-slate-700">Recent activity</h2>
      <Alert>{error}</Alert>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing new yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((n) => (
            <li
              key={n._id}
              onClick={() => !n.isRead && markRead(n._id)}
              className={`flex cursor-pointer items-start gap-2 py-2 text-sm ${
                n.isRead ? 'text-slate-400' : 'text-slate-700'
              }`}
            >
              <span>{TYPE_ICONS[n.type] || '🔔'}</span>
              <div className="flex-1">
                <p>{n.message}</p>
                <p className="text-xs text-slate-400">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              {!n.isRead && <span className="mt-1 h-2 w-2 rounded-full" style={{ backgroundColor: '#2563EB' }} />}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
