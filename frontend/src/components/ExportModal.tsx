import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import type { GridData, ShiftState } from '../types/index';
import { X, Copy, Check, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ExportModalProps {
  grid: GridData;
  onClose: () => void;
}

type DateScope = 'today' | 'all' | 'custom';

export default function ExportModal({ grid, onClose }: ExportModalProps) {
  const { t } = useTranslation();
  const [scope, setScope] = useState<DateScope>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<Set<ShiftState>>(
    new Set(['in_shift', 'available', 'home'])
  );
  const [copied, setCopied] = useState(false);

  const toggleStatus = (s: ShiftState) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };

  const { schedule, shifts, members } = grid;
  const tz = schedule.timezone;

  // All unique shift-date strings (yyyy-MM-dd) in schedule timezone, sorted
  const allDates = useMemo(() => {
    const seen = new Set<string>();
    shifts.forEach((s) => {
      seen.add(formatInTimeZone(parseISO(s.start_datetime), tz, 'yyyy-MM-dd'));
    });
    return Array.from(seen).sort();
  }, [shifts, tz]);

  const todayStr = formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');
  const todayInSchedule = allDates.includes(todayStr);

  // Date strings to generate recap for, based on chosen scope
  const targetDates = useMemo((): string[] => {
    if (scope === 'today') return todayInSchedule ? [todayStr] : [];
    if (scope === 'all') return allDates;
    if (!customFrom || !customTo) return [];
    return allDates.filter((d) => d >= customFrom && d <= customTo);
  }, [scope, customFrom, customTo, allDates, todayStr, todayInSchedule]);

  // Build the copy-paste recap text
  const recapText = useMemo(() => {
    if (targetDates.length === 0 || selectedStatuses.size === 0) return '';

    const lines: string[] = [];

    targetDates.forEach((dateStr, idx) => {
      if (idx > 0) lines.push('');

      const dayLabel = format(parseISO(dateStr), 'EEEE, MMM d');
      lines.push(`📋 ${schedule.name} — ${dayLabel}`);

      const dayShifts = shifts.filter(
        (s) => formatInTimeZone(parseISO(s.start_datetime), tz, 'yyyy-MM-dd') === dateStr
      );

      if (dayShifts.length === 0) {
        lines.push(t('export.no_shifts_on_day'));
        return;
      }

      dayShifts.forEach((shift) => {
        const startTime = formatInTimeZone(parseISO(shift.start_datetime), tz, 'HH:mm');
        const endTime = formatInTimeZone(parseISO(shift.end_datetime), tz, 'HH:mm');
        const stat = grid.shift_stats.find((s) => s.shift_id === shift.id);
        const count = stat?.in_shift_count ?? 0;
        const cap = stat?.capacity ?? schedule.capacity;

        lines.push('');
        lines.push(`🕐 ${startTime}–${endTime}  [${count}/${cap}]`);

        const inShift = members
          .filter((m) => m.states.find((s) => s.shift_id === shift.id)?.state === 'in_shift')
          .map((m) => m.user.display_name || m.user.name);

        const home = members
          .filter((m) => m.states.find((s) => s.shift_id === shift.id)?.state === 'home')
          .map((m) => m.user.display_name || m.user.name);

        const available = members
          .filter((m) => {
            const state = m.states.find((s) => s.shift_id === shift.id)?.state ?? 'available';
            return state === 'available';
          })
          .map((m) => m.user.display_name || m.user.name);

        if (selectedStatuses.has('in_shift') && inShift.length > 0)
          lines.push(`✅ ${t('shifts.in_shift')}: ${inShift.join(', ')}`);
        if (selectedStatuses.has('home') && home.length > 0)
          lines.push(`🏠 ${t('shifts.home')}: ${home.join(', ')}`);
        if (selectedStatuses.has('available') && available.length > 0)
          lines.push(`⬜ ${t('shifts.available')}: ${available.join(', ')}`);
      });
    });

    return lines.join('\n').trim();
  }, [targetDates, selectedStatuses, shifts, members, schedule, grid.shift_stats, tz, t]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(recapText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scheduleStart = schedule.start_date.slice(0, 10);
  const scheduleEnd = schedule.end_date.slice(0, 10);

  const emptyMessage =
    scope === 'today' && !todayInSchedule
      ? t('export.today_outside_range')
      : scope === 'custom' && (!customFrom || !customTo)
      ? t('export.select_range')
      : targetDates.length === 0
      ? t('export.no_data_in_range')
      : selectedStatuses.size === 0
      ? t('export.no_statuses_selected')
      : null;

  const statusConfig: { state: ShiftState; emoji: string; active: string; inactive: string }[] = [
    { state: 'in_shift', emoji: '✅', active: 'bg-green-600 text-white border-green-600', inactive: 'bg-white text-gray-500 border-gray-300 hover:border-green-400' },
    { state: 'available', emoji: '⬜', active: 'bg-gray-600 text-white border-gray-600', inactive: 'bg-white text-gray-500 border-gray-300 hover:border-gray-400' },
    { state: 'home', emoji: '🏠', active: 'bg-red-500 text-white border-red-500', inactive: 'bg-white text-gray-500 border-gray-300 hover:border-red-400' },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl flex flex-col gap-5 p-6 max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{t('export.title')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Date scope */}
        <div>
          <div className="text-sm font-medium text-gray-700 mb-2">{t('export.date_range')}</div>
          <div className="flex gap-2 flex-wrap">
            {(['today', 'all', 'custom'] as DateScope[]).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                disabled={s === 'today' && !todayInSchedule}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors
                  ${scope === s
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400'}
                  disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {s === 'today' ? t('export.scope_today') : s === 'all' ? t('export.scope_all') : t('export.scope_custom')}
              </button>
            ))}
          </div>

          {scope === 'custom' && (
            <div className="flex gap-3 mt-3 items-center">
              <input
                type="date"
                value={customFrom}
                min={scheduleStart}
                max={customTo || scheduleEnd}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="input flex-1"
              />
              <span className="text-gray-400">–</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || scheduleStart}
                max={scheduleEnd}
                onChange={(e) => setCustomTo(e.target.value)}
                className="input flex-1"
              />
            </div>
          )}
        </div>

        {/* Status filter */}
        <div>
          <div className="text-sm font-medium text-gray-700 mb-2">{t('export.status_filter')}</div>
          <div className="flex gap-2">
            {statusConfig.map(({ state, emoji, active, inactive }) => (
              <button
                key={state}
                onClick={() => toggleStatus(state)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors
                  ${selectedStatuses.has(state) ? active : inactive}`}
              >
                {emoji} {t(`shifts.${state}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Export type */}
        <div>
          <div className="text-sm font-medium text-gray-700 mb-2">{t('export.export_type')}</div>
          <div className="border border-blue-200 rounded-lg px-3 py-2 bg-blue-50 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span className="text-sm font-medium text-blue-800">{t('export.daily_recap')}</span>
            <span className="text-xs text-blue-500 ml-auto">{t('export.daily_recap_hint')}</span>
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="text-sm font-medium text-gray-700 mb-2">{t('export.preview')}</div>
          {emptyMessage ? (
            <div className="text-sm text-gray-400 italic p-3 border border-gray-200 rounded-lg bg-gray-50">
              {emptyMessage}
            </div>
          ) : (
            <textarea
              readOnly
              value={recapText}
              className="flex-1 min-h-[160px] max-h-[260px] font-mono text-xs border border-gray-200 rounded-lg p-3 resize-none bg-gray-50 text-gray-800"
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">
            {t('export.close')}
          </button>
          <button
            onClick={handleCopy}
            disabled={!recapText}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {copied
              ? <><Check className="w-4 h-4" /> {t('export.copied')}</>
              : <><Copy className="w-4 h-4" /> {t('export.copy')}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
