import { api } from './client';
import type { GridData, Schedule, Shift, User } from '../types';

export const schedulesApi = {
  list: async (): Promise<Schedule[]> => {
    const { data } = await api.get('/api/schedules');
    return data;
  },
  get: async (id: number): Promise<Schedule> => {
    const { data } = await api.get(`/api/schedules/${id}`);
    return data;
  },
  create: async (payload: {
    name: string;
    start_date: string;
    end_date: string;
    cycle_start_time: string;
    shift_duration_hours: number;
    capacity: number;
    primary_team_id: number;
  }): Promise<Schedule> => {
    const { data } = await api.post('/api/schedules', payload);
    return data;
  },
  update: async (
    id: number,
    updates: { name?: string; capacity?: number }
  ): Promise<Schedule> => {
    const { data } = await api.put(`/api/schedules/${id}`, updates);
    return data;
  },
  getGrid: async (id: number): Promise<GridData> => {
    const { data } = await api.get(`/api/schedules/${id}/grid`);
    return data;
  },
  getShifts: async (id: number): Promise<Shift[]> => {
    const { data } = await api.get(`/api/schedules/${id}/shifts`);
    return data;
  },
  getMembers: async (id: number): Promise<User[]> => {
    const { data } = await api.get(`/api/schedules/${id}/members`);
    return data;
  },
  addMember: async (scheduleId: number, userId: number): Promise<void> => {
    await api.post(`/api/schedules/${scheduleId}/members`, { userId });
  },
  removeMember: async (scheduleId: number, userId: number): Promise<void> => {
    await api.delete(`/api/schedules/${scheduleId}/members/${userId}`);
  },
  setShiftState: async (
    scheduleId: number,
    shiftId: number,
    userId: number,
    state: 'in_shift' | 'available' | 'home'
  ): Promise<{ ok: boolean; state: string; warned_pending_request: boolean }> => {
    const { data } = await api.put(
      `/api/schedules/${scheduleId}/shifts/${shiftId}/users/${userId}/state`,
      { state }
    );
    return data;
  },
  autoFill: async (
    scheduleId: number
  ): Promise<{
    assignments_made: number;
    shifts_filled: number[];
    shifts_still_under: number[];
    details: Array<{ shift_id: number; user_id: number }>;
  }> => {
    const { data } = await api.post(`/api/schedules/${scheduleId}/auto-fill`);
    return data;
  },
};
