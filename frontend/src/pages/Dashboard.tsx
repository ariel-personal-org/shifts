import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, isToday, parseISO, isBefore } from 'date-fns';
import { he as heLocale, enUS } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';
import { schedulesApi } from '../api/schedules';
import { useAuth } from '../context/AuthContext';
import type { Schedule } from '../types';
import { Clock, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function TodayCard({ schedule, scheduleUrl }: { schedule: Schedule; scheduleUrl: string }) {
  const { data: grid } = useQuery({
    queryKey: ['grid', schedule.id],
    queryFn: () => schedulesApi.getGrid(schedule.id),
  });
  const { user } = useAuth();
  const { t, i18n } = useTranslation();

  if (!grid) return null;

  const todayShifts = grid.shifts.filter((s) => isToday(parseISO(s.start_datetime)));
  const myStates = grid.members.find((m) => m.user.id === user?.id);

  if (todayShifts.length === 0) return null;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">{schedule.name}</h3>
        <Link
          to={scheduleUrl}
          className="text-xs text-blue-600 hover:underline"
        >
          {t('dashboard.view_full')} <ArrowRight className="w-3 h-3 inline" />
        </Link>
      </div>
      <div className="space-y-2">
        {todayShifts.map((shift) => {
          const stat = grid.shift_stats.find((s) => s.shift_id === shift.id);
          const myState = myStates?.states.find((s) => s.shift_id === shift.id);
          const stateLabel = myState?.state === 'in_shift'
            ? t('dashboard.state_in_shift')
            : myState?.state === 'home'
            ? t('dashboard.state_home')
            : t('dashboard.state_available');
          const stateClass = myState?.state === 'in_shift'
            ? 'text-green-700 bg-green-50'
            : myState?.state === 'home'
            ? 'text-red-700 bg-red-50'
            : 'text-gray-600 bg-gray-50';

          return (
            <div key={shift.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div>
                <div className="text-sm font-medium text-gray-800">
                  {formatInTimeZone(parseISO(shift.start_datetime), grid.schedule.timezone, 'HH:mm')} – {formatInTimeZone(parseISO(shift.end_datetime), grid.schedule.timezone, 'HH:mm')}
                </div>
                <div className="text-xs text-gray-500">
                  {stat ? t('dashboard.filled', { count: stat.in_shift_count, capacity: stat.capacity }) : ''}
                  {myState?.has_pending_request && (
                    <span className="inline-flex items-center gap-0.5 ml-2 text-amber-600"><Clock className="w-3 h-3" /> {t('dashboard.home_request_pending')}</span>
                  )}
                </div>
              </div>
              {myStates && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stateClass}`}>
                  {stateLabel}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['schedules'],
    queryFn: schedulesApi.list,
  });

  const today = new Date();
  const dateLocale = i18n.language === 'he' ? heLocale : enUS;
  const activeSchedules = schedules.filter((s) => {
    const end = parseISO(s.end_date + 'T23:59:59');
    return !isBefore(end, today);
  });

  const greeting = today.getHours() < 12
    ? t('dashboard.greeting_morning')
    : today.getHours() < 17
    ? t('dashboard.greeting_afternoon')
    : t('dashboard.greeting_evening');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {greeting}, {(user?.display_name || user?.name)?.split(' ')[0]}
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">{format(today, 'EEEE, MMMM d, yyyy', { locale: dateLocale })}</p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}

      {!isLoading && activeSchedules.length === 0 && (
        <div className="card p-8 text-center text-gray-500">
          <p>{t('dashboard.no_schedules')} {user?.is_admin && <Link to="/admin/schedules/new" className="inline-flex items-center gap-1 text-blue-600 hover:underline">{t('dashboard.create_one')} <ArrowRight className="w-3 h-3" /></Link>}</p>
        </div>
      )}

      {/* Today's shifts */}
      {activeSchedules.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">{t('dashboard.today')}</h2>
          <div className="grid gap-4">
            {activeSchedules.map((s) => (
              <TodayCard
                key={s.id}
                schedule={s}
                scheduleUrl={user?.is_admin ? `/admin/schedules/${s.id}` : `/schedules/${s.id}`}
              />
            ))}
          </div>
        </section>
      )}

      {/* Quick links */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">{t('dashboard.quick_links')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {activeSchedules.slice(0, 4).map((s) => (
            <Link
              key={s.id}
              to={user?.is_admin ? `/admin/schedules/${s.id}` : `/schedules/${s.id}`}
              className="card p-4 hover:shadow-md transition-shadow text-center"
            >
              <div className="text-blue-600 font-semibold text-sm truncate">{s.name}</div>
              <div className="text-xs text-gray-400 mt-1">
                {format(parseISO(s.start_date), 'MMM d', { locale: dateLocale })} – {format(parseISO(s.end_date), 'MMM d', { locale: dateLocale })}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
