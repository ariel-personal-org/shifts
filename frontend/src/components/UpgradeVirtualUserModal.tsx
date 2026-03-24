import { useState } from 'react';
import type { Team, User } from '../types';
import { X, ArrowUpCircle } from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';

interface Props {
  user: User;
  teams: Team[];
  onClose: () => void;
  onSave: (email: string, teamId: number) => void;
  isSaving: boolean;
  error?: string | null;
}

export default function UpgradeVirtualUserModal({ user, teams, onClose, onSave, isSaving, error }: Props) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [teamId, setTeamId] = useState<number | ''>('');

  const isValid = email.includes('@') && email.length > 3 && teamId !== '';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    onSave(email, teamId as number);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('upgrade_modal.title')}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-5">
          <Trans
            i18nKey="upgrade_modal.description"
            values={{ name: user.display_name || user.name }}
            components={{ strong: <span className="font-medium text-gray-700" /> }}
          />
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('upgrade_modal.email_label')}</label>
            <input
              type="email"
              className="input w-full"
              placeholder={t('upgrade_modal.email_placeholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('upgrade_modal.team_label')}</label>
            <select
              className="input w-full"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value ? parseInt(e.target.value) : '')}
            >
              <option value="">{t('upgrade_modal.select_team')}</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSaving}>
              {t('upgrade_modal.cancel')}
            </button>
            <button type="submit" className="btn-primary" disabled={!isValid || isSaving}>
              {isSaving ? t('upgrade_modal.upgrading') : <><ArrowUpCircle className="w-4 h-4" /> {t('upgrade_modal.upgrade_btn')}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
