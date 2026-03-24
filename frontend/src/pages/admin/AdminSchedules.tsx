import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, parseISO, isBefore, isAfter } from 'date-fns';
import { schedulesApi } from '../../api/schedules';
import type { Schedule } from '../../types';
import { CircleCheck, CalendarClock, CircleOff, Plus, ArrowRight } from 'lucide-react';

function statusBadge(s: Schedule) {
  const today = new Date();
  const start = parseISO(s.start_date);
  const end = parseISO(s.end_date + 'T23:59:59');
  if (isBefore(end, today)) return <span className="badge badge-gray"><CircleOff className="w-3 h-3" />Ended</span>;
  if (isAfter(start, today)) return <span className="badge badge-blue"><CalendarClock className="w-3 h-3" />Upcoming</span>;
  return <span className="badge badge-green"><CircleCheck className="w-3 h-3" />Active</span>;
}

export default function AdminSchedules() {
  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['schedules'],
    queryFn: schedulesApi.list,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Schedules</h1>
        <Link to="/admin/schedules/new" className="btn-primary"><Plus className="w-4 h-4" /> New Schedule</Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : schedules.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          No schedules yet. <Link to="/admin/schedules/new" className="inline-flex items-center gap-1 text-blue-600 hover:underline">Create one <ArrowRight className="w-3 h-3" /></Link>
        </div>
      ) : (
        <div className="card divide-y divide-gray-100">
          {schedules.map((schedule) => (
            <div key={schedule.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
              <div className="flex items-center gap-3">
                {statusBadge(schedule)}
                <div>
                  <div className="font-medium text-gray-900">{schedule.name}</div>
                  <div className="text-xs text-gray-500">
                    {format(parseISO(schedule.start_date), 'MMM d')} – {format(parseISO(schedule.end_date), 'MMM d, yyyy')}
                    {' · '}{schedule.shift_duration_hours}h shifts · Capacity {schedule.capacity}
                    {schedule.primary_team && (
                      <span className="ml-2 text-blue-600">Team: {schedule.primary_team.name}</span>
                    )}
                  </div>
                </div>
              </div>
              <Link to={`/admin/schedules/${schedule.id}`} className="btn-secondary btn-sm">
                Manage <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
