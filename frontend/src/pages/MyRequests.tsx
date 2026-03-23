import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { schedulesApi } from '../api/schedules';
import { homeRequestsApi } from '../api/homeRequests';
import { useAuth } from '../context/AuthContext';
import type { HomeRequest, RequestStatus } from '../types';

const STATUS_STYLES: Record<RequestStatus, string> = {
  pending: 'badge-yellow',
  partial: 'badge-blue',
  approved: 'badge-green',
  rejected: 'badge-red',
};

const DECISION_STYLES: Record<string, string> = {
  pending: 'badge-yellow',
  approved: 'badge-green',
  rejected: 'badge-red',
};

function RequestCard({ request }: { request: HomeRequest }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={STATUS_STYLES[request.status]}>{request.status}</span>
          <span className="text-sm text-gray-600">
            {request.shifts.length} shift{request.shifts.length !== 1 ? 's' : ''}
          </span>
          <span className="text-xs text-gray-400">
            {format(parseISO(request.created_at), 'MMM d, yyyy HH:mm')}
          </span>
        </div>
        <button
          className="text-xs text-blue-600 hover:underline"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? 'Hide' : 'Details'}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-1.5">
          {request.shifts.map((s) => (
            <div key={s.shift_id} className="flex items-center justify-between text-sm py-1 border-b border-gray-100 last:border-0">
              <span className="text-gray-700">
                {formatInTimeZone(parseISO(s.shift.start_datetime), request.schedule_timezone, 'EEE MMM d, HH:mm')} – {formatInTimeZone(parseISO(s.shift.end_datetime), request.schedule_timezone, 'HH:mm')}
              </span>
              <span className={DECISION_STYLES[s.decision]}>{s.decision}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MyRequests() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [selectedShiftIds, setSelectedShiftIds] = useState<number[]>([]);
  const [showForm, setShowForm] = useState(false);

  const { data: schedules = [] } = useQuery({
    queryKey: ['schedules'],
    queryFn: schedulesApi.list,
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts', selectedScheduleId],
    queryFn: () => schedulesApi.getShifts(selectedScheduleId!),
    enabled: !!selectedScheduleId,
  });

  const { data: gridData } = useQuery({
    queryKey: ['grid', selectedScheduleId],
    queryFn: () => schedulesApi.getGrid(selectedScheduleId!),
    enabled: !!selectedScheduleId,
  });

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['my-requests'],
    queryFn: () => homeRequestsApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      homeRequestsApi.create({
        schedule_id: selectedScheduleId!,
        shift_ids: selectedShiftIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
      queryClient.invalidateQueries({ queryKey: ['grid'] });
      setShowForm(false);
      setSelectedShiftIds([]);
      setSelectedScheduleId(null);
    },
  });

  const myMemberShiftIds = gridData?.members
    .find((m) => m.user.id === user?.id)
    ?.states.map((s) => s.shift_id) ?? [];

  const eligibleShifts = shifts.filter((s) => myMemberShiftIds.includes(s.id));

  const toggleShift = (shiftId: number) => {
    setSelectedShiftIds((prev) =>
      prev.includes(shiftId) ? prev.filter((id) => id !== shiftId) : [...prev, shiftId]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Home Requests</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + New Request
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Request Home</h2>

          <div>
            <label className="label">Schedule</label>
            <select
              className="input"
              value={selectedScheduleId ?? ''}
              onChange={(e) => {
                setSelectedScheduleId(Number(e.target.value) || null);
                setSelectedShiftIds([]);
              }}
            >
              <option value="">Select a schedule…</option>
              {schedules.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {selectedScheduleId && eligibleShifts.length > 0 && (
            <div>
              <label className="label">Select Shifts (click to toggle)</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                {eligibleShifts.map((shift) => {
                  const isSelected = selectedShiftIds.includes(shift.id);
                  const myState = gridData?.members
                    .find((m) => m.user.id === user?.id)
                    ?.states.find((s) => s.shift_id === shift.id);
                  const hasPending = myState?.has_pending_request;

                  return (
                    <button
                      key={shift.id}
                      onClick={() => !hasPending && toggleShift(shift.id)}
                      disabled={!!hasPending}
                      className={`text-left p-2 rounded-lg border text-xs transition-all ${
                        hasPending
                          ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
                          : isSelected
                          ? 'border-blue-500 bg-blue-50 text-blue-800'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      <div className="font-medium">{formatInTimeZone(parseISO(shift.start_datetime), gridData!.schedule.timezone, 'EEE MMM d')}</div>
                      <div className="text-gray-500">{formatInTimeZone(parseISO(shift.start_datetime), gridData!.schedule.timezone, 'HH:mm')}–{formatInTimeZone(parseISO(shift.end_datetime), gridData!.schedule.timezone, 'HH:mm')}</div>
                      {hasPending && <div className="text-amber-600 mt-0.5">Already pending</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedScheduleId && eligibleShifts.length === 0 && (
            <p className="text-sm text-gray-500">No eligible shifts found. You may not be a member of this schedule.</p>
          )}

          <div className="flex gap-3">
            <button
              className="btn-primary"
              disabled={selectedShiftIds.length === 0 || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? 'Submitting…' : `Submit Request (${selectedShiftIds.length} shifts)`}
            </button>
            <button className="btn-secondary" onClick={() => { setShowForm(false); setSelectedShiftIds([]); setSelectedScheduleId(null); }}>
              Cancel
            </button>
          </div>

          {createMutation.isError && (
            <p className="text-red-600 text-sm">
              {(createMutation.error as any)?.response?.data?.error ?? 'Failed to create request'}
            </p>
          )}
        </div>
      )}

      {/* Request list */}
      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : requests.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">No home requests yet.</div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <RequestCard key={r.request_id} request={r} />
          ))}
        </div>
      )}
    </div>
  );
}
