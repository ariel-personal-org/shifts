import { useRef, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { he as heLocale, enUS } from 'date-fns/locale';
import { schedulesApi } from '../api/schedules';
import { useAuth } from '../context/AuthContext';
import ScheduleGrid from '../components/ScheduleGrid';
import { Home, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function ScheduleView() {
  const { id } = useParams<{ id: string }>();
  const scheduleId = parseInt(id!);
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollHint, setShowScrollHint] = useState(true);

  const { data: grid, isLoading, error } = useQuery({
    queryKey: ['grid', scheduleId],
    queryFn: () => schedulesApi.getGrid(scheduleId),
    refetchInterval: 60_000,
  });

  const dateLocale = i18n.language === 'he' ? heLocale : enUS;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setShowScrollHint(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    check();
    el.addEventListener('scroll', check);
    window.addEventListener('resize', check);
    return () => {
      el.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [grid]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !grid) {
    return (
      <div className="card p-8 text-center text-red-600">
        {t('schedule_view.failed_load')} <Link to="/dashboard" className="text-blue-600 hover:underline">{t('schedule_view.go_back')}</Link>
      </div>
    );
  }

  const { schedule } = grid;
  const myMember = grid.members.find((m) => m.user.id === user?.id);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{schedule.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {format(parseISO(schedule.start_date), 'MMM d', { locale: dateLocale })} – {format(parseISO(schedule.end_date), 'MMM d, yyyy', { locale: dateLocale })}
            {' · '}{t('schedule_view.shift_info', { duration: schedule.shift_duration_hours, capacity: schedule.capacity })}
          </p>
        </div>
        <div className="flex gap-2 sm:flex-shrink-0">
          {myMember && (
            <Link to="/my-requests" className="btn-secondary btn-sm">
              <Home className="w-3.5 h-3.5" /> {t('schedule_view.request_home')}
            </Link>
          )}
        </div>
      </div>

      {/* Not a member notice */}
      {!myMember && (
        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
          <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
          {t('schedule_view.not_member')}
        </div>
      )}

      {/* Grid with scroll hint */}
      {grid.shifts.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">{t('schedule_view.no_shifts')}</div>
      ) : (
        <div className="relative">
          <ScheduleGrid data={grid} isAdminView={!!user?.is_admin} scrollRef={scrollRef} />
          {/* Right-edge scroll hint — only shown on small screens when content overflows */}
          {showScrollHint && (
            <div className="sm:hidden pointer-events-none absolute top-0 right-0 bottom-0 w-10 bg-gradient-to-l from-white/80 to-transparent rounded-r-xl" />
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-200 border border-green-300" />
          {t('schedule_view.legend_in_shift')}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-gray-100 border border-gray-300" />
          {t('schedule_view.legend_available')}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-200 border border-red-300" />
          {t('schedule_view.legend_home')}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-200 border border-amber-300" />
          {t('schedule_view.legend_pending')}
        </div>
      </div>
    </div>
  );
}
