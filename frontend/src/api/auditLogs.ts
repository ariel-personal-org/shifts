import { api } from './client';
import type { AuditLog } from '../types';

export const auditLogsApi = {
  list: async (params?: {
    user_id?: number;
    schedule_id?: number;
    from_date?: string;
    to_date?: string;
    action?: string;
  }): Promise<AuditLog[]> => {
    const { data } = await api.get('/api/audit-logs', { params });
    return data;
  },
};
