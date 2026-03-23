import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { auditLogsApi } from '../../api/auditLogs';
import { usersApi } from '../../api/users';
import { schedulesApi } from '../../api/schedules';
import type { AuditLog } from '../../types';

const ACTION_LABELS: Record<string, string> = {
  state_set: 'State changed',
  home_approved: 'Home approved',
  home_rejected: 'Home rejected',
  home_approved_override_in_shift: 'Home approved (overrode in_shift)',
  auto_fill_assigned: 'Auto-fill assigned',
  auto_fill_assigned_with_pending_request: 'Auto-fill assigned (had pending request)',
  home_request_created: 'Home request created',
  member_added: 'Member added',
  member_removed: 'Member removed',
  schedule_created: 'Schedule created',
  schedule_updated: 'Schedule updated',
  team_created: 'Team created',
  team_updated: 'Team updated',
  team_deleted: 'Team deleted',
  team_member_added: 'Team member added',
  team_member_removed: 'Team member removed',
  user_updated: 'User updated',
};

function LogRow({ log, users, schedules }: { log: AuditLog; users: any[]; schedules: any[] }) {
  const [expanded, setExpanded] = useState(false);
  const actor = users.find((u) => u.id === log.actor_user_id);
  const affected = users.find((u) => u.id === log.affected_user_id);
  const schedule = schedules.find((s) => s.id === log.schedule_id);

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">
        {format(parseISO(log.created_at), 'MMM d, HH:mm')}
      </td>
      <td className="px-3 py-2 text-sm text-gray-800">
        {ACTION_LABELS[log.action] ?? log.action}
      </td>
      <td className="px-3 py-2 text-xs text-gray-500">
        {actor?.name ?? (log.actor_user_id ? `#${log.actor_user_id}` : 'System')}
      </td>
      <td className="px-3 py-2 text-xs text-gray-500">
        {affected?.name ?? (log.affected_user_id ? `#${log.affected_user_id}` : '—')}
      </td>
      <td className="px-3 py-2 text-xs text-gray-500">
        {schedule?.name ?? (log.schedule_id ? `#${log.schedule_id}` : '—')}
      </td>
      <td className="px-3 py-2">
        {(log.old_value_json || log.new_value_json) && (
          <button className="text-xs text-blue-600 hover:underline" onClick={() => setExpanded((e) => !e)}>
            {expanded ? 'Hide' : 'View'}
          </button>
        )}
        {expanded && (
          <div className="mt-1 grid grid-cols-2 gap-1 text-[10px]">
            {log.old_value_json && (
              <div className="bg-red-50 rounded p-1">
                <pre className="whitespace-pre-wrap">{JSON.stringify(log.old_value_json, null, 2)}</pre>
              </div>
            )}
            {log.new_value_json && (
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

  const uniqueActions = [...new Set(logs.map((l) => l.action))].sort();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <select className="input text-sm" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
            <option value="">All users</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select className="input text-sm" value={scheduleFilter} onChange={(e) => setScheduleFilter(e.target.value)}>
            <option value="">All schedules</option>
            {schedules.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="input text-sm" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option value="">All actions</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input type="date" className="input text-sm" placeholder="From" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <input type="date" className="input text-sm" placeholder="To" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : logs.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">No audit log entries found.</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Time</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Actor</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Affected</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Schedule</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Details</th>
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
            Showing {logs.length} entries
          </div>
        </div>
      )}
    </div>
  );
}
