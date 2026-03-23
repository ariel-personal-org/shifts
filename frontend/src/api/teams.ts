import { api } from './client';
import type { Team, User } from '../types';

export const teamsApi = {
  list: async (): Promise<Team[]> => {
    const { data } = await api.get('/api/teams');
    return data;
  },
  get: async (id: number): Promise<Team & { members: User[] }> => {
    const { data } = await api.get(`/api/teams/${id}`);
    return data;
  },
  create: async (name: string): Promise<Team> => {
    const { data } = await api.post('/api/teams', { name });
    return data;
  },
  update: async (id: number, name: string): Promise<Team> => {
    const { data } = await api.put(`/api/teams/${id}`, { name });
    return data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/teams/${id}`);
  },
  addMember: async (teamId: number, userId: number): Promise<User> => {
    const { data } = await api.post(`/api/teams/${teamId}/members`, { userId });
    return data;
  },
  removeMember: async (teamId: number, userId: number): Promise<void> => {
    await api.delete(`/api/teams/${teamId}/members/${userId}`);
  },
};
