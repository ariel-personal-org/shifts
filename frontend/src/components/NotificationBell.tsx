import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '../api/notifications';
import { useAuth } from '../context/AuthContext';
import { Bell } from 'lucide-react';

export default function NotificationBell() {
  const { user } = useAuth();
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <Link to="/notifications" className="relative p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
