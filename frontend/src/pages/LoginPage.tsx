import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/auth';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

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
      alert('Login failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-sm text-center">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-blue-600 mb-2">ShiftSync</h1>
          <p className="text-gray-500 text-sm">Schedule management for your team</p>
        </div>

        <div className="mb-8 space-y-4">
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold flex-shrink-0">✓</div>
            <span>Manage shift schedules</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold flex-shrink-0">✓</div>
            <span>Request time off</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold flex-shrink-0">✓</div>
            <span>Track your team</span>
          </div>
        </div>

        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => alert('Google login failed')}
            useOneTap
            shape="pill"
            size="large"
            text="signin_with"
          />
        </div>

        <p className="mt-6 text-xs text-gray-400">
          Sign in with your Google account to get started.
          <br />
          New users are registered automatically.
        </p>
      </div>
    </div>
  );
}
