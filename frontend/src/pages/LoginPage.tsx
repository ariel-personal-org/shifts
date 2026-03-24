import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/auth';
import { CalendarCheck, CalendarOff, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [devEmail, setDevEmail] = useState('alice@example.com');

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const handleSuccess = async (response: { credential?: string }) => {
    if (!response.credential) return;
    try {
      const { user: u, token } = await authApi.googleLogin(response.credential);
      login(u, token);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('Login failed:', err);
      alert(t('login.login_failed'));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-sm text-center">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-blue-600 mb-2">ShiftSync</h1>
          <p className="text-gray-500 text-sm">{t('login.tagline')}</p>
        </div>

        <div className="mb-8 space-y-4">
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 flex-shrink-0"><CalendarCheck className="w-4 h-4" /></div>
            <span>{t('login.feature_shifts')}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0"><CalendarOff className="w-4 h-4" /></div>
            <span>{t('login.feature_time_off')}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 flex-shrink-0"><Users className="w-4 h-4" /></div>
            <span>{t('login.feature_track')}</span>
          </div>
        </div>

        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => alert(t('login.google_failed'))}
            useOneTap
            shape="pill"
            size="large"
            text="signin_with"
          />
        </div>

        <p className="mt-6 text-xs text-gray-400">
          {t('login.sign_in_hint')}
          <br />
          {t('login.auto_register')}
        </p>

        {import.meta.env.DEV && (
          <div className="mt-6 pt-6 border-t border-dashed border-gray-200">
            <p className="text-xs text-amber-600 font-medium mb-3">{t('login.dev_login')}</p>
            <div className="flex gap-2">
              <select
                value={devEmail}
                onChange={(e) => setDevEmail(e.target.value)}
                className="flex-1 text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="alice@example.com">Alice (admin)</option>
                <option value="bob@example.com">Bob</option>
                <option value="carol@example.com">Carol</option>
                <option value="dave@example.com">Dave (fill-in)</option>
                <option value="eva@example.com">Eva</option>
              </select>
              <button
                onClick={async () => {
                  try {
                    const { user: u, token } = await authApi.devLogin(devEmail);
                    login(u, token);
                    navigate('/dashboard', { replace: true });
                  } catch {
                    alert(t('login.dev_failed'));
                  }
                }}
                className="text-sm bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                {t('login.login_btn')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
