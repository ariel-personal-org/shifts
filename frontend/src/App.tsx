import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';

// Pages
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import ScheduleView from './pages/ScheduleView';
import MyRequests from './pages/MyRequests';
import NotificationsPage from './pages/NotificationsPage';
import MyHistory from './pages/MyHistory';

// Admin pages
import AdminSchedules from './pages/admin/AdminSchedules';
import CreateSchedule from './pages/admin/CreateSchedule';
import ScheduleDetail from './pages/admin/ScheduleDetail';
import Teams from './pages/admin/Teams';
import Users from './pages/admin/Users';
import Requests from './pages/admin/Requests';
import AuditLog from './pages/admin/AuditLog';

function App() {
  const { isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            {/* User routes */}
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/schedules/:id" element={<ScheduleView />} />
            <Route path="/my-requests" element={<MyRequests />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/my-history" element={<MyHistory />} />

            {/* Admin routes */}
            <Route element={<AdminRoute />}>
              <Route path="/admin/schedules" element={<AdminSchedules />} />
              <Route path="/admin/schedules/new" element={<CreateSchedule />} />
              <Route path="/admin/schedules/:id" element={<ScheduleDetail />} />
              <Route path="/admin/teams" element={<Teams />} />
              <Route path="/admin/users" element={<Users />} />
              <Route path="/admin/requests" element={<Requests />} />
              <Route path="/admin/audit-log" element={<AuditLog />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
