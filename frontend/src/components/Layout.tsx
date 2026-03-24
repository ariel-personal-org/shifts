import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import { LogOut, Menu, X } from 'lucide-react';

function NavItem({ to, children, onClick }: { to: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? 'bg-blue-50 text-blue-700'
            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo + Desktop Nav */}
            <div className="flex items-center gap-1">
              <span className="font-bold text-blue-600 text-lg tracking-tight mr-4">ShiftSync</span>
              {/* User Nav — desktop only */}
              <nav className="hidden md:flex items-center gap-0.5">
                <NavItem to="/dashboard">Dashboard</NavItem>
                <NavItem to="/my-requests">Requests</NavItem>
                <NavItem to="/my-history">History</NavItem>
              </nav>
              {/* Admin Nav — desktop only */}
              {user?.is_admin && (
                <nav className="hidden md:flex items-center gap-0.5 border-l border-gray-200 pl-2 ml-2">
                  <NavItem to="/admin/schedules">Schedules</NavItem>
                  <NavItem to="/admin/teams">Teams</NavItem>
                  <NavItem to="/admin/users">Users</NavItem>
                  <NavItem to="/admin/requests">All Requests</NavItem>
                  <NavItem to="/admin/audit-log">Audit</NavItem>
                </nav>
              )}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-1">
              <NotificationBell />
              {/* User info + sign out — desktop only */}
              <div className="hidden sm:flex items-center gap-1.5 border-l border-gray-200 pl-3 ml-1">
                <span className="text-sm text-gray-500">{user?.display_name || user?.name}</span>
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
              {/* Hamburger — mobile only */}
              <button
                className="md:hidden p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                onClick={() => setMobileMenuOpen((o) => !o)}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu panel */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
            <NavItem to="/dashboard" onClick={closeMobileMenu}>Dashboard</NavItem>
            <NavItem to="/my-requests" onClick={closeMobileMenu}>Requests</NavItem>
            <NavItem to="/my-history" onClick={closeMobileMenu}>History</NavItem>
            {user?.is_admin && (
              <>
                <div className="border-t border-gray-100 my-2" />
                <p className="text-xs text-gray-400 px-3 pb-1 font-medium uppercase tracking-wide">Admin</p>
                <NavItem to="/admin/schedules" onClick={closeMobileMenu}>Schedules</NavItem>
                <NavItem to="/admin/teams" onClick={closeMobileMenu}>Teams</NavItem>
                <NavItem to="/admin/users" onClick={closeMobileMenu}>Users</NavItem>
                <NavItem to="/admin/requests" onClick={closeMobileMenu}>All Requests</NavItem>
                <NavItem to="/admin/audit-log" onClick={closeMobileMenu}>Audit</NavItem>
              </>
            )}
            <div className="border-t border-gray-100 pt-3 mt-2 flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {user?.display_name || user?.name}
              </span>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}
