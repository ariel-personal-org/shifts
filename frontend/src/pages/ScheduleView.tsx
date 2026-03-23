import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { schedulesApi } from '../api/schedules';
import { useAuth } from '../context/AuthContext';
import ScheduleGrid from '../components/ScheduleGrid';

export default function ScheduleView() {
  const { id } = useParams<{ id: string }>();
  const scheduleId = parseInt(id!);
  const { user } = useAuth();

  const { data: grid, isLoading, error } = useQuery({
    queryKey: ['grid', scheduleId],
    queryFn: () => schedulesApi.getGrid(scheduleId),
    refetchInterval: 60_000,
  });

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
        Failed to load schedule. <Link to="/dashboard" className="text-blue-600 hover:underline">Go back</Link>
      </div>
    );
  }

  const { schedule } = grid;
  const myMember = grid.members.find((m) => m.user.id === user?.id);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{schedule.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {format(parseISO(schedule.start_date), 'MMM d')} – {format(parseISO(schedule.end_date), 'MMM d, yyyy')}
            {' · '}{schedule.shift_duration_hours}h shifts · Capacity: {schedule.capacity}
          </p>
        </div>
        <div className="flex gap-2">
          {myMember && (
            <Link to="/my-requests" className="btn-secondary btn-sm">
              Request Home
            </Link>
          )}
        </div>
      </div>

      {/* Not a member notice */}
      {!myMember && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
          You are not a member of this schedule. Contact an admin to be added.
        </div>
      )}

      {/* Grid */}
      {grid.shifts.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">No shifts generated for this schedule.</div>
      ) : (
        <ScheduleGrid data={grid} isAdminView={false} />
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-200 border border-green-300" />
          In Shift
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-gray-100 border border-gray-300" />
          Available
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-200 border border-red-300" />
          Home
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-200 border border-amber-300" />
          Pending request
        </div>
      </div>
    </div>
  );
}
