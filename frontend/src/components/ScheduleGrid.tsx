import { useState } from 'react';
import { isToday, isBefore, startOfDay, parseISO } from 'date-fns';
import { he as heLocale, enUS } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';
import type { GridData, ShiftState, MemberRow, Shift } from '../types';
import ShiftCell from './ShiftCell';
import { useAuth } from '../context/AuthContext';
import { schedulesApi } from '../api/schedules';
import { useQueryClient } from '@tanstack/react-query';
import { Check, AlertCircle, Star, Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ScheduleGridProps {
  data: GridData;
  isAdminView?: boolean;
  scrollRef?: React.RefObject<HTMLDivElement>;
}

function ShiftHeader({
  shift, inShiftCount, capacity, isSelectMode, allSelected, onToggleColumn, isAdminView, timezone, shiftLabel,
}: {
  shift: Shift; inShiftCount: number; capacity: number;
  isSelectMode: boolean; allSelected: boolean; onToggleColumn: () => void; isAdminView: boolean; timezone: string;
  shiftLabel?: 'day' | 'night';
}) {
  const { i18n, t } = useTranslation();
  const dateLocale = i18n.language === 'he' ? heLocale : enUS;
  const start = parseISO(shift.start_datetime);
  const isTodayShift = isToday(start);
  const isUnder = inShiftCount < capacity;
  const isOver = inShiftCount > capacity;

  return (
    <div
      className={`min-w-[60px] sm:min-w-[90px] p-1 sm:p-1.5 text-center ${isTodayShift ? 'bg-blue-50' : ''}
        ${isAdminView ? 'cursor-pointer hover:bg-amber-50 transition-colors' : ''}`}
      onClick={isAdminView ? onToggleColumn : undefined}
      title={isAdminView ? 'Click to select column' : undefined}
    >
      <div className={`w-3.5 h-3.5 rounded border mx-auto mb-0.5 flex items-center justify-center transition-opacity
        ${isSelectMode ? 'opacity-100' : 'opacity-0'}
        ${allSelected ? 'bg-amber-400 border-amber-500' : 'border-gray-300 bg-white'}`}>
        {allSelected && <Check className="w-2.5 h-2.5 text-white" />}
      </div>
      <div className="text-[10px] font-semibold text-gray-700 leading-tight">
        <span className="sm:hidden">{formatInTimeZone(start, timezone, 'EEE', { locale: dateLocale })}</span>
        <span className="hidden sm:inline">{formatInTimeZone(start, timezone, 'EEEE', { locale: dateLocale })}</span>
      </div>
      <div className="text-[10px] text-gray-500 leading-tight">
        {formatInTimeZone(start, timezone, 'dd/MM')}
      </div>
      <div className="text-[10px] font-medium text-gray-700 leading-tight">
        {shiftLabel
          ? t(`grid.shift_${shiftLabel}`)
          : <>
              <span className="sm:hidden">{formatInTimeZone(start, timezone, 'H')}–{formatInTimeZone(parseISO(shift.end_datetime), timezone, 'H')}</span>
              <span className="hidden sm:inline">{formatInTimeZone(start, timezone, 'HH:mm')}–{formatInTimeZone(parseISO(shift.end_datetime), timezone, 'HH:mm')}</span>
            </>
        }
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
  const { t } = useTranslation();
  return (
    <div
      className={`min-w-[100px] max-w-[100px] sm:min-w-[140px] sm:max-w-[140px] px-1 sm:px-2 py-1 flex items-center gap-1 sm:gap-1.5
        ${member.is_fill_in ? 'bg-purple-50' : isMe ? 'bg-blue-50' : 'bg-white'}
        ${isAdminView ? 'cursor-pointer hover:bg-amber-50 transition-colors' : ''}`}
      onClick={isAdminView ? onToggleRow : undefined}
      title={isAdminView ? 'Click to select row' : undefined}
    >
      <div className={`flex-shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center transition-opacity
        ${isSelectMode ? 'opacity-100' : 'opacity-0'}
        ${allSelected ? 'bg-amber-400 border-amber-500' : 'border-gray-300 bg-white'}`}>
        {allSelected && <Check className="w-2.5 h-2.5 text-white" />}
      </div>
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1">
          <span className={`text-xs sm:text-sm font-medium truncate ${isMe ? 'text-blue-700' : 'text-gray-900'}`}>
            {member.user.display_name || member.user.name}
          </span>
          {isMe && <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-semibold text-blue-500 bg-blue-100 px-1 py-0.5 rounded-full leading-none flex-shrink-0"><Star className="w-2 h-2" />{t('grid.you_label')}</span>}
          {member.user.is_virtual && <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-semibold text-yellow-700 bg-yellow-100 px-1 py-0.5 rounded-full leading-none flex-shrink-0"><Monitor className="w-2 h-2" />{t('grid.virtual_label')}</span>}
        </div>
        {member.team && (
          <span className="hidden sm:block text-[10px] text-gray-400 truncate">{member.team.name}</span>
        )}
      </div>
    </div>
  );
}

export default function ScheduleGrid({ data, isAdminView = false, scrollRef }: ScheduleGridProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Hide past shifts toggle
  const [hideOldShifts, setHideOldShifts] = useState(false);

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

  const { schedule, shifts: allShifts, members, shift_stats } = data;
  const today = startOfDay(new Date());
  const shifts = hideOldShifts
    ? allShifts.filter((s) => !isBefore(startOfDay(parseISO(s.start_datetime)), today))
    : allShifts;
  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  // Day/Night labels: if a calendar day has exactly 2 shifts, label first "day", second "night"
  const shiftLabelMap = new Map<number, 'day' | 'night'>();
  const shiftsByDay = new Map<string, Shift[]>();
  shifts.forEach((s) => {
    const day = formatInTimeZone(parseISO(s.start_datetime), schedule.timezone, 'yyyy-MM-dd');
    const group = shiftsByDay.get(day) ?? [];
    group.push(s);
    shiftsByDay.set(day, group);
  });
  shiftsByDay.forEach((group) => {
    if (group.length === 2) {
      shiftLabelMap.set(group[0].id, 'day');
      shiftLabelMap.set(group[1].id, 'night');
    }
  });

  // Shifts that start a new calendar day → bolder left border
  const dayBoundaryShiftIds = new Set<number>();
  shifts.forEach((shift, idx) => {
    if (idx === 0) return;
    const prevDay = formatInTimeZone(parseISO(shifts[idx - 1].start_datetime), schedule.timezone, 'yyyy-MM-dd');
    const currDay = formatInTimeZone(parseISO(shift.start_datetime), schedule.timezone, 'yyyy-MM-dd');
    if (prevDay !== currDay) dayBoundaryShiftIds.add(shift.id);
  });

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
      setWarning({ keys: [key], state: newState, affectedNames: [member.user.display_name || member.user.name] });
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
          if (member) affectedNames.push(member.user.display_name || member.user.name);
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

  const pendingCount = Object.keys(pendingChanges).length;

  return (
    <div>
      {/* Warning modal */}
      {warning && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="font-semibold text-gray-900 mb-2">{t('grid.warning_title')}</h3>
            <p className="text-sm text-gray-600 mb-4">
              {warning.affectedNames.length === 1
                ? <><strong>{warning.affectedNames[0]}</strong> {t('grid.warning_body')}</>
                : <><strong>{warning.affectedNames.join(', ')}</strong> {t('grid.warning_body')}</>}
            </p>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setWarning(null)}>{t('grid.cancel')}</button>
              <button className="btn-primary" onClick={confirmWarning}>{t('grid.stage_anyway')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Action bar — fixed height slot, always reserves space in admin view to avoid layout shift */}
      {isAdminView && (
        <div className="sticky top-14 z-30 bg-gray-50 h-12 mb-3 flex items-stretch">
          {isSelectMode ? (
            /* ── Selection mode: blue bar ── */
            <div className="flex-1 flex items-center gap-3 bg-blue-600 text-white rounded-xl px-4 shadow-md">
              <span className="text-sm font-semibold whitespace-nowrap">
                {selectedCells.size !== 1 ? t('grid.cells_selected_other', { count: selectedCells.size }) : t('grid.cells_selected_one', { count: selectedCells.size })}
              </span>
              <div className="w-px h-5 bg-blue-400" />
              <span className="text-xs text-blue-200 whitespace-nowrap">{t('grid.set_to')}</span>
              {(['in_shift', 'available', 'home'] as ShiftState[]).map((state) => (
                <button
                  key={state}
                  onClick={() => applyToSelected(state)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                    state === 'in_shift'
                      ? 'bg-green-100 hover:bg-green-200 text-green-800'
                      : state === 'home'
                      ? 'bg-red-100 hover:bg-red-200 text-red-800'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {t(`shifts.${state}`)}
                </button>
              ))}
              <div className="flex-1" />
              {hasPendingChanges && (
                <span className="text-xs bg-amber-400 text-amber-900 font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                  {pendingCount !== 1 ? t('grid.unsaved_badge_other', { count: pendingCount }) : t('grid.unsaved_badge_one', { count: pendingCount })}
                </span>
              )}
              <button
                onClick={() => setSelectedCells(new Set())}
                className="text-xs text-blue-200 hover:text-white transition-colors ml-1"
              >
                {t('grid.cancel')}
              </button>
            </div>
          ) : hasPendingChanges ? (
            /* ── Pending changes: amber bar ── */
            <div className="flex-1 flex items-center gap-3 bg-amber-500 text-white rounded-xl px-4 shadow-md">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-semibold whitespace-nowrap">
                {pendingCount !== 1 ? t('grid.unsaved_other', { count: pendingCount }) : t('grid.unsaved_one', { count: pendingCount })}
              </span>
              <div className="flex-1" />
              <button
                onClick={handleDiscard}
                disabled={isSaving}
                className="text-xs font-medium bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
              >
                {t('grid.discard')}
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="text-xs font-bold bg-white text-amber-600 hover:bg-amber-50 px-3 py-1 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
              >
                {isSaving ? t('grid.saving') : t('grid.save_changes')}
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* Scrollable grid */}
      <div ref={scrollRef} className="overflow-auto rounded-xl border border-gray-200 shadow-sm max-h-[calc(100vh-18rem)]" dir="ltr">
        <table className="border-collapse" style={{ minWidth: 'max-content' }}>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="sticky left-0 top-0 z-30 bg-gray-50 border-r border-b-2 border-gray-300 min-w-[100px] max-w-[100px] sm:min-w-[140px] sm:max-w-[140px] px-1 py-1 sm:px-2 sm:py-2 text-left">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider leading-none mb-1">{t('grid.member_col')}</div>
                <button
                  role="switch"
                  aria-checked={hideOldShifts}
                  onClick={() => setHideOldShifts((v) => !v)}
                  className="flex items-center gap-1 group"
                >
                  <span className={`relative inline-flex h-3.5 w-6 flex-shrink-0 rounded-full border border-transparent transition-colors duration-200 ${hideOldShifts ? 'bg-blue-500' : 'bg-gray-300'}`}>
                    <span className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transform transition-transform duration-200 ${hideOldShifts ? 'translate-x-2.5' : 'translate-x-0'}`} />
                  </span>
                  <span className="text-[9px] text-gray-400 group-hover:text-gray-600 transition-colors leading-none whitespace-nowrap">{t('grid.hide_past_label')}</span>
                </button>
              </th>
              {shifts.map((shift) => {
                const isTodayShift = isToday(parseISO(shift.start_datetime));
                return (
                  <th
                    key={shift.id}
                    className={`sticky top-0 z-10 border-r border-b-2 border-gray-300 ${dayBoundaryShiftIds.has(shift.id) ? 'border-l-2 [border-left-color:#d1d5db]' : ''} ${isTodayShift ? 'bg-blue-50' : 'bg-gray-50'}`}
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
                      shiftLabel={shiftLabelMap.get(shift.id)}
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
                      <td className="sticky left-0 z-10 bg-gray-100 border-y border-r-2 border-gray-200 border-r-gray-300 px-3 py-1">
                        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                          {t('grid.fill_in_divider')}
                        </span>
                      </td>
                      <td colSpan={shifts.length} className="bg-gray-100 border-y border-gray-200" />
                    </tr>
                  )}
                  <tr
                    key={member.user.id}
                    className={`border-b border-gray-200 hover:bg-gray-50/50 ${
                      isMe ? 'bg-blue-50/40' : member.is_fill_in ? 'bg-purple-50/30' : 'bg-white'
                    }`}
                  >
                    {/* Sticky name cell */}
                    <td className={`sticky left-0 z-10 border-r-2 border-r-gray-300 ${
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
                          className={`border-r border-gray-100 p-0.5 sm:p-1 ${dayBoundaryShiftIds.has(shift.id) ? 'border-l-2 [border-left-color:#d1d5db]' : ''} ${isTodayShift ? 'bg-blue-50/30' : ''}`}
                        >
                          {isEditing ? (
                            <div className="min-w-[60px] sm:min-w-[90px]">
                              <select
                                autoFocus
                                className="w-full text-xs border border-blue-400 rounded-lg p-1 bg-white shadow-md"
                                defaultValue={displayState}
                                onBlur={() => setEditingCell(null)}
                                onChange={(e) =>
                                  handleSingleStateSelect(member, shift, e.target.value as ShiftState, hasPending)
                                }
                              >
                                <option value="in_shift">{t('shifts.in_shift')}</option>
                                <option value="available">{t('shifts.available')}</option>
                                <option value="home">{t('shifts.home')}</option>
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
