import { useState } from 'react';
import { isToday, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import type { GridData, ShiftState, MemberRow, Shift } from '../types';
import ShiftCell from './ShiftCell';
import { useAuth } from '../context/AuthContext';
import { schedulesApi } from '../api/schedules';
import { useQueryClient } from '@tanstack/react-query';

interface ScheduleGridProps {
  data: GridData;
  isAdminView?: boolean;
}

const STATE_LABELS: Record<ShiftState, string> = {
  in_shift: 'In Shift',
  available: 'Available',
  home: 'Home',
};

function ShiftHeader({
  shift, inShiftCount, capacity, isSelectMode, allSelected, onToggleColumn, isAdminView, timezone,
}: {
  shift: Shift; inShiftCount: number; capacity: number;
  isSelectMode: boolean; allSelected: boolean; onToggleColumn: () => void; isAdminView: boolean; timezone: string;
}) {
  const start = parseISO(shift.start_datetime);
  const isTodayShift = isToday(start);
  const isUnder = inShiftCount < capacity;
  const isOver = inShiftCount > capacity;

  return (
    <div
      className={`min-w-[90px] p-1.5 text-center ${isTodayShift ? 'bg-blue-50' : ''}
        ${isAdminView ? 'cursor-pointer hover:bg-amber-50 transition-colors' : ''}`}
      onClick={isAdminView ? onToggleColumn : undefined}
      title={isAdminView ? 'Click to select column' : undefined}
    >
      <div className={`w-3.5 h-3.5 rounded border mx-auto mb-0.5 flex items-center justify-center transition-opacity
        ${isSelectMode ? 'opacity-100' : 'opacity-0'}
        ${allSelected ? 'bg-amber-400 border-amber-500' : 'border-gray-300 bg-white'}`}>
        {allSelected && <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
      </div>
      <div className="text-[10px] text-gray-500 leading-tight">{formatInTimeZone(start, timezone, 'MMM d')}</div>
      <div className="text-[10px] font-medium text-gray-700 leading-tight">
        {formatInTimeZone(start, timezone, 'HH:mm')}–{formatInTimeZone(parseISO(shift.end_datetime), timezone, 'HH:mm')}
      </div>
      <div className={`mt-0.5 text-[10px] font-semibold px-1 py-0.5 rounded-full inline-block
        ${isOver ? 'bg-blue-100 text-blue-700' : isUnder ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
        {inShiftCount}/{capacity}
      </div>
    </div>
  );
}

function MemberLabel({
  member, isMe, isSelectMode, allSelected, onToggleRow, isAdminView,
}: {
  member: MemberRow; isMe: boolean;
  isSelectMode: boolean; allSelected: boolean; onToggleRow: () => void; isAdminView: boolean;
}) {
  return (
    <div
      className={`min-w-[140px] max-w-[140px] px-2 py-1.5 flex items-center gap-1.5
        ${member.is_fill_in ? 'bg-purple-50' : isMe ? 'bg-blue-50' : 'bg-white'}
        ${isAdminView ? 'cursor-pointer hover:bg-amber-50 transition-colors' : ''}`}
      onClick={isAdminView ? onToggleRow : undefined}
      title={isAdminView ? 'Click to select row' : undefined}
    >
      <div className={`flex-shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center transition-opacity
        ${isSelectMode ? 'opacity-100' : 'opacity-0'}
        ${allSelected ? 'bg-amber-400 border-amber-500' : 'border-gray-300 bg-white'}`}>
        {allSelected && <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
      </div>
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1">
          <span className={`text-sm font-medium truncate ${isMe ? 'text-blue-700' : 'text-gray-900'}`}>
            {member.user.name}
          </span>
          {isMe && <span className="text-[9px] font-semibold text-blue-500 bg-blue-100 px-1 py-0.5 rounded-full leading-none flex-shrink-0">You</span>}
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
    </div>
  );
}

export default function ScheduleGrid({ data, isAdminView = false }: ScheduleGridProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Edit mode state
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, ShiftState>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Select mode — derived from whether any cells are selected
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const isSelectMode = selectedCells.size > 0;

  // Warning modal
  const [warning, setWarning] = useState<{
    keys: string[];
    state: ShiftState;
    affectedNames: string[];
  } | null>(null);

  const { schedule, shifts, members, shift_stats } = data;
  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  const getStatFor = (shiftId: number) =>
    shift_stats.find((s) => s.shift_id === shiftId) ?? { in_shift_count: 0, capacity: schedule.capacity };

  // ─── Pending changes helpers ─────────────────────────────────────────────────

  const stageChanges = (updates: Record<string, ShiftState>) => {
    setPendingChanges((prev) => ({ ...prev, ...updates }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await Promise.all(
        Object.entries(pendingChanges).map(([key, state]) => {
          const [shiftId, userId] = key.split(':').map(Number);
          return schedulesApi.setShiftState(schedule.id, shiftId, userId, state);
        })
      );
      setPendingChanges({});
      await queryClient.invalidateQueries({ queryKey: ['grid', schedule.id] });
    } catch (err) {
      console.error('Failed to save changes', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setPendingChanges({});
    setEditingCell(null);
  };

  // ─── Single-cell edit ────────────────────────────────────────────────────────

  const handleSingleStateSelect = (member: MemberRow, shift: Shift, newState: ShiftState, hasPending: boolean) => {
    const key = `${shift.id}:${member.user.id}`;
    if (newState === 'in_shift' && hasPending) {
      setWarning({ keys: [key], state: newState, affectedNames: [member.user.name] });
      setEditingCell(null);
      return;
    }
    stageChanges({ [key]: newState });
    setEditingCell(null);
  };

  // ─── Select mode ─────────────────────────────────────────────────────────────

  const toggleCell = (key: string) => {
    setSelectedCells((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleRow = (member: MemberRow) => {
    setEditingCell(null);
    const keys = shifts.map((s) => `${s.id}:${member.user.id}`);
    const allSelected = keys.every((k) => selectedCells.has(k));
    setSelectedCells((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (allSelected ? next.delete(k) : next.add(k)));
      return next;
    });
  };

  const toggleColumn = (shift: Shift) => {
    const keys = members.map((m) => `${shift.id}:${m.user.id}`);
    const allSelected = keys.every((k) => selectedCells.has(k));
    setSelectedCells((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (allSelected ? next.delete(k) : next.add(k)));
      return next;
    });
  };

  const applyToSelected = (newState: ShiftState) => {
    const keys = Array.from(selectedCells);

    // Check if any selected cell has a pending home request and we're setting in_shift
    if (newState === 'in_shift') {
      const affected: string[] = [];
      const affectedNames: string[] = [];
      keys.forEach((key) => {
        const [shiftId, userId] = key.split(':').map(Number);
        const member = members.find((m) => m.user.id === userId);
        const stateObj = member?.states.find((s) => s.shift_id === shiftId);
        if (stateObj?.has_pending_request) {
          affected.push(key);
          if (member) affectedNames.push(member.user.name);
        }
      });
      if (affected.length > 0) {
        setWarning({ keys, state: newState, affectedNames });
        return;
      }
    }

    const updates = Object.fromEntries(keys.map((k) => [k, newState]));
    stageChanges(updates);
    setSelectedCells(new Set());
  };

  const confirmWarning = () => {
    if (!warning) return;
    const updates = Object.fromEntries(warning.keys.map((k) => [k, warning.state]));
    stageChanges(updates);
    setSelectedCells(new Set());
    setEditingCell(null);
    setWarning(null);
  };

  const isRowAllSelected = (member: MemberRow) =>
    shifts.every((s) => selectedCells.has(`${s.id}:${member.user.id}`));

  const isColumnAllSelected = (shift: Shift) =>
    members.every((m) => selectedCells.has(`${shift.id}:${m.user.id}`));

  return (
    <div>
      {/* Warning modal */}
      {warning && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="font-semibold text-gray-900 mb-2">Pending Home Request</h3>
            <p className="text-sm text-gray-600 mb-4">
              {warning.affectedNames.length === 1
                ? <><strong>{warning.affectedNames[0]}</strong> has</>
                : <><strong>{warning.affectedNames.join(', ')}</strong> have</>}{' '}
              a pending home request for one or more of these shifts. Assigning to <strong>In Shift</strong> will not cancel their request — it remains pending until explicitly resolved.
            </p>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setWarning(null)}>Cancel</button>
              <button className="btn-primary" onClick={confirmWarning}>Stage Anyway</button>
            </div>
          </div>
        </div>
      )}

      {/* Action bar — fixed height slot, always reserves space in admin view to avoid layout shift */}
      {isAdminView && (
        <div className="h-12 mb-3 flex items-stretch">
          {isSelectMode ? (
            /* ── Selection mode: blue bar ── */
            <div className="flex-1 flex items-center gap-3 bg-blue-600 text-white rounded-xl px-4 shadow-md">
              <span className="text-sm font-semibold whitespace-nowrap">
                {selectedCells.size} cell{selectedCells.size !== 1 ? 's' : ''} selected
              </span>
              <div className="w-px h-5 bg-blue-400" />
              <span className="text-xs text-blue-200 whitespace-nowrap">Set to:</span>
              {(['in_shift', 'available', 'home'] as ShiftState[]).map((state) => (
                <button
                  key={state}
                  onClick={() => applyToSelected(state)}
                  className="text-xs font-medium bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
                >
                  {STATE_LABELS[state]}
                </button>
              ))}
              <div className="flex-1" />
              {hasPendingChanges && (
                <span className="text-xs bg-amber-400 text-amber-900 font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                  {Object.keys(pendingChanges).length} unsaved
                </span>
              )}
              <button
                onClick={() => setSelectedCells(new Set())}
                className="text-xs text-blue-200 hover:text-white transition-colors ml-1"
              >
                Cancel
              </button>
            </div>
          ) : hasPendingChanges ? (
            /* ── Pending changes: amber bar ── */
            <div className="flex-1 flex items-center gap-3 bg-amber-500 text-white rounded-xl px-4 shadow-md">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-semibold whitespace-nowrap">
                {Object.keys(pendingChanges).length} unsaved change{Object.keys(pendingChanges).length !== 1 ? 's' : ''}
              </span>
              <div className="flex-1" />
              <button
                onClick={handleDiscard}
                disabled={isSaving}
                className="text-xs font-medium bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="text-xs font-bold bg-white text-amber-600 hover:bg-amber-50 px-3 py-1 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
              >
                {isSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* Scrollable grid */}
      <div className="overflow-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="border-collapse" style={{ minWidth: 'max-content' }}>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
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
                      isSelectMode={isSelectMode}
                      allSelected={isColumnAllSelected(shift)}
                      onToggleColumn={() => toggleColumn(shift)}
                      isAdminView={isAdminView}
                      timezone={schedule.timezone}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {members.map((member, memberIdx) => {
              const isPrimaryBoundary =
                memberIdx > 0 && member.is_fill_in && !members[memberIdx - 1].is_fill_in;
              const isMe = member.user.id === user?.id;

              return (
                <>
                  {isPrimaryBoundary && (
                    <tr key={`divider-${memberIdx}`}>
                      <td colSpan={shifts.length + 1} className="bg-gray-100 border-y border-gray-200 px-3 py-1">
                        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                          Fill-in Members
                        </span>
                      </td>
                    </tr>
                  )}
                  <tr
                    key={member.user.id}
                    className={`border-b border-gray-100 hover:bg-gray-50/50 ${
                      isMe ? 'bg-blue-50/40' : member.is_fill_in ? 'bg-purple-50/30' : 'bg-white'
                    }`}
                  >
                    {/* Sticky name cell */}
                    <td className={`sticky left-0 z-10 border-r border-gray-200 ${
                      isMe ? 'border-l-2 border-l-blue-400 bg-blue-50' : member.is_fill_in ? 'bg-purple-50' : 'bg-white'
                    }`}>
                      <MemberLabel
                        member={member}
                        isMe={isMe}
                        isSelectMode={isSelectMode}
                        allSelected={isRowAllSelected(member)}
                        onToggleRow={() => toggleRow(member)}
                        isAdminView={isAdminView}
                      />
                    </td>

                    {/* Shift cells */}
                    {shifts.map((shift) => {
                      const stateObj = member.states.find((s) => s.shift_id === shift.id);
                      const savedState = stateObj?.state ?? 'available';
                      const hasPending = stateObj?.has_pending_request ?? false;
                      const cellKey = `${shift.id}:${member.user.id}`;
                      const stagedState = pendingChanges[cellKey];
                      const displayState = stagedState ?? savedState;
                      const isDirty = stagedState !== undefined;
                      const isSelected = selectedCells.has(cellKey);
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
                                defaultValue={displayState}
                                onBlur={() => setEditingCell(null)}
                                onChange={(e) =>
                                  handleSingleStateSelect(member, shift, e.target.value as ShiftState, hasPending)
                                }
                              >
                                <option value="in_shift">In Shift</option>
                                <option value="available">Available</option>
                                <option value="home">Home</option>
                              </select>
                            </div>
                          ) : (
                            <div
                              className={[
                                isDirty ? 'ring-2 ring-amber-400 ring-dashed rounded-lg' : '',
                                isSelected ? 'ring-2 ring-amber-500 rounded-lg bg-amber-50' : '',
                              ].join(' ')}
                              onClick={isAdminView ? () => toggleCell(cellKey) : undefined}
                              onDoubleClick={isAdminView ? () => { setSelectedCells(new Set()); setEditingCell(cellKey); } : undefined}
                            >
                              <ShiftCell
                                state={displayState}
                                hasPendingRequest={hasPending}
                                isAdmin={false}
                                onClick={undefined}
                                disabled={isSaving}
                              />
                            </div>
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
