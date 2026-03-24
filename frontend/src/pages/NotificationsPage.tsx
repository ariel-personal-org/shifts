import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { notificationsApi } from '../api/notifications';
import type { Notification } from '../types';
import type { LucideIcon } from 'lucide-react';
import { ClipboardList, UserMinus, Home, CheckCircle, XCircle, AlertTriangle, CheckCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const TYPE_ICONS: Record<string, { icon: LucideIcon; iconClass: string }> = {
  assigned_in_shift:    { icon: ClipboardList, iconClass: 'text-green-600' },
  removed_from_shift:   { icon: UserMinus,     iconClass: 'text-red-500' },
  state_changed_home:   { icon: Home,          iconClass: 'text-red-600' },
  request_approved:     { icon: CheckCircle,   iconClass: 'text-green-600' },
  request_rejected:     { icon: XCircle,       iconClass: 'text-red-500' },
  request_partial:      { icon: AlertTriangle, iconClass: 'text-amber-500' },
};

function NotifItem({ notif, onRead }: { notif: Notification; onRead: (id: number) => void }) {
  const { t } = useTranslation();
  const config = TYPE_ICONS[notif.type];
  const labelKey = `notifications.type_${notif.type}` as const;

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${
        notif.is_read ? 'bg-white border-gray-100' : 'bg-blue-50 border-blue-200'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
          {config && (() => { const Icon = config.icon; return <Icon className={`w-4 h-4 flex-shrink-0 ${config.iconClass}`} />; })()}
          {t(labelKey, { defaultValue: notif.type })}
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
          {t('notifications.mark_read')}
        </button>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  const { t } = useTranslation();
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
          <h1 className="text-2xl font-bold text-gray-900">{t('notifications.title')}</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500">{t('notifications.unread', { count: unreadCount })}</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            className="btn-secondary btn-sm"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
          >
            <CheckCheck className="w-3.5 h-3.5" />
            {t('notifications.mark_all_read')}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : notifications.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">{t('notifications.no_notifications')}</div>
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
