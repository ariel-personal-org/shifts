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

const STATE_LABELS: Record<ShiftState, string> = {
  in_shift: 'In Shift',
  available: 'Available',
  home: 'Home',
};

function ShiftHeader({
  shift, inShiftCount, capacity, isSelectMode, allSelected, onToggleColumn,
}: {
  shift: Shift; inShiftCount: number; capacity: number;
  isSelectMode: boolean; allSelected: boolean; onToggleColumn: () => void;
}) {
  const start = parseISO(shift.start_datetime);
  const end = parseISO(shift.end_datetime);
  const isTodayShift = isToday(start);
  const isUnder = inShiftCount < capacity;
  const isOver = inShiftCount > capacity;

  return (
    <div
      className={`min-w-[90px] p-1.5 text-center ${isTodayShift ? 'bg-blue-50' : ''}
        ${isSelectMode ? 'cursor-pointer hover:bg-amber-50 transition-colors' : ''}`}
      onClick={isSelectMode ? onToggleColumn : undefined}
      title={isSelectMode ? 'Select / deselect entire column' : undefined}
    >
      {isSelectMode && (
        <div className={`w-3.5 h-3.5 rounded border mx-auto mb-0.5 flex items-center justify-center
          ${allSelected ? 'bg-amber-400 border-amber-500' : 'border-gray-300 bg-white'}`}>
          {allSelected && <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
        </div>
      )}
      <div className="text-[10px] text-gray-500 leading-tight">{format(start, 'MMM d')}</div>
      <div className="text-[10px] font-medium text-gray-700 leading-tight">
        {format(start, 'HH:mm')}–{format(end, 'HH:mm')}
      </div>
      <div className={`mt-0.5 text-[10px] font-semibold px-1 py-0.5 rounded-full inline-block
        ${isOver ? 'bg-blue-100 text-blue-700' : isUnder ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
        {inShiftCount}/{capacity}
      </div>
    </div>
  );
}

function MemberLabel({
  member, isMe, isSelectMode, allSelected, onToggleRow,
}: {
  member: MemberRow; isMe: boolean;
  isSelectMode: boolean; allSelected: boolean; onToggleRow: () => void;
}) {
  return (
    <div
      className={`min-w-[140px] max-w-[140px] px-2 py-1.5 flex items-center gap-1.5
        ${member.is_fill_in ? 'bg-purple-50' : isMe ? 'bg-blue-50' : 'bg-white'}
        ${isSelectMode ? 'cursor-pointer hover:bg-amber-50 transition-colors' : ''}`}
      onClick={isSelectMode ? onToggleRow : undefined}
      title={isSelectMode ? 'Select / deselect entire row' : undefined}
    >
      {isSelectMode && (
        <div className={`flex-shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center
          ${allSelected ? 'bg-amber-400 border-amber-500' : 'border-gray-300 bg-white'}`}>
          {allSelected && <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
        </div>
      )}
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

  // Select mode state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());

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

  const toggleSelectMode = () => {
    setIsSelectMode((v) => !v);
    setSelectedCells(new Set());
    setEditingCell(null);
  };

  const toggleCell = (key: string) => {
    setSelectedCells((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleRow = (member: MemberRow) => {
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
    <div className="space-y-3">
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

      {/* Toolbar */}
      {isAdminView && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Left: select mode toggle */}
          <button
            className={`btn-sm flex items-center gap-1.5 ${isSelectMode ? 'btn-primary' : 'btn-secondary'}`}
            onClick={toggleSelectMode}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {isSelectMode ? 'Exit Select' : 'Select Mode'}
          </button>

          {/* Center: bulk action bar (shown when cells are selected) */}
          {isSelectMode && selectedCells.size > 0 && (
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm">
              <span className="text-xs text-gray-500 font-medium">{selectedCells.size} selected — set to:</span>
              {(['in_shift', 'available', 'home'] as ShiftState[]).map((state) => (
                <button
                  key={state}
                  className="btn-sm btn-secondary text-xs"
                  onClick={() => applyToSelected(state)}
                >
                  {STATE_LABELS[state]}
                </button>
              ))}
              <button
                className="text-xs text-gray-400 hover:text-gray-600 ml-1"
                onClick={() => setSelectedCells(new Set())}
              >
                Clear
              </button>
            </div>
          )}

          {/* Right: pending changes bar */}
          {hasPendingChanges && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
              <span className="text-sm text-amber-800 font-medium">
                {Object.keys(pendingChanges).length} unsaved change{Object.keys(pendingChanges).length !== 1 ? 's' : ''}
              </span>
              <button className="btn-secondary btn-sm" onClick={handleDiscard} disabled={isSaving}>Discard</button>
              <button className="btn-primary btn-sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          )}
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
                              onClick={isSelectMode ? () => toggleCell(cellKey) : undefined}
                            >
                              <ShiftCell
                                state={displayState}
                                hasPendingRequest={hasPending}
                                isAdmin={isAdminView && !isSelectMode}
                                onClick={
                                  !isSelectMode ? () => setEditingCell(cellKey) : undefined
                                }
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
