import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { homeRequestsApi } from '../../api/homeRequests';
import { schedulesApi } from '../../api/schedules';
import { usersApi } from '../../api/users';
import type { HomeRequest, HomeDecision, RequestStatus } from '../../types';
import type { LucideIcon } from 'lucide-react';
import { Clock, CheckCircle, XCircle, AlertTriangle, CheckCheck, Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const STATUS_ICONS: Record<RequestStatus, LucideIcon> = {
  pending: Clock,
  partial: AlertTriangle,
  approved: CheckCircle,
  rejected: XCircle,
};

const STATUS_STYLES: Record<RequestStatus, string> = {
  pending: 'badge-yellow',
  partial: 'badge-blue',
  approved: 'badge-green',
  rejected: 'badge-red',
};

function RequestRow({ request, onDecide }: { request: HomeRequest; onDecide: (requestId: string, decisions: Array<{ shift_id: number; decision: 'approved' | 'rejected' }>) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [localDecisions, setLocalDecisions] = useState<Record<number, 'approved' | 'rejected' | ''>>({});
  const { t } = useTranslation();
  const { data: users = [] } = useQuery({ queryKey: ['users', 'all'], queryFn: () => usersApi.list() });
  const requestUser = users.find((u) => u.id === request.user_id);
  const userName = (requestUser?.display_name || requestUser?.name) ?? `User #${request.user_id}`;

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
          <span className={STATUS_STYLES[request.status]}>{(() => { const Icon = STATUS_ICONS[request.status]; return <Icon className="w-3 h-3" />; })()}{t(`admin_requests.${request.status}`)}</span>
          <div>
            <span className="font-medium text-gray-900">{userName}</span>
            <span className="text-xs text-gray-400 ml-2">
              {request.shifts.length !== 1 ? t('admin_requests.shift_count_other', { count: request.shifts.length }) : t('admin_requests.shift_count_one', { count: request.shifts.length })} · {format(parseISO(request.created_at), 'MMM d, HH:mm')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendingShifts.length > 0 && (
            <>
              <button className="btn-primary btn-sm" onClick={() => handleApplyAll('approved')}><CheckCheck className="w-3.5 h-3.5" />{t('admin_requests.approve_all')}</button>
              <button className="btn-danger btn-sm" onClick={() => handleApplyAll('rejected')}><XCircle className="w-3.5 h-3.5" />{t('admin_requests.reject_all')}</button>
            </>
          )}
          <button className="btn-secondary btn-sm" onClick={() => setExpanded((e) => !e)}>
            {expanded ? <><ChevronDown className="w-3.5 h-3.5" />{t('admin_requests.collapse')}</> : <><ChevronRight className="w-3.5 h-3.5" />{t('admin_requests.details')}</>}
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
                  <span className={s.decision === 'approved' ? 'badge-green' : 'badge-red'}>{t(`admin_requests.${s.decision}`)}</span>
                ) : (
                  <div className="flex gap-1.5">
                    <button
                      className={`btn-sm ${localDecisions[s.shift_id] === 'approved' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => {
                        const d = localDecisions[s.shift_id] === 'approved' ? '' : 'approved';
                        setLocalDecisions((prev) => ({ ...prev, [s.shift_id]: d as any }));
                      }}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className={`btn-sm ${localDecisions[s.shift_id] === 'rejected' ? 'btn-danger' : 'btn-secondary'}`}
                      onClick={() => {
                        const d = localDecisions[s.shift_id] === 'rejected' ? '' : 'rejected';
                        setLocalDecisions((prev) => ({ ...prev, [s.shift_id]: d as any }));
                      }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {Object.values(localDecisions).some((d) => d === 'approved' || d === 'rejected') && (
            <button className="btn-primary btn-sm mt-2" onClick={handleApplySelected}>{t('admin_requests.apply_selected')}</button>
          )}
        </div>
      )}
    </div>
  );
}

export default function Requests() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
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
      <h1 className="text-2xl font-bold text-gray-900">{t('admin_requests.title')}</h1>

      <div className="flex gap-3">
        <select className="input max-w-xs" value={scheduleFilter} onChange={(e) => setScheduleFilter(e.target.value)}>
          {schedules.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="input max-w-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">{t('admin_requests.all_statuses')}</option>
          <option value="pending">{t('admin_requests.pending')}</option>
          <option value="partial">{t('admin_requests.partial')}</option>
          <option value="approved">{t('admin_requests.approved')}</option>
          <option value="rejected">{t('admin_requests.rejected')}</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : filteredRequests.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">{t('admin_requests.no_requests')}</div>
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
