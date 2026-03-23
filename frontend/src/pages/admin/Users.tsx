import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../api/users';
import { teamsApi } from '../../api/teams';
import { useAuth } from '../../context/AuthContext';
import type { User } from '../../types';

export default function Users() {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', 'search', search],
    queryFn: () => usersApi.list(search || undefined),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: teamsApi.list,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: { team_id?: number | null; is_admin?: boolean } }) =>
      usersApi.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Users</h1>

      <div>
        <input
          className="input max-w-sm"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : users.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">No users found.</div>
      ) : (
        <div className="card divide-y divide-gray-100">
          {users.map((user) => (
            <div key={user.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{user.name}</span>
                  {user.is_admin && <span className="badge badge-blue text-[9px]">Admin</span>}
                  {user.id === currentUser?.id && <span className="badge badge-gray text-[9px]">You</span>}
                </div>
                <div className="text-xs text-gray-400">{user.email}</div>
              </div>

              <div className="flex items-center gap-3">
                {/* Team selector */}
                <select
                  className="input text-sm py-1"
                  value={user.team_id ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateMutation.mutate({
                      id: user.id,
                      updates: { team_id: val ? parseInt(val) : null },
                    });
                  }}
                >
                  <option value="">No team</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>

                {/* Admin toggle */}
                {user.id !== currentUser?.id && (
                  <button
                    className={user.is_admin ? 'btn-secondary btn-sm' : 'btn-secondary btn-sm'}
                    onClick={() =>
                      updateMutation.mutate({
                        id: user.id,
                        updates: { is_admin: !user.is_admin },
                      })
                    }
                    disabled={updateMutation.isPending}
                  >
                    {user.is_admin ? 'Revoke Admin' : 'Make Admin'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
