import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth, homePathFor } from './context/AuthContext';
import { ProtectedRoute, RoleRoute } from './routes/guards';
import { Spinner } from './components/ui';
import SignIn from './pages/auth/SignIn';
import SignUp from './pages/auth/SignUp';
import VerifyEmail from './pages/auth/VerifyEmail';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import EmployeeLayout from './layouts/EmployeeLayout';
import AdminLayout from './layouts/AdminLayout';
import EmployeeDashboard from './pages/employee/Dashboard';
import AdminDashboard from './pages/admin/Dashboard';
import EmployeeProfile from './pages/employee/Profile';
import Directory from './pages/admin/Directory';
import EmployeeDetail from './pages/admin/EmployeeDetail';
import EmployeeAttendance from './pages/employee/Attendance';
import AttendanceRecords from './pages/admin/AttendanceRecords';
import EmployeeLeave from './pages/employee/Leave';
import LeaveApprovals from './pages/admin/LeaveApprovals';
import EmployeePayroll from './pages/employee/Payroll';
import AdminPayroll from './pages/admin/Payroll';
import Announcements from './pages/Announcements';
import Training from './pages/Training';
import Security from './pages/Security';
import Reports from './pages/Reports';
import Holidays from './pages/admin/Holidays';
import TeamDirectory from './pages/team/TeamDirectory';
import TeamMember from './pages/team/TeamMember';

function Landing() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return <Navigate to={user ? homePathFor(user) : '/login'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<SignIn />} />
        <Route path="/register" element={<SignUp />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<RoleRoute roles={['employee', 'manager']} />}>
            <Route path="/app" element={<EmployeeLayout />}>
              <Route index element={<EmployeeDashboard />} />
              <Route path="profile" element={<EmployeeProfile />} />
              <Route path="attendance" element={<EmployeeAttendance />} />
              <Route path="leave" element={<EmployeeLeave />} />
              <Route path="payroll" element={<EmployeePayroll />} />
              <Route path="announcements" element={<Announcements />} />
              <Route path="training" element={<Training />} />
              <Route path="security" element={<Security />} />
            </Route>
          </Route>

          <Route element={<RoleRoute roles={['manager']} />}>
            <Route path="/team" element={<EmployeeLayout />}>
              <Route index element={<TeamDirectory />} />
              <Route path="members/:userId" element={<TeamMember />} />
              <Route path="attendance" element={<AttendanceRecords canMarkAbsentees={false} />} />
              <Route path="leaves" element={<LeaveApprovals />} />
              <Route path="reports" element={<Reports />} />
            </Route>
          </Route>

          <Route element={<RoleRoute roles={['admin']} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="employees" element={<Directory />} />
              <Route path="employees/:userId" element={<EmployeeDetail />} />
              <Route path="attendance" element={<AttendanceRecords />} />
              <Route path="leaves" element={<LeaveApprovals />} />
              <Route path="payroll" element={<AdminPayroll />} />
              <Route path="reports" element={<Reports />} />
              <Route path="announcements" element={<Announcements />} />
              <Route path="training" element={<Training />} />
              <Route path="holidays" element={<Holidays />} />
              <Route path="security" element={<Security />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
