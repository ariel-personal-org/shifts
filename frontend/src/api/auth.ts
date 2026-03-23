import { api } from './client';
import type { User } from '../types';

export const authApi = {
  googleLogin: async (credential: string): Promise<{ user: User; token: string }> => {
    const { data } = await api.post('/api/auth/google', { credential });
    return data;
  },
  me: async (): Promise<{ user: User }> => {
    const { data } = await api.get('/api/auth/me');
    return data;
  },
  devLogin: async (email: string): Promise<{ user: User; token: string }> => {
    const { data } = await api.post('/api/auth/dev-login', { email });
    return data;
  },
};
