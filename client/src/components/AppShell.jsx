import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui';

export default function AppShell({ title, nav, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 p-4 sm:flex" style={{ backgroundColor: '#142D4E' }}>
        <div className="mb-6 px-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ backgroundColor: '#2563EB' }}>
              S
            </div>
            <div>
              <div className="text-base font-bold tracking-tight text-white">StaffSync</div>
              <div className="text-xs" style={{ color: '#93C5FD' }}>A smarter way to manage people.</div>
            </div>
          </div>
          <div className="mt-3 border-t pt-3 text-xs font-medium" style={{ borderColor: 'rgba(255,255,255,0.12)', color: '#93C5FD' }}>{title}</div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-white'
                    : 'hover:text-white'
                }`
              }
              style={({ isActive }) => isActive
                ? { backgroundColor: '#2563EB', color: 'white' }
                : { color: '#CBD5E1' }
              }
            >
              <span className="mr-2">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <Button variant="secondary" onClick={onLogout} className="mt-4 w-full" style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#CBD5E1', border: '1px solid rgba(255,255,255,0.15)' }}>
          Sign out
        </Button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="sm:hidden text-base font-bold tracking-tight" style={{ color: '#142D4E' }}>StaffSync</span>
            <div className="font-semibold text-slate-700">{title}</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">
              {user?.email} · <span className="uppercase">{user?.employeeId}</span>
            </span>
            <span className="rounded-full px-2 py-0.5 text-xs font-semibold uppercase text-white" style={{ backgroundColor: '#2563EB' }}>
              {user?.role}
            </span>
            <Button variant="secondary" onClick={onLogout} className="sm:hidden">
              Sign out
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
