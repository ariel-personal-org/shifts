import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { notificationsApi } from '../api/notifications';
import type { Notification } from '../types';

const TYPE_LABELS: Record<string, string> = {
  assigned_in_shift: '📋 Assigned to shift',
  removed_from_shift: '❌ Removed from shift',
  state_changed_home: '🏠 Set to Home',
  request_approved: '✅ Home request approved',
  request_rejected: '❌ Home request rejected',
  request_partial: '⚠️ Home request partially decided',
};

function NotifItem({ notif, onRead }: { notif: Notification; onRead: (id: number) => void }) {
  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${
        notif.is_read ? 'bg-white border-gray-100' : 'bg-blue-50 border-blue-200'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900">
          {TYPE_LABELS[notif.type] ?? notif.type}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {format(parseISO(notif.created_at), 'MMM d, yyyy HH:mm')}
        </div>
      </div>
      {!notif.is_read && (
        <button
          className="text-xs text-blue-600 hover:underline whitespace-nowrap"
          onClick={() => onRead(notif.id)}
        >
          Mark read
        </button>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
  });

  const markReadMutation = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            className="btn-secondary btn-sm"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
          >
            Mark all read
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : notifications.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">No notifications.</div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <NotifItem key={n.id} notif={n} onRead={(id) => markReadMutation.mutate(id)} />
          ))}
        </div>
      )}
    </div>
  );
}
