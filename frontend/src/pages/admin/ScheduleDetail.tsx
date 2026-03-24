import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import type { GridData } from '../../types';
import { schedulesApi } from '../../api/schedules';
import { usersApi } from '../../api/users';
import ScheduleGrid from '../../components/ScheduleGrid';
import AdvancedScheduleModal from '../../components/AdvancedScheduleModal';
import {
  Zap, Pencil, Settings, Save, X, Check, AlertTriangle,
  UserPlus, UserMinus, Monitor, ArrowLeftRight,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function ScheduleDetail() {
  const { id } = useParams<{ id: string }>();
  const scheduleId = parseInt(id!);
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [userSearch, setUserSearch] = useState('');
  const [autoFillResult, setAutoFillResult] = useState<null | {
    assignments_made: number;
    shifts_filled: number[];
    shifts_still_under: number[];
  }>(null);
  const [editName, setEditName] = useState('');
  const [editCapacity, setEditCapacity] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { data: grid, isLoading } = useQuery({
    queryKey: ['grid', scheduleId],
    queryFn: () => schedulesApi.getGrid(scheduleId),
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ['users', 'search', userSearch],
    queryFn: () => usersApi.list(userSearch),
    enabled: userSearch.length >= 2,
  });

  const addMemberMutation = useMutation({
    mutationFn: (userId: number) => schedulesApi.addMember(scheduleId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grid', scheduleId] });
      setUserSearch('');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: number) => schedulesApi.removeMember(scheduleId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['grid', scheduleId] }),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      schedulesApi.update(scheduleId, { name: editName, capacity: editCapacity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grid', scheduleId] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      setIsEditing(false);
    },
  });

  const advancedMutation = useMutation({
    mutationFn: (updates: { cycle_start_time?: string; shift_duration_hours?: number }) =>
      schedulesApi.advancedUpdate(scheduleId, updates),
    onSuccess: (result) => {
      queryClient.setQueryData(['grid', scheduleId], (old: GridData | undefined) =>
        old ? { ...old, schedule: result.schedule, shifts: result.shifts } : old
      );
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      setShowAdvanced(false);
    },
  });

  const autoFillMutation = useMutation({
    mutationFn: () => schedulesApi.autoFill(scheduleId),
    onSuccess: (result) => {
      setAutoFillResult(result);
      queryClient.invalidateQueries({ queryKey: ['grid', scheduleId] });
    },
  });

  if (isLoading || !grid) {
    return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>;
  }

  const { schedule, members, shift_stats } = grid;
  const hasUnderCapacity = shift_stats.some((s) => s.in_shift_count < s.capacity);
  const hasAvailable = members.some((m) => m.states.some((s) => s.state === 'available'));
  const canAutoFill = hasUnderCapacity && hasAvailable;

  const memberIds = new Set(members.map((m) => m.user.id));

  const startEdit = () => {
    setEditName(schedule.name);
    setEditCapacity(schedule.capacity);
    setIsEditing(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link to="/admin/schedules" className="hover:text-blue-600">{t('schedule_detail.breadcrumb')}</Link>
            <span>/</span>
            <span>{schedule.name}</span>
          </div>
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                className="input text-xl font-bold py-1 w-64"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <div className="flex items-center gap-1.5">
                <label className="text-sm text-gray-600">{t('schedule_detail.cap_label')}</label>
                <input
                  type="number"
                  min={1}
                  className="input w-16 py-1 text-sm"
                  value={editCapacity}
                  onChange={(e) => setEditCapacity(parseInt(e.target.value))}
                />
              </div>
              <button className="btn-primary btn-sm" onClick={() => updateMutation.mutate()}><Save className="w-3.5 h-3.5" />{t('schedule_detail.save')}</button>
              <button className="btn-secondary btn-sm" onClick={() => setIsEditing(false)}><X className="w-3.5 h-3.5" />{t('schedule_detail.cancel')}</button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{schedule.name}</h1>
              <button className="btn-secondary btn-sm" onClick={startEdit}><Pencil className="w-3.5 h-3.5" />{t('schedule_detail.edit_btn')}</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowAdvanced(true)}><Settings className="w-3.5 h-3.5" />{t('schedule_detail.advanced_btn')}</button>
            </div>
          )}
          <p className="text-sm text-gray-500 mt-1">
            {format(parseISO(schedule.start_date), 'MMM d')} – {format(parseISO(schedule.end_date), 'MMM d, yyyy')}
            {' · '}{t('schedule_detail.shift_info', { duration: schedule.shift_duration_hours, capacity: schedule.capacity })}
            {schedule.primary_team && <span className="ml-2 text-blue-600">· {t('schedule_detail.primary_team', { name: schedule.primary_team.name })}</span>}
          </p>
        </div>

        <button
          className="btn-primary"
          disabled={!canAutoFill || autoFillMutation.isPending}
          onClick={() => { setAutoFillResult(null); autoFillMutation.mutate(); }}
          title={!canAutoFill ? t('schedule_detail.auto_fill_tooltip_disabled') : t('schedule_detail.auto_fill_tooltip')}
        >
          {autoFillMutation.isPending ? t('schedule_detail.filling') : <><Zap className="w-4 h-4" /> {t('schedule_detail.auto_fill')}</>}
        </button>
      </div>

      {/* Auto-fill result */}
      {autoFillResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="font-semibold text-green-800 mb-1">{t('schedule_detail.auto_fill_complete')}</div>
          <div className="text-sm text-green-700 space-y-1">
            <div className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-green-600" /> {autoFillResult.assignments_made !== 1 ? t('schedule_detail.assignments_made_other', { count: autoFillResult.assignments_made }) : t('schedule_detail.assignments_made_one', { count: autoFillResult.assignments_made })}</div>
            <div className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-green-600" /> {autoFillResult.shifts_filled.length !== 1 ? t('schedule_detail.shifts_filled_other', { count: autoFillResult.shifts_filled.length }) : t('schedule_detail.shifts_filled_one', { count: autoFillResult.shifts_filled.length })}</div>
            {autoFillResult.shifts_still_under.length > 0 && (
              <div className="flex items-center gap-1 text-amber-700"><AlertTriangle className="w-3.5 h-3.5" /> {autoFillResult.shifts_still_under.length !== 1 ? t('schedule_detail.shifts_still_under_other', { count: autoFillResult.shifts_still_under.length }) : t('schedule_detail.shifts_still_under_one', { count: autoFillResult.shifts_still_under.length })}</div>
            )}
          </div>
          <button className="text-xs text-green-600 hover:underline mt-2" onClick={() => setAutoFillResult(null)}>{t('schedule_detail.dismiss')}</button>
        </div>
      )}

      {/* Grid */}
      {grid.shifts.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">{t('schedule_detail.no_shifts')}</div>
      ) : (
        <ScheduleGrid data={grid} isAdminView />
      )}

      {showAdvanced && (
        <AdvancedScheduleModal
          schedule={schedule}
          grid={grid}
          onClose={() => setShowAdvanced(false)}
          onSave={(updates) => advancedMutation.mutate(updates)}
          isSaving={advancedMutation.isPending}
        />
      )}

      {/* Member management */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-3">{t('schedule_detail.manage_members')}</h2>

        {/* Add member */}
        <div className="flex gap-2 mb-4">
          <input
            className="input flex-1"
            placeholder={t('schedule_detail.search_member')}
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
          />
        </div>

        {userSearch.length >= 2 && searchResults.length > 0 && (
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 mb-4 overflow-hidden">
            {searchResults.map((u) => {
              const isMember = memberIds.has(u.id);
              return (
                <div key={u.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
                  <div>
                    <span className="text-sm font-medium text-gray-900">{u.display_name || u.name}</span>
                    {u.is_virtual && <span className="badge badge-yellow text-[9px] ml-1"><Monitor className="w-2.5 h-2.5" />{t('users.virtual_label')}</span>}
                    {!u.is_virtual && <span className="text-xs text-gray-400 ml-2">{u.email}</span>}
                  </div>
                  {isMember ? (
                    <span className="text-xs text-gray-400">{t('schedule_detail.already_member')}</span>
                  ) : (
                    <button
                      className="btn-primary btn-sm"
                      onClick={() => addMemberMutation.mutate(u.id)}
                      disabled={addMemberMutation.isPending}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      {t('schedule_detail.add')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Current members */}
        <div className="space-y-1">
          {members.map((m) => (
            <div key={m.user.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-900">{m.user.display_name || m.user.name}</span>
                {m.user.is_virtual
                  ? <span className="badge badge-yellow text-[9px]"><Monitor className="w-2.5 h-2.5" />{t('users.virtual_label')}</span>
                  : <span className="text-xs text-gray-400">{m.user.email}</span>
                }
                {m.is_fill_in && <span className="badge badge-purple text-[9px]"><ArrowLeftRight className="w-2.5 h-2.5" />{t('common.fill_in')}</span>}
              </div>
              <button
                className="btn-danger btn-sm"
                onClick={() => removeMemberMutation.mutate(m.user.id)}
                disabled={removeMemberMutation.isPending}
              >
                <UserMinus className="w-3.5 h-3.5" />
                {t('schedule_detail.remove')}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
