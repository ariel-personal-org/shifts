import { api } from './client';
import type { User } from '../types';

export const usersApi = {
  list: async (q?: string): Promise<User[]> => {
    const { data } = await api.get('/api/users', { params: q ? { q } : {} });
    return data;
  },
  create: async (name: string): Promise<User> => {
    const { data } = await api.post('/api/users', { name });
    return data;
  },
  update: async (
    id: number,
    updates: { team_id?: number | null; is_admin?: boolean; name?: string; display_name?: string | null; email?: string; is_virtual?: false }
  ): Promise<User> => {
    const { data } = await api.put(`/api/users/${id}`, updates);
    return data;
  },
  remove: async (id: number): Promise<void> => {
    await api.delete(`/api/users/${id}`);
  },
};
