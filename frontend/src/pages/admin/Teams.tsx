import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamsApi } from '../../api/teams';
import { usersApi } from '../../api/users';
import { Plus, Pencil, Trash2, UserPlus, UserMinus, Shield, Users, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Teams() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [newTeamName, setNewTeamName] = useState('');
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [editingTeam, setEditingTeam] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: teamsApi.list,
  });

  const { data: expandedTeamData } = useQuery({
    queryKey: ['team', expandedTeam],
    queryFn: () => teamsApi.get(expandedTeam!),
    enabled: expandedTeam !== null,
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ['users', 'search', userSearch],
    queryFn: () => usersApi.list(userSearch),
    enabled: userSearch.length >= 1,
  });

  const createTeamMutation = useMutation({
    mutationFn: (name: string) => teamsApi.create(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setNewTeamName('');
      setError('');
    },
    onError: (err: any) => setError(err?.response?.data?.error ?? 'Failed to create team'),
  });

  const updateTeamMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => teamsApi.update(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setEditingTeam(null);
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: (id: number) => teamsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teams'] }),
  });

  const addMemberMutation = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: number; userId: number }) =>
      teamsApi.addMember(teamId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', expandedTeam] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setUserSearch('');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: number; userId: number }) =>
      teamsApi.removeMember(teamId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', expandedTeam] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">{t('teams.title')}</h1>

      {/* Create team */}
      <div className="card p-4">
        <h2 className="font-semibold text-gray-800 mb-3">{t('teams.create_team')}</h2>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder={t('teams.team_name_placeholder')}
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && newTeamName.trim()) createTeamMutation.mutate(newTeamName.trim()); }}
          />
          <button
            className="btn-primary"
            disabled={!newTeamName.trim() || createTeamMutation.isPending}
            onClick={() => createTeamMutation.mutate(newTeamName.trim())}
          >
            <Plus className="w-4 h-4" /> {t('teams.create_btn')}
          </button>
        </div>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>

      {/* Teams list */}
      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : teams.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">{t('teams.no_teams')}</div>
      ) : (
        <div className="space-y-3">
          {teams.map((team) => (
            <div key={team.id} className="card overflow-hidden">
              <div className="flex items-center justify-between p-4">
                {editingTeam === team.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      className="input flex-1"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                    />
                    <button className="btn-primary btn-sm" onClick={() => updateTeamMutation.mutate({ id: team.id, name: editName })}>{t('teams.save')}</button>
                    <button className="btn-secondary btn-sm" onClick={() => setEditingTeam(null)}>{t('teams.cancel')}</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-900">{team.name}</span>
                  </div>
                )}
                {editingTeam !== team.id && (
                  <div className="flex items-center gap-2">
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => {
                        if (expandedTeam === team.id) {
                          setExpandedTeam(null);
                        } else {
                          setExpandedTeam(team.id);
                          setUserSearch('');
                        }
                      }}
                    >
                      {expandedTeam === team.id ? <><ChevronUp className="w-3.5 h-3.5" />{t('teams.collapse')}</> : <><Users className="w-3.5 h-3.5" />{t('teams.manage_members')}</>}
                    </button>
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => { setEditingTeam(team.id); setEditName(team.name); }}
                    >
                      <Pencil className="w-3.5 h-3.5" /> {t('teams.rename')}
                    </button>
                    <button
                      className="btn-danger btn-sm"
                      onClick={() => { if (confirm(`Delete team "${team.name}"?`)) deleteTeamMutation.mutate(team.id); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> {t('teams.delete')}
                    </button>
                  </div>
                )}
              </div>

              {expandedTeam === team.id && expandedTeamData && (
                <div className="border-t border-gray-100 p-4 bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    {t('teams.members_count', { count: expandedTeamData.members.length })}
                  </h3>

                  {/* Add member search */}
                  <div className="flex gap-2 mb-3">
                    <input
                      className="input flex-1 text-sm"
                      placeholder={t('teams.search_member')}
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                    />
                  </div>
                  {userSearch.length >= 1 && searchResults.length > 0 && (
                    <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 mb-3 overflow-hidden">
                      {searchResults
                        .filter((u) => !expandedTeamData.members.some((m) => m.id === u.id))
                        .slice(0, 5)
                        .map((u) => (
                          <div key={u.id} className="flex items-center justify-between px-3 py-2 bg-white">
                            <div>
                              <span className="text-sm font-medium">{u.display_name || u.name}</span>
                              <span className="text-xs text-gray-400 ml-2">{u.email}</span>
                              {u.team_id && u.team_id !== team.id && (
                                <span className="text-xs text-amber-600 ml-2">{t('teams.in_another_team')}</span>
                              )}
                            </div>
                            <button
                              className="btn-primary btn-sm"
                              onClick={() => addMemberMutation.mutate({ teamId: team.id, userId: u.id })}
                            >
                              <UserPlus className="w-3.5 h-3.5" /> {t('teams.add')}
                            </button>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Current members */}
                  {expandedTeamData.members.length === 0 ? (
                    <p className="text-sm text-gray-400">{t('teams.no_members')}</p>
                  ) : (
                    <div className="space-y-1">
                      {expandedTeamData.members.map((m) => (
                        <div key={m.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                          <div>
                            <span className="text-sm text-gray-900">{m.name}</span>
                            <span className="text-xs text-gray-400 ml-2">{m.email}</span>
                            {m.is_admin && <span className="badge badge-blue ml-2 text-[9px]"><Shield className="w-2.5 h-2.5" />{t('users.admin_label')}</span>}
                          </div>
                          <button
                            className="btn-secondary btn-sm"
                            onClick={() => removeMemberMutation.mutate({ teamId: team.id, userId: m.id })}
                          >
                            <UserMinus className="w-3.5 h-3.5" /> {t('teams.remove')}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
