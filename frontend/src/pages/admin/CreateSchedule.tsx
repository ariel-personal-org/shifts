import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { schedulesApi } from '../../api/schedules';
import { teamsApi } from '../../api/teams';
import { AlertTriangle, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function CreateSchedule() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: teamsApi.list });

  const today = format(new Date(), 'yyyy-MM-dd');
  const twoWeeksLater = format(new Date(Date.now() + 14 * 86400000), 'yyyy-MM-dd');

  const [form, setForm] = useState({
    name: '',
    start_date: today,
    end_date: twoWeeksLater,
    cycle_start_time: '09:00',
    shift_duration_hours: 12,
    capacity: 2,
    primary_team_id: 0,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: schedulesApi.create,
    onSuccess: (data) => navigate(`/admin/schedules/${data.id}`),
    onError: (err: any) => setError(err?.response?.data?.error ?? t('create_schedule.error_name')),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) return setError(t('create_schedule.error_name'));
    if (!form.primary_team_id) return setError(t('create_schedule.error_team'));
    if (form.start_date > form.end_date) return setError(t('create_schedule.error_dates'));
    mutation.mutate(form);
  };

  const set = (key: string, val: unknown) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('create_schedule.title')}</h1>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <div>
          <label className="label">{t('create_schedule.name_label')}</label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={t('create_schedule.name_placeholder')} required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">{t('create_schedule.start_date')}</label>
            <input type="date" className="input" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} required />
          </div>
          <div>
            <label className="label">{t('create_schedule.end_date')}</label>
            <input type="date" className="input" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">{t('create_schedule.shift_start_time')}</label>
            <input type="time" className="input" value={form.cycle_start_time} onChange={(e) => set('cycle_start_time', e.target.value)} required />
          </div>
          <div>
            <label className="label">{t('create_schedule.shift_duration')}</label>
            <input
              type="number"
              className="input"
              min={1}
              max={24}
              value={form.shift_duration_hours}
              onChange={(e) => set('shift_duration_hours', parseInt(e.target.value))}
              required
            />
          </div>
        </div>

        <div>
          <label className="label">{t('create_schedule.capacity')}</label>
          <input
            type="number"
            className="input"
            min={1}
            value={form.capacity}
            onChange={(e) => set('capacity', parseInt(e.target.value))}
            required
          />
        </div>

        <div>
          <label className="label">{t('create_schedule.primary_team')}</label>
          <select
            className="input"
            value={form.primary_team_id}
            onChange={(e) => set('primary_team_id', parseInt(e.target.value))}
            required
          >
            <option value={0}>{t('create_schedule.select_team')}</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <p className="inline-flex items-center gap-1 text-xs text-gray-500 mt-1"><AlertTriangle className="w-3 h-3 text-amber-500" /> {t('create_schedule.immutable_warning')}</p>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? t('create_schedule.creating') : <><Plus className="w-4 h-4" /> {t('create_schedule.create_btn')}</>}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/admin/schedules')}>
            <X className="w-3.5 h-3.5" /> {t('create_schedule.cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}
