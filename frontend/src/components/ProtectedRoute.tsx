import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace />;
  // Force onboarding if display_name not set (skip if already on /onboard)
  if (user.display_name === null && location.pathname !== '/onboard') {
    return <Navigate to="/onboard" replace />;
  }
  return <Outlet />;
}
