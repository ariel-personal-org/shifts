import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { homeRequestsApi } from '../../api/homeRequests';
import { schedulesApi } from '../../api/schedules';
import { usersApi } from '../../api/users';
import type { HomeRequest, HomeDecision, RequestStatus } from '../../types';

const STATUS_STYLES: Record<RequestStatus, string> = {
  pending: 'badge-yellow',
  partial: 'badge-blue',
  approved: 'badge-green',
  rejected: 'badge-red',
};

function RequestRow({ request, onDecide }: { request: HomeRequest; onDecide: (requestId: string, decisions: Array<{ shift_id: number; decision: 'approved' | 'rejected' }>) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [localDecisions, setLocalDecisions] = useState<Record<number, 'approved' | 'rejected' | ''>>({});
  const { data: users = [] } = useQuery({ queryKey: ['users', 'all'], queryFn: () => usersApi.list() });
  const userName = users.find((u) => u.id === request.user_id)?.name ?? `User #${request.user_id}`;

  const pendingShifts = request.shifts.filter((s) => s.decision === 'pending');

  const handleApplyAll = (decision: 'approved' | 'rejected') => {
    const allDecisions = pendingShifts.map((s) => ({ shift_id: s.shift_id, decision }));
    onDecide(request.request_id, allDecisions);
  };

  const handleApplySelected = () => {
    const decisions = Object.entries(localDecisions)
      .filter(([, d]) => d === 'approved' || d === 'rejected')
      .map(([shiftId, d]) => ({ shift_id: parseInt(shiftId), decision: d as 'approved' | 'rejected' }));
    if (decisions.length > 0) onDecide(request.request_id, decisions);
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <span className={STATUS_STYLES[request.status]}>{request.status}</span>
          <div>
            <span className="font-medium text-gray-900">{userName}</span>
            <span className="text-xs text-gray-400 ml-2">
              {request.shifts.length} shift{request.shifts.length !== 1 ? 's' : ''} · {format(parseISO(request.created_at), 'MMM d, HH:mm')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendingShifts.length > 0 && (
            <>
              <button className="btn-primary btn-sm" onClick={() => handleApplyAll('approved')}>Approve All</button>
              <button className="btn-danger btn-sm" onClick={() => handleApplyAll('rejected')}>Reject All</button>
            </>
          )}
          <button className="btn-secondary btn-sm" onClick={() => setExpanded((e) => !e)}>
            {expanded ? 'Collapse' : 'Details'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-2">
          {request.shifts.map((s) => (
            <div key={s.shift_id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
              <div className="text-sm text-gray-700">
                {formatInTimeZone(parseISO(s.shift.start_datetime), request.schedule_timezone, 'EEE MMM d, HH:mm')} – {formatInTimeZone(parseISO(s.shift.end_datetime), request.schedule_timezone, 'HH:mm')}
              </div>
              <div className="flex items-center gap-2">
                {s.decision !== 'pending' ? (
                  <span className={s.decision === 'approved' ? 'badge-green' : 'badge-red'}>{s.decision}</span>
                ) : (
                  <div className="flex gap-1.5">
                    <button
                      className={`btn-sm ${localDecisions[s.shift_id] === 'approved' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => {
                        const d = localDecisions[s.shift_id] === 'approved' ? '' : 'approved';
                        setLocalDecisions((prev) => ({ ...prev, [s.shift_id]: d as any }));
                      }}
                    >
                      ✓
                    </button>
                    <button
                      className={`btn-sm ${localDecisions[s.shift_id] === 'rejected' ? 'btn-danger' : 'btn-secondary'}`}
                      onClick={() => {
                        const d = localDecisions[s.shift_id] === 'rejected' ? '' : 'rejected';
                        setLocalDecisions((prev) => ({ ...prev, [s.shift_id]: d as any }));
                      }}
                    >
                      ✗
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {Object.values(localDecisions).some((d) => d === 'approved' || d === 'rejected') && (
            <button className="btn-primary btn-sm mt-2" onClick={handleApplySelected}>Apply Selected Decisions</button>
          )}
        </div>
      )}
    </div>
  );
}

export default function Requests() {
  const queryClient = useQueryClient();
  const [scheduleFilter, setScheduleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: schedules = [] } = useQuery({ queryKey: ['schedules'], queryFn: schedulesApi.list });

  // Default to first schedule once loaded
  useEffect(() => {
    if (schedules.length > 0 && !scheduleFilter) {
      setScheduleFilter(String(schedules[0].id));
    }
  }, [schedules]);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['requests', scheduleFilter, statusFilter],
    queryFn: () =>
      homeRequestsApi.list({
        schedule_id: scheduleFilter ? parseInt(scheduleFilter) : undefined,
      }),
  });

  const decideMutation = useMutation({
    mutationFn: ({ requestId, decisions }: { requestId: string; decisions: Array<{ shift_id: number; decision: 'approved' | 'rejected' }> }) =>
      homeRequestsApi.decide(requestId, decisions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['grid'] });
    },
  });

  const filteredRequests = statusFilter
    ? requests.filter((r) => r.status === statusFilter)
    : requests;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Home Requests</h1>

      <div className="flex gap-3">
        <select className="input max-w-xs" value={scheduleFilter} onChange={(e) => setScheduleFilter(e.target.value)}>
          {schedules.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="input max-w-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : filteredRequests.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">No requests found.</div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((r) => (
            <RequestRow
              key={r.request_id}
              request={r}
              onDecide={(requestId, decisions) => decideMutation.mutate({ requestId, decisions })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
