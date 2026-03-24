import { useMemo, useState } from 'react';
import { addHours } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import type { GridData, Schedule } from '../types';
import { X, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  schedule: Schedule;
  grid: GridData;
  onClose: () => void;
  onSave: (updates: { cycle_start_time?: string; shift_duration_hours?: number }) => void;
  isSaving: boolean;
}

function computeShiftCount(
  startDate: string,
  endDate: string,
  cycleStartTime: string,
  durationHours: number,
  timezone: string
): number {
  if (durationHours <= 0) return 0;
  let current = fromZonedTime(`${startDate}T${cycleStartTime}:00`, timezone);
  const end = fromZonedTime(`${endDate}T23:59:59`, timezone);
  let count = 0;
  while (current <= end) {
    count++;
    current = addHours(current, durationHours);
  }
  return count;
}

export default function AdvancedScheduleModal({ schedule, grid, onClose, onSave, isSaving }: Props) {
  const { t } = useTranslation();
  const [startTime, setStartTime] = useState(schedule.cycle_start_time);
  const [duration, setDuration] = useState(schedule.shift_duration_hours);

  const impact = useMemo(() => {
    const newCount = computeShiftCount(
      schedule.start_date,
      schedule.end_date,
      startTime,
      duration,
      schedule.timezone
    );
    const oldCount = grid.shifts.length;
    const deletedShifts = grid.shifts.slice(newCount);
    const deletedIds = new Set(deletedShifts.map((s) => s.id));

    let assignments = 0;
    let requests = 0;
    for (const member of grid.members) {
      for (const state of member.states) {
        if (deletedIds.has(state.shift_id)) {
          if (state.state !== 'available') assignments++;
          if (state.has_pending_request) requests++;
        }
      }
    }

    return {
      oldCount,
      newCount,
      deletedCount: Math.max(0, oldCount - newCount),
      addedCount: Math.max(0, newCount - oldCount),
      assignments,
      requests,
    };
  }, [grid, schedule, startTime, duration]);

  const hasChanges =
    startTime !== schedule.cycle_start_time || duration !== schedule.shift_duration_hours;
  const hasDataLoss = impact.deletedCount > 0 && (impact.assignments > 0 || impact.requests > 0);
  const isInvalid = impact.newCount === 0;
  const canSave = hasChanges && !isInvalid && !isSaving;

  function handleSave() {
    const updates: { cycle_start_time?: string; shift_duration_hours?: number } = {};
    if (startTime !== schedule.cycle_start_time) updates.cycle_start_time = startTime;
    if (duration !== schedule.shift_duration_hours) updates.shift_duration_hours = duration;
    onSave(updates);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">{t('advanced_modal.title')}</h2>
          <button
            className="text-gray-400 hover:text-gray-600"
            onClick={onClose}
            disabled={isSaving}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('advanced_modal.shift_start_time')}
            </label>
            <input
              type="time"
              className="input w-full"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('advanced_modal.shift_duration')}
            </label>
            <input
              type="number"
              min={1}
              max={168}
              className="input w-full"
              value={duration}
              onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
        </div>

        {/* Preview */}
        <div className="mt-5 pt-4 border-t border-gray-100 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">{t('advanced_modal.shifts_label')}</span>
            <span className="font-medium text-gray-900">
              {impact.oldCount}
              {hasChanges && impact.newCount !== impact.oldCount && (
                <span className={impact.newCount < impact.oldCount ? 'text-red-600' : 'text-green-600'}>
                  {' → '}{impact.newCount}
                </span>
              )}
              {hasChanges && impact.newCount === impact.oldCount && impact.oldCount > 0 && (
                <span className="text-gray-400"> {t('advanced_modal.unchanged')}</span>
              )}
            </span>
          </div>

          {hasChanges && impact.addedCount > 0 && (
            <div className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
              {impact.addedCount !== 1 ? t('advanced_modal.shifts_added_other', { count: impact.addedCount }) : t('advanced_modal.shifts_added_one', { count: impact.addedCount })}
            </div>
          )}

          {hasChanges && impact.deletedCount > 0 && (
            <div className="text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-1">
              <div className="flex items-center gap-1 font-medium text-amber-800">
                <AlertTriangle className="w-4 h-4" /> {impact.deletedCount !== 1 ? t('advanced_modal.shifts_removed_other', { count: impact.deletedCount }) : t('advanced_modal.shifts_removed_one', { count: impact.deletedCount })}
              </div>
              {impact.assignments > 0 && (
                <div className="text-amber-700">
                  • {impact.assignments !== 1 ? t('advanced_modal.assignments_cleared_other', { count: impact.assignments }) : t('advanced_modal.assignments_cleared_one', { count: impact.assignments })}
                </div>
              )}
              {impact.requests > 0 && (
                <div className="text-amber-700">
                  • {impact.requests !== 1 ? t('advanced_modal.requests_canceled_other', { count: impact.requests }) : t('advanced_modal.requests_canceled_one', { count: impact.requests })}
                </div>
              )}
              {!hasDataLoss && (
                <div className="text-amber-700">
                  {t('advanced_modal.no_active')}
                </div>
              )}
            </div>
          )}

          {isInvalid && (
            <div className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
              {t('advanced_modal.invalid')}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button className="btn-secondary" onClick={onClose} disabled={isSaving}>
            <X className="w-3.5 h-3.5" /> {t('advanced_modal.cancel')}
          </button>
          {impact.deletedCount > 0 ? (
            <button
              className="btn-danger"
              onClick={handleSave}
              disabled={!canSave}
            >
              {isSaving ? t('advanced_modal.saving') : (impact.deletedCount !== 1 ? t('advanced_modal.delete_btn_other', { count: impact.deletedCount }) : t('advanced_modal.delete_btn_one', { count: impact.deletedCount }))}
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={!canSave}
            >
              {isSaving ? t('advanced_modal.saving') : t('advanced_modal.save')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
