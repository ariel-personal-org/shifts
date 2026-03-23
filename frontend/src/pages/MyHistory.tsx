import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { auditLogsApi } from '../api/auditLogs';
import type { AuditLog } from '../types';

const ACTION_LABELS: Record<string, string> = {
  state_set: 'State changed',
  home_approved: 'Home approved',
  home_rejected: 'Home rejected',
  home_approved_override_in_shift: 'Home approved (was In Shift)',
  auto_fill_assigned: 'Auto-assigned to shift',
  auto_fill_assigned_with_pending_request: 'Auto-assigned (had pending request)',
  home_request_created: 'Home request submitted',
  member_added: 'Added to schedule',
  member_removed: 'Removed from schedule',
};

function LogRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 w-36 flex-shrink-0">
            {format(parseISO(log.created_at), 'MMM d, HH:mm')}
          </span>
          <span className="text-sm text-gray-800">
            {ACTION_LABELS[log.action] ?? log.action}
          </span>
        </div>
        {!!(log.old_value_json || log.new_value_json) && (
          <button className="text-xs text-blue-600 hover:underline" onClick={() => setExpanded(e => !e)}>
            {expanded ? 'Hide' : 'Details'}
          </button>
        )}
      </div>
      {expanded && (
        <div className="mt-2 sm:ml-[9.75rem] grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {!!log.old_value_json && (
            <div className="bg-red-50 rounded p-2">
              <div className="text-gray-500 mb-1 font-medium">Before</div>
              <pre className="text-gray-700 whitespace-pre-wrap">{JSON.stringify(log.old_value_json, null, 2)}</pre>
            </div>
          )}
          {!!log.new_value_json && (
            <div className="bg-green-50 rounded p-2">
              <div className="text-gray-500 mb-1 font-medium">After</div>
              <pre className="text-gray-700 whitespace-pre-wrap">{JSON.stringify(log.new_value_json, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MyHistory() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs', 'mine'],
    queryFn: () => auditLogsApi.list(),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">My History</h1>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : logs.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">No history yet.</div>
      ) : (
        <div className="card px-4 py-2">
          {logs.map((log) => <LogRow key={log.id} log={log} />)}
        </div>
      )}
    </div>
  );
}
