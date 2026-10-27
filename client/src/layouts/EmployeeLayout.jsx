import { Outlet } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { useAuth } from '../context/AuthContext';

const PERSONAL_NAV = [
  { to: '/app', label: 'Dashboard', icon: '🏠', end: true },
  { to: '/app/profile', label: 'My Profile', icon: '👤' },
  { to: '/app/attendance', label: 'Attendance', icon: '🕒' },
  { to: '/app/leave', label: 'Leave', icon: '🌴' },
  { to: '/app/payroll', label: 'Salary', icon: '💰' },
  { to: '/app/announcements', label: 'Announcements', icon: '📣' },
  { to: '/app/training', label: 'Training', icon: '🎓' },
  { to: '/app/security', label: 'Security', icon: '🔒' },
];

const MANAGER_NAV = [
  { to: '/team', label: 'My Team', icon: '👥', end: true },
  { to: '/team/attendance', label: 'Team Attendance', icon: '🕒' },
  { to: '/team/leaves', label: 'Team Leave', icon: '🌴' },
  { to: '/team/reports', label: 'Reports', icon: '📈' },
];

export default function EmployeeLayout() {
  const { user } = useAuth();
  const isManager = user?.role === 'manager';
  const nav = isManager ? [...MANAGER_NAV, ...PERSONAL_NAV] : PERSONAL_NAV;

  return (
    <AppShell title={isManager ? 'StaffSync Manager' : 'My StaffSync Portal'} nav={nav}>
      <Outlet />
    </AppShell>
  );
}
