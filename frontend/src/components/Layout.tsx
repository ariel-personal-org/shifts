import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-blue-50 text-blue-700'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        }`
      }
    >
      {children}
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <div className="flex items-center gap-6">
              <span className="font-bold text-blue-600 text-lg tracking-tight">ShiftSync</span>
              {/* User Nav */}
              <nav className="hidden md:flex items-center gap-1">
                <NavItem to="/dashboard">Dashboard</NavItem>
                <NavItem to="/my-requests">My Requests</NavItem>
                <NavItem to="/my-history">My History</NavItem>
              </nav>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
              {/* Admin Nav */}
              {user?.is_admin && (
                <nav className="hidden md:flex items-center gap-1 border-l border-gray-200 pl-2 ml-2">
                  <NavItem to="/admin/schedules">Schedules</NavItem>
                  <NavItem to="/admin/teams">Teams</NavItem>
                  <NavItem to="/admin/users">Users</NavItem>
                  <NavItem to="/admin/requests">Requests</NavItem>
                  <NavItem to="/admin/audit-log">Audit</NavItem>
                </nav>
              )}
              <NotificationBell />
              <div className="flex items-center gap-2 border-l border-gray-200 pl-2 ml-2">
                <span className="text-sm text-gray-600 hidden sm:block">
                  {user?.name}
                  {user?.is_admin && (
                    <span className="ml-1 text-xs text-blue-600 font-medium">(admin)</span>
                  )}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}
