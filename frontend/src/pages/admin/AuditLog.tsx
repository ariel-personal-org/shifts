import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { auditLogsApi } from '../../api/auditLogs';
import { usersApi } from '../../api/users';
import { schedulesApi } from '../../api/schedules';
import type { AuditLog } from '../../types';
import { useTranslation } from 'react-i18next';

function LogRow({ log, users, schedules }: { log: AuditLog; users: any[]; schedules: any[] }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();
  const actor = users.find((u) => u.id === log.actor_user_id);
  const affected = users.find((u) => u.id === log.affected_user_id);
  const schedule = schedules.find((s) => s.id === log.schedule_id);

  const actionKey = `audit_log.action_${log.action}` as const;
  const actionLabel = t(actionKey, { defaultValue: log.action });

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">
        {format(parseISO(log.created_at), 'MMM d, HH:mm')}
      </td>
      <td className="px-3 py-2 text-sm text-gray-800">
        {actionLabel}
      </td>
      <td className="px-3 py-2 text-xs text-gray-500">
        {(actor?.display_name || actor?.name) ?? (log.actor_user_id ? `#${log.actor_user_id}` : t('audit_log.system'))}
      </td>
      <td className="px-3 py-2 text-xs text-gray-500">
        {(affected?.display_name || affected?.name) ?? (log.affected_user_id ? `#${log.affected_user_id}` : '—')}
      </td>
      <td className="px-3 py-2 text-xs text-gray-500">
        {schedule?.name ?? (log.schedule_id ? `#${log.schedule_id}` : '—')}
      </td>
      <td className="px-3 py-2">
        {!!(log.old_value_json || log.new_value_json) && (
          <button className="text-xs text-blue-600 hover:underline" onClick={() => setExpanded((e) => !e)}>
            {expanded ? t('audit_log.hide') : t('audit_log.view')}
          </button>
        )}
        {expanded && (
          <div className="mt-1 grid grid-cols-2 gap-1 text-[10px]">
            {!!log.old_value_json && (
              <div className="bg-red-50 rounded p-1">
                <pre className="whitespace-pre-wrap">{JSON.stringify(log.old_value_json, null, 2)}</pre>
              </div>
            )}
            {!!log.new_value_json && (
              <div className="bg-green-50 rounded p-1">
                <pre className="whitespace-pre-wrap">{JSON.stringify(log.new_value_json, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

export default function AuditLog() {
  const { t } = useTranslation();
  const [userFilter, setUserFilter] = useState('');
  const [scheduleFilter, setScheduleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { data: users = [] } = useQuery({ queryKey: ['users', 'all'], queryFn: () => usersApi.list() });
  const { data: schedules = [] } = useQuery({ queryKey: ['schedules'], queryFn: schedulesApi.list });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs', userFilter, scheduleFilter, actionFilter, fromDate, toDate],
    queryFn: () =>
      auditLogsApi.list({
        user_id: userFilter ? parseInt(userFilter) : undefined,
        schedule_id: scheduleFilter ? parseInt(scheduleFilter) : undefined,
        action: actionFilter || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      }),
  });

  const ACTION_KEYS = [
    'state_set', 'home_approved', 'home_rejected', 'home_approved_override_in_shift',
    'auto_fill_assigned', 'auto_fill_assigned_with_pending_request', 'home_request_created',
    'member_added', 'member_removed', 'schedule_created', 'schedule_updated',
    'team_created', 'team_updated', 'team_deleted', 'team_member_added',
    'team_member_removed', 'user_updated',
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">{t('audit_log.title')}</h1>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <select className="input text-sm" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
            <option value="">{t('audit_log.all_users')}</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.display_name || u.name}</option>)}
          </select>
          <select className="input text-sm" value={scheduleFilter} onChange={(e) => setScheduleFilter(e.target.value)}>
            <option value="">{t('audit_log.all_schedules')}</option>
            {schedules.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="input text-sm" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option value="">{t('audit_log.all_actions')}</option>
            {ACTION_KEYS.map((k) => <option key={k} value={k}>{t(`audit_log.action_${k}`, { defaultValue: k })}</option>)}
          </select>
          <input type="date" className="input text-sm" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <input type="date" className="input text-sm" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : logs.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">{t('audit_log.no_entries')}</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{t('audit_log.time_col')}</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{t('audit_log.action_col')}</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{t('audit_log.actor_col')}</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{t('audit_log.affected_col')}</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{t('audit_log.schedule_col')}</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{t('audit_log.details_col')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <LogRow key={log.id} log={log} users={users} schedules={schedules} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
            {t('audit_log.showing', { count: logs.length })}
          </div>
        </div>
      )}
    </div>
  );
}
