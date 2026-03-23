import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { schedulesApi } from '../../api/schedules';
import { teamsApi } from '../../api/teams';

export default function CreateSchedule() {
  const navigate = useNavigate();
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
  });

  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: schedulesApi.create,
    onSuccess: (data) => navigate(`/admin/schedules/${data.id}`),
    onError: (err: any) => setError(err?.response?.data?.error ?? 'Failed to create schedule'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) return setError('Name is required');
    if (!form.primary_team_id) return setError('Primary team is required');
    if (form.start_date > form.end_date) return setError('Start date must be before end date');
    mutation.mutate(form);
  };

  const set = (key: string, val: unknown) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Schedule</h1>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <div>
          <label className="label">Schedule Name</label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Week 12 Schedule" required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Start Date</label>
            <input type="date" className="input" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} required />
          </div>
          <div>
            <label className="label">End Date</label>
            <input type="date" className="input" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Shift Start Time</label>
            <input type="time" className="input" value={form.cycle_start_time} onChange={(e) => set('cycle_start_time', e.target.value)} required />
          </div>
          <div>
            <label className="label">Shift Duration (hours)</label>
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
          <label className="label">Capacity (people needed in-shift per shift)</label>
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
          <label className="label">Primary Team</label>
          <select
            className="input"
            value={form.primary_team_id}
            onChange={(e) => set('primary_team_id', parseInt(e.target.value))}
            required
          >
            <option value={0}>Select a team…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">⚠ Cannot be changed after creation.</p>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating…' : 'Create Schedule'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/admin/schedules')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
