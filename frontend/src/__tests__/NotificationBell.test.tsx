import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NotificationBell from '../components/NotificationBell';
import type { Notification } from '../types';

// Mock the auth context
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, name: 'Alice', email: 'alice@test.com', is_admin: false, team_id: null, created_at: '' }, token: 'tok' }),
}));

// Mock the notifications API
vi.mock('../api/notifications', () => ({
  notificationsApi: {
    list: vi.fn(),
  },
}));

import { notificationsApi } from '../api/notifications';

function makeNotification(id: number, is_read: boolean): Notification {
  return { id, user_id: 1, created_at: '', type: 'test', payload_json: null, is_read };
}

function renderBell(notifications: Notification[]) {
  (notificationsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue(notifications);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the bell icon link', () => {
    renderBell([]);
    expect(screen.getByRole('link')).toBeInTheDocument();
  });

  it('shows no badge when there are no unread notifications', async () => {
    renderBell([makeNotification(1, true), makeNotification(2, true)]);
    // Badge should not appear
    expect(screen.queryByText(/^\d+\+?$/)).not.toBeInTheDocument();
  });

  it('shows unread count badge for unread notifications', async () => {
    renderBell([makeNotification(1, false), makeNotification(2, false), makeNotification(3, true)]);
    // Wait for query to resolve and re-render
    const badge = await screen.findByText('2');
    expect(badge).toBeInTheDocument();
  });

  it('shows 9+ when there are more than 9 unread notifications', async () => {
    const notifications = Array.from({ length: 10 }, (_, i) => makeNotification(i + 1, false));
    renderBell(notifications);
    const badge = await screen.findByText('9+');
    expect(badge).toBeInTheDocument();
  });

  it('links to /notifications', () => {
    renderBell([]);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/notifications');
  });
});
