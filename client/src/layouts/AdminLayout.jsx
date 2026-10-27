import { Outlet } from 'react-router-dom';
import AppShell from '../components/AppShell';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: '📊', end: true },
  { to: '/admin/employees', label: 'Employee Directory', icon: '🗂️' },
  { to: '/admin/attendance', label: 'Attendance Records', icon: '🕒' },
  { to: '/admin/leaves', label: 'Leave Approvals', icon: '✅' },
  { to: '/admin/payroll', label: 'Payroll', icon: '💰' },
  { to: '/admin/reports', label: 'Reports', icon: '📈' },
  { to: '/admin/announcements', label: 'Announcements', icon: '📣' },
  { to: '/admin/training', label: 'Training', icon: '🎓' },
  { to: '/admin/holidays', label: 'Holidays', icon: '📅' },
  { to: '/admin/security', label: 'Security', icon: '🔒' },
];

export default function AdminLayout() {
  return (
    <AppShell title="StaffSync Admin" nav={NAV}>
      <Outlet />
    </AppShell>
  );
}
