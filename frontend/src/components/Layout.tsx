import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import { LogOut, Menu, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
  const { t, i18n } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'he' ? 'en' : 'he');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo + Desktop Nav */}
            <div className="flex items-center gap-1">
              <span className="font-bold text-blue-600 text-lg tracking-tight mr-4 rtl:mr-0 rtl:ml-4">ShiftSync</span>
              {/* User Nav — desktop only */}
              <nav className="hidden md:flex items-center gap-0.5">
                <NavItem to="/dashboard">{t('nav.dashboard')}</NavItem>
                <NavItem to="/my-requests">{t('nav.requests')}</NavItem>
                <NavItem to="/my-history">{t('nav.history')}</NavItem>
              </nav>
              {/* Admin Nav — desktop only */}
              {user?.is_admin && (
                <nav className="hidden md:flex items-center gap-0.5 border-l border-gray-200 pl-2 ml-2 rtl:border-l-0 rtl:border-r rtl:pl-0 rtl:pr-2 rtl:ml-0 rtl:mr-2">
                  <NavItem to="/admin/schedules">{t('nav.schedules')}</NavItem>
                  <NavItem to="/admin/teams">{t('nav.teams')}</NavItem>
                  <NavItem to="/admin/users">{t('nav.users')}</NavItem>
                  <NavItem to="/admin/requests">{t('nav.all_requests')}</NavItem>
                  <NavItem to="/admin/audit-log">{t('nav.audit')}</NavItem>
                </nav>
              )}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-1">
              {/* Language toggle */}
              <button
                onClick={toggleLanguage}
                className="hidden sm:inline-flex items-center px-1.5 py-1 rounded-md text-lg hover:bg-gray-100 transition-colors leading-none"
                title={i18n.language === 'he' ? 'Switch to English' : 'עבור לעברית'}
              >
                {i18n.language === 'he' ? '🇺🇸' : '🇮🇱'}
              </button>
              <NotificationBell />
              {/* User info + sign out — desktop only */}
              <div className="hidden sm:flex items-center gap-1.5 border-l border-gray-200 pl-3 ml-1 rtl:border-l-0 rtl:border-r rtl:pl-0 rtl:pr-3 rtl:ml-0 rtl:mr-1">
                <span className="text-sm text-gray-500">{user?.display_name || user?.name}</span>
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  title={t('nav.sign_out')}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
              {/* Hamburger — mobile only */}
              <button
                className="md:hidden p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                onClick={() => setMobileMenuOpen((o) => !o)}
                aria-label={t('nav.toggle_menu')}
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
            <NavItem to="/dashboard" onClick={closeMobileMenu}>{t('nav.dashboard')}</NavItem>
            <NavItem to="/my-requests" onClick={closeMobileMenu}>{t('nav.requests')}</NavItem>
            <NavItem to="/my-history" onClick={closeMobileMenu}>{t('nav.history')}</NavItem>
            {user?.is_admin && (
              <>
                <div className="border-t border-gray-100 my-2" />
                <p className="text-xs text-gray-400 px-3 pb-1 font-medium uppercase tracking-wide">{t('nav.admin_section')}</p>
                <NavItem to="/admin/schedules" onClick={closeMobileMenu}>{t('nav.schedules')}</NavItem>
                <NavItem to="/admin/teams" onClick={closeMobileMenu}>{t('nav.teams')}</NavItem>
                <NavItem to="/admin/users" onClick={closeMobileMenu}>{t('nav.users')}</NavItem>
                <NavItem to="/admin/requests" onClick={closeMobileMenu}>{t('nav.all_requests')}</NavItem>
                <NavItem to="/admin/audit-log" onClick={closeMobileMenu}>{t('nav.audit')}</NavItem>
              </>
            )}
            <div className="border-t border-gray-100 pt-3 mt-2 flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {user?.display_name || user?.name}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleLanguage}
                  className="text-lg px-1.5 py-1 rounded hover:bg-gray-100 leading-none"
                >
                  {i18n.language === 'he' ? '🇺🇸' : '🇮🇱'}
                </button>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {t('nav.sign_out')}
                </button>
              </div>
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
