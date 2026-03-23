import { api } from './client';
import type { Notification } from '../types';

export const notificationsApi = {
  list: async (): Promise<Notification[]> => {
    const { data } = await api.get('/api/notifications');
    return data;
  },
  markRead: async (id: number): Promise<void> => {
    await api.put(`/api/notifications/${id}/read`);
  },
  markAllRead: async (): Promise<void> => {
    await api.put('/api/notifications/read-all');
  },
};
