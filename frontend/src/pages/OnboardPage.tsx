import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/auth';
import { useTranslation } from 'react-i18next';

export default function OnboardPage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState(user?.name ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) {
      setError(t('onboard.error_required'));
      return;
    }
    if (trimmed.length > 50) {
      setError(t('onboard.error_too_long'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      const { user: updated } = await authApi.setDisplayName(trimmed);
      updateUser(updated);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || t('onboard.error_generic'));
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{t('onboard.title')}</h1>
          <p className="mt-2 text-sm text-gray-500">
            {t('onboard.subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
              {t('onboard.label')}
            </label>
            <input
              id="displayName"
              type="text"
              autoFocus
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t('onboard.placeholder')}
            />
            <p className="mt-1 text-xs text-gray-400">
              {t('onboard.hint')}
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving || !displayName.trim()}
            className="w-full py-2 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? t('onboard.saving') : t('onboard.continue_btn')}
          </button>
        </form>
      </div>
    </div>
  );
}
