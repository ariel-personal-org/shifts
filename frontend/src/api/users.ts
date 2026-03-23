import { api } from './client';
import type { User } from '../types';

export const usersApi = {
  list: async (q?: string): Promise<User[]> => {
    const { data } = await api.get('/api/users', { params: q ? { q } : {} });
    return data;
  },
  update: async (
    id: number,
    updates: { team_id?: number | null; is_admin?: boolean; name?: string }
  ): Promise<User> => {
    const { data } = await api.put(`/api/users/${id}`, updates);
    return data;
  },
};
