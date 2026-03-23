import { useState } from 'react';
import { format, isToday, parseISO } from 'date-fns';
import type { GridData, ShiftState, MemberRow, Shift } from '../types';
import ShiftCell from './ShiftCell';
import { useAuth } from '../context/AuthContext';
import { schedulesApi } from '../api/schedules';
import { useQueryClient } from '@tanstack/react-query';

interface ScheduleGridProps {
  data: GridData;
  isAdminView?: boolean;
}

const STATE_OPTIONS: ShiftState[] = ['in_shift', 'available', 'home'];

function ShiftHeader({ shift, inShiftCount, capacity }: { shift: Shift; inShiftCount: number; capacity: number }) {
  const start = parseISO(shift.start_datetime);
  const end = parseISO(shift.end_datetime);
  const isTodayShift = isToday(start);
  const ratio = `${inShiftCount}/${capacity}`;
  const isUnder = inShiftCount < capacity;
  const isOver = inShiftCount > capacity;

  return (
    <div className={`min-w-[90px] p-1.5 text-center ${isTodayShift ? 'bg-blue-50' : ''}`}>
      <div className="text-[10px] text-gray-500 leading-tight">
        {format(start, 'MMM d')}
      </div>
      <div className="text-[10px] font-medium text-gray-700 leading-tight">
        {format(start, 'HH:mm')}–{format(end, 'HH:mm')}
      </div>
      <div
        className={`mt-0.5 text-[10px] font-semibold px-1 py-0.5 rounded-full inline-block
          ${isOver ? 'bg-blue-100 text-blue-700' : isUnder ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}
        `}
      >
        {ratio}
      </div>
    </div>
  );
}

function MemberLabel({ member }: { member: MemberRow }) {
  return (
    <div className={`min-w-[140px] max-w-[140px] px-2 py-1.5 flex flex-col justify-center ${member.is_fill_in ? 'bg-purple-50' : 'bg-white'}`}>
      <div className="flex items-center gap-1">
        <span className="text-sm font-medium text-gray-900 truncate">{member.user.name}</span>
      </div>
      <div className="flex items-center gap-1 flex-wrap mt-0.5">
        {member.is_fill_in && (
          <span className="badge badge-purple text-[9px]">
            Fill-in{member.team ? ` · ${member.team.name}` : ''}
          </span>
        )}
        {!member.is_fill_in && member.team && (
          <span className="text-[10px] text-gray-400">{member.team.name}</span>
        )}
      </div>
    </div>
  );
}

export default function ScheduleGrid({ data, isAdminView = false }: ScheduleGridProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [pendingState, setPendingState] = useState<Record<string, ShiftState>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [warning, setWarning] = useState<{
    memberId: number;
    shiftId: number;
    state: ShiftState;
    memberName: string;
  } | null>(null);

  const { schedule, shifts, members, shift_stats } = data;

  const getStatFor = (shiftId: number) =>
    shift_stats.find((s) => s.shift_id === shiftId) ?? { in_shift_count: 0, capacity: schedule.capacity };

  const handleCellClick = (member: MemberRow, shift: Shift, currentState: ShiftState, hasPending: boolean) => {
    if (!isAdminView) return;
    const key = `${shift.id}:${member.user.id}`;
    setEditingCell(key);
  };

  const handleStateChange = async (
    member: MemberRow,
    shift: Shift,
    newState: ShiftState,
    hasPending: boolean
  ) => {
    if (newState === 'in_shift' && hasPending) {
      setWarning({ memberId: member.user.id, shiftId: shift.id, state: newState, memberName: member.user.name });
      setEditingCell(null);
      return;
    }
    await doStateChange(member.user.id, shift.id, newState);
  };

  const doStateChange = async (userId: number, shiftId: number, state: ShiftState) => {
    const key = `${shiftId}:${userId}`;
    setSaving(key);
    setEditingCell(null);
    try {
      await schedulesApi.setShiftState(schedule.id, shiftId, userId, state);
      await queryClient.invalidateQueries({ queryKey: ['grid', schedule.id] });
    } catch (err) {
      console.error('Failed to update state', err);
    } finally {
      setSaving(null);
    }
  };

  const confirmWarning = async () => {
    if (!warning) return;
    await doStateChange(warning.memberId, warning.shiftId, warning.state);
    setWarning(null);
  };

  return (
    <div className="relative">
      {/* Warning modal */}
      {warning && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="font-semibold text-gray-900 mb-2">Pending Home Request</h3>
            <p className="text-sm text-gray-600 mb-4">
              <strong>{warning.memberName}</strong> has a pending home request for this shift. Assigning them to <strong>In Shift</strong> will not cancel their request — it remains pending until explicitly resolved.
            </p>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setWarning(null)}>Cancel</button>
              <button className="btn-primary" onClick={confirmWarning}>Assign Anyway</button>
            </div>
          </div>
        </div>
      )}

      {/* Scrollable grid container */}
      <div className="overflow-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="border-collapse" style={{ minWidth: 'max-content' }}>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {/* Sticky name column header */}
              <th className="sticky left-0 z-20 bg-gray-50 border-r border-gray-200 min-w-[140px] max-w-[140px] px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Member
              </th>
              {shifts.map((shift) => {
                const isTodayShift = isToday(parseISO(shift.start_datetime));
                return (
                  <th
                    key={shift.id}
                    className={`border-r border-gray-200 ${isTodayShift ? 'bg-blue-50' : 'bg-gray-50'}`}
                  >
                    <ShiftHeader
                      shift={shift}
                      inShiftCount={getStatFor(shift.id).in_shift_count}
                      capacity={schedule.capacity}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {members.map((member, memberIdx) => {
              const isPrimaryBoundary =
                memberIdx > 0 &&
                member.is_fill_in &&
                !members[memberIdx - 1].is_fill_in;

              return (
                <>
                  {isPrimaryBoundary && (
                    <tr key={`divider-${memberIdx}`}>
                      <td
                        colSpan={shifts.length + 1}
                        className="bg-gray-100 border-y border-gray-200 px-3 py-1"
                      >
                        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                          Fill-in Members
                        </span>
                      </td>
                    </tr>
                  )}
                  <tr
                    key={member.user.id}
                    className={`border-b border-gray-100 hover:bg-gray-50/50 ${
                      member.is_fill_in ? 'bg-purple-50/30' : 'bg-white'
                    }`}
                  >
                    {/* Sticky name cell */}
                    <td className={`sticky left-0 z-10 border-r border-gray-200 ${member.is_fill_in ? 'bg-purple-50' : 'bg-white'}`}>
                      <MemberLabel member={member} />
                    </td>

                    {/* Shift state cells */}
                    {shifts.map((shift) => {
                      const stateObj = member.states.find((s) => s.shift_id === shift.id);
                      const state = stateObj?.state ?? 'available';
                      const hasPending = stateObj?.has_pending_request ?? false;
                      const cellKey = `${shift.id}:${member.user.id}`;
                      const isSaving = saving === cellKey;
                      const isEditing = editingCell === cellKey;
                      const isTodayShift = isToday(parseISO(shift.start_datetime));

                      return (
                        <td
                          key={shift.id}
                          className={`border-r border-gray-100 p-1.5 ${isTodayShift ? 'bg-blue-50/30' : ''}`}
                        >
                          {isEditing ? (
                            <div className="min-w-[90px]">
                              <select
                                autoFocus
                                className="w-full text-xs border border-blue-400 rounded-lg p-1 bg-white shadow-md"
                                defaultValue={state}
                                onBlur={() => setEditingCell(null)}
                                onChange={(e) => {
                                  handleStateChange(member, shift, e.target.value as ShiftState, hasPending);
                                }}
                              >
                                <option value="in_shift">In Shift</option>
                                <option value="available">Available</option>
                                <option value="home">Home</option>
                              </select>
                            </div>
                          ) : (
                            <ShiftCell
                              state={isSaving ? state : state}
                              hasPendingRequest={hasPending}
                              isAdmin={isAdminView}
                              onClick={() => handleCellClick(member, shift, state, hasPending)}
                              disabled={isSaving}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
