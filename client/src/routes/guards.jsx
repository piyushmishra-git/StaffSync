import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, homePathFor } from '../context/AuthContext';
import { Spinner } from '../components/ui';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
}

// Client-side convenience only - the server enforces RBAC on every request.
export function RoleRoute({ role, roles }) {
  const { user, loading } = useAuth();
  const allowed = roles || [role];
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!allowed.includes(user.role)) return <Navigate to={homePathFor(user)} replace />;
  return <Outlet />;
}
