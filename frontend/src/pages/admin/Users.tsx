import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../api/users';
import { teamsApi } from '../../api/teams';
import { useAuth } from '../../context/AuthContext';
import UpgradeVirtualUserModal from '../../components/UpgradeVirtualUserModal';
import type { User } from '../../types';

export default function Users() {
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingNames, setEditingNames] = useState<Record<number, string>>({});
  const [upgradingUser, setUpgradingUser] = useState<User | null>(null);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
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
    mutationFn: ({ id, updates }: { id: number; updates: Parameters<typeof usersApi.update>[1] }) =>
      usersApi.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => usersApi.create(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setNewName('');
      setShowAddForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const upgradeMutation = useMutation({
    mutationFn: ({ id, email, teamId }: { id: number; email: string; teamId: number }) =>
      usersApi.update(id, { email, team_id: teamId, is_virtual: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setUpgradingUser(null);
      setUpgradeError(null);
    },
    onError: (err: any) => {
      setUpgradeError(err?.response?.data?.error ?? 'Failed to upgrade user');
    },
  });

  function startAddForm() {
    setShowAddForm(true);
    setTimeout(() => addInputRef.current?.focus(), 0);
  }

  function cancelAddForm() {
    setShowAddForm(false);
    setNewName('');
  }

  function submitAddForm(e: React.FormEvent) {
    e.preventDefault();
    if (newName.trim()) createMutation.mutate(newName.trim());
  }

  function startEditName(user: User) {
    setEditingNames((prev) => ({ ...prev, [user.id]: user.name }));
  }

  function cancelEditName(id: number) {
    setEditingNames((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function saveEditName(id: number) {
    const name = editingNames[id]?.trim();
    if (!name) return;
    updateMutation.mutate(
      { id, updates: { name } },
      {
        onSuccess: () => cancelEditName(id),
      }
    );
  }

  function openUpgradeModal(user: User) {
    setUpgradeError(null);
    setUpgradingUser(user);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <button className="btn-secondary" onClick={startAddForm} disabled={showAddForm}>
          + Add Virtual User
        </button>
      </div>

      <div>
        <input
          className="input max-w-sm"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Inline add form */}
      {showAddForm && (
        <form
          onSubmit={submitAddForm}
          className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl"
        >
          <input
            ref={addInputRef}
            className="input flex-1"
            placeholder="Display name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button
            type="submit"
            className="btn-primary btn-sm"
            disabled={!newName.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating…' : 'Create'}
          </button>
          <button type="button" className="btn-secondary btn-sm" onClick={cancelAddForm}>
            Cancel
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : users.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">No users found.</div>
      ) : (
        <div className="card divide-y divide-gray-100">
          {users.map((user) => {
            const isEditingName = user.id in editingNames;

            if (user.is_virtual) {
              return (
                <div key={user.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isEditingName ? (
                        <>
                          <input
                            className="input text-sm py-1 w-48"
                            value={editingNames[user.id]}
                            onChange={(e) =>
                              setEditingNames((prev) => ({ ...prev, [user.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEditName(user.id);
                              if (e.key === 'Escape') cancelEditName(user.id);
                            }}
                            autoFocus
                          />
                          <button
                            className="btn-primary btn-sm"
                            onClick={() => saveEditName(user.id)}
                            disabled={updateMutation.isPending}
                          >
                            Save
                          </button>
                          <button className="btn-secondary btn-sm" onClick={() => cancelEditName(user.id)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="font-medium text-gray-900">{user.name}</span>
                          <button
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                            onClick={() => startEditName(user)}
                            title="Edit name"
                            aria-label="Edit name"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </>
                      )}
                      <span className="badge badge-yellow text-[9px]">Virtual</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
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
                    <button className="btn-secondary btn-sm" onClick={() => openUpgradeModal(user)}>
                      Upgrade
                    </button>
                    <button
                      className="btn-danger btn-sm"
                      onClick={() => {
                        if (window.confirm(`Delete virtual user "${user.name}"? This cannot be undone.`)) {
                          deleteMutation.mutate(user.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            }

            // Real user row
            return (
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

                  {user.id !== currentUser?.id && (
                    <button
                      className="btn-secondary btn-sm"
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
            );
          })}
        </div>
      )}

      {upgradingUser && (
        <UpgradeVirtualUserModal
          user={upgradingUser}
          teams={teams}
          onClose={() => { setUpgradingUser(null); setUpgradeError(null); }}
          onSave={(email, teamId) =>
            upgradeMutation.mutate({ id: upgradingUser.id, email, teamId })
          }
          isSaving={upgradeMutation.isPending}
          error={upgradeError}
        />
      )}
    </div>
  );
}
