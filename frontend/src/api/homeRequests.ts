import { api } from './client';
import type { HomeRequest } from '../types';

export const homeRequestsApi = {
  list: async (params?: {
    schedule_id?: number;
    user_id?: number;
    decision?: string;
  }): Promise<HomeRequest[]> => {
    const { data } = await api.get('/api/home-requests', { params });
    return data;
  },
  get: async (requestId: string): Promise<HomeRequest> => {
    const { data } = await api.get(`/api/home-requests/${requestId}`);
    return data;
  },
  create: async (payload: {
    schedule_id: number;
    shift_ids: number[];
  }): Promise<{ request_id: string; shift_ids: number[]; status: string }> => {
    const { data } = await api.post('/api/home-requests', payload);
    return data;
  },
  cancel: async (requestId: string): Promise<{ ok: boolean }> => {
    const { data } = await api.delete(`/api/home-requests/${requestId}`);
    return data;
  },
  decide: async (
    requestId: string,
    decisions: Array<{ shift_id: number; decision: 'approved' | 'rejected' }>
  ): Promise<{ ok: boolean; status: string }> => {
    const { data } = await api.put(`/api/home-requests/${requestId}/decisions`, { decisions });
    return data;
  },
};
