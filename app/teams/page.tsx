'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Edit2, Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PageLoading, PageError, EmptyState } from '@/components/page-loading';
import { ProtectedRoute } from '@/components/protected-route';
import { useAuthFetch } from '@/hooks/use-auth-fetch';
import { useToast } from '@/hooks/use-toast';
import type { Team, TeamMember } from '@/lib/types';

interface TeamWithMembers extends Team {
  member_count?: number;
  user_role?: 'team_lead' | 'member';
}

function TeamsContent() {
  const authFetch = useAuthFetch();
  const { toast } = useToast();

  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isManager, setIsManager] = useState(false);

  // Modal states
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamWithMembers | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [addMemberEmail, setAddMemberEmail] = useState('');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Fetch teams
  const fetchTeams = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await authFetch('/api/teams');
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to load teams');
        setLoading(false);
        return;
      }

      // Check if user is manager (if they can see all teams, they're a manager)
      // For now, we'll check in a separate call
      setTeams(data.teams || []);
      setIsManager(true); // Assume manager if successfully fetched (API validates)

      setLoading(false);
    } catch (err) {
      console.error('Error fetching teams:', err);
      setError('Failed to load teams');
      setLoading(false);
    }
  }, [authFetch]);

  // Fetch team members
  const fetchTeamMembers = useCallback(
    async (teamId: string) => {
      setMembersLoading(true);

      try {
        const res = await authFetch(`/api/teams/${teamId}/members`);
        const data = await res.json();

        if (!res.ok) {
          toast({ title: 'Error', description: data.error || 'Failed to load members' });
          setMembersLoading(false);
          return;
        }

        setTeamMembers(data.members || []);
      } catch (err) {
        console.error('Error fetching team members:', err);
        toast({ title: 'Error', description: 'Failed to load members' });
      } finally {
        setMembersLoading(false);
      }
    },
    [authFetch, toast],
  );

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  // Handle create team
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!createForm.name.trim()) {
      toast({ title: 'Error', description: 'Team name is required' });
      return;
    }

    try {
      const res = await authFetch('/api/teams', {
        method: 'POST',
        body: JSON.stringify({
          name: createForm.name.trim(),
          description: createForm.description.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({ title: 'Error', description: data.error || 'Failed to create team' });
        return;
      }

      toast({ title: 'Success', description: `Team "${data.name}" created` });
      setCreateForm({ name: '', description: '' });
      setCreateOpen(false);
      await fetchTeams();
    } catch (err) {
      console.error('Error creating team:', err);
      toast({ title: 'Error', description: 'Failed to create team' });
    }
  };

  // Handle update team
  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTeam || !editForm.name.trim()) {
      toast({ title: 'Error', description: 'Team name is required' });
      return;
    }

    try {
      const res = await authFetch(`/api/teams/${selectedTeam.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editForm.name.trim(),
          description: editForm.description.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({ title: 'Error', description: data.error || 'Failed to update team' });
        return;
      }

      toast({ title: 'Success', description: 'Team updated' });
      setEditOpen(false);
      await fetchTeams();
      setSelectedTeam(null);
    } catch (err) {
      console.error('Error updating team:', err);
      toast({ title: 'Error', description: 'Failed to update team' });
    }
  };

  // Handle delete team
  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Are you sure you want to delete "${teamName}"?`)) {
      return;
    }

    try {
      const res = await authFetch(`/api/teams/${teamId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to delete team' });
        return;
      }

      toast({ title: 'Success', description: 'Team deleted' });
      await fetchTeams();
      setDetailsOpen(false);
      setSelectedTeam(null);
    } catch (err) {
      console.error('Error deleting team:', err);
      toast({ title: 'Error', description: 'Failed to delete team' });
    }
  };

  // Handle add member
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTeam || !addMemberEmail.trim()) {
      toast({ title: 'Error', description: 'Email is required' });
      return;
    }

    try {
      const res = await authFetch(`/api/teams/${selectedTeam.id}/members`, {
        method: 'POST',
        body: JSON.stringify({
          email: addMemberEmail.trim(),
          role: 'member',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({ title: 'Error', description: data.error || 'Failed to add member' });
        return;
      }

      toast({ title: 'Success', description: 'Member added to team' });
      setAddMemberEmail('');
      await fetchTeamMembers(selectedTeam.id);
    } catch (err) {
      console.error('Error adding member:', err);
      toast({ title: 'Error', description: 'Failed to add member' });
    }
  };

  // Handle remove member
  const handleRemoveMember = async (memberId: string, email: string) => {
    if (!selectedTeam) return;

    if (!confirm(`Remove ${email} from this team?`)) {
      return;
    }

    try {
      const res = await authFetch(`/api/teams/${selectedTeam.id}/members/${memberId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to remove member' });
        return;
      }

      toast({ title: 'Success', description: 'Member removed from team' });
      await fetchTeamMembers(selectedTeam.id);
    } catch (err) {
      console.error('Error removing member:', err);
      toast({ title: 'Error', description: 'Failed to remove member' });
    }
  };

  // Handle update member role
  const handleUpdateMemberRole = async (memberId: string, newRole: 'team_lead' | 'member') => {
    if (!selectedTeam) return;

    try {
      const res = await authFetch(`/api/teams/${selectedTeam.id}/members/${memberId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to update role' });
        return;
      }

      toast({ title: 'Success', description: 'Member role updated' });
      await fetchTeamMembers(selectedTeam.id);
    } catch (err) {
      console.error('Error updating member role:', err);
      toast({ title: 'Error', description: 'Failed to update role' });
    }
  };

  const handleOpenTeamDetails = async (team: TeamWithMembers) => {
    setSelectedTeam(team);
    setEditForm({ name: team.name, description: team.description || '' });
    await fetchTeamMembers(team.id);
    setDetailsOpen(true);
  };

  if (loading) {
    return <PageLoading />;
  }

  if (error) {
    return <PageError message={error} />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Teams</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your organization's teams and members
          </p>
        </div>

        {isManager && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Team
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Team</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateTeam} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900">Team Name</label>
                  <Input
                    placeholder="e.g., Engineering, Marketing"
                    value={createForm.name}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900">
                    Description (optional)
                  </label>
                  <Textarea
                    placeholder="Team description and purpose"
                    value={createForm.description}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, description: e.target.value })
                    }
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreateOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Create Team</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Teams Grid */}
      {teams.length === 0 ? (
        <EmptyState
          title="No teams yet"
          description="Create your first team to get started organizing your members"
          action={
            isManager ? (
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Team
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Team</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateTeam} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900">
                        Team Name
                      </label>
                      <Input
                        placeholder="e.g., Engineering, Marketing"
                        value={createForm.name}
                        onChange={(e) =>
                          setCreateForm({ ...createForm, name: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900">
                        Description (optional)
                      </label>
                      <Textarea
                        placeholder="Team description and purpose"
                        value={createForm.description}
                        onChange={(e) =>
                          setCreateForm({ ...createForm, description: e.target.value })
                        }
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCreateOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit">Create Team</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <div
              key={team.id}
              className="rounded-lg border border-gray-200 bg-white p-6 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
              onClick={() => handleOpenTeamDetails(team)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{team.name}</h3>
                  {team.description && (
                    <p className="mt-1 text-sm text-gray-600">{team.description}</p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                <Users className="h-4 w-4" />
                <span>{team.member_count || 0} members</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Team Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          {selectedTeam && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedTeam.name}</DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {/* Team Info */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-900">Description</p>
                  <p className="text-sm text-gray-600">
                    {selectedTeam.description || 'No description'}
                  </p>
                </div>

                {/* Members Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">Members</p>
                    {isManager && (
                      <Dialog open={editOpen} onOpenChange={setEditOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-1">
                            <Edit2 className="h-3 w-3" />
                            Edit Team
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit Team</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={handleUpdateTeam} className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-900">
                                Team Name
                              </label>
                              <Input
                                value={editForm.name}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, name: e.target.value })
                                }
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-900">
                                Description
                              </label>
                              <Textarea
                                value={editForm.description}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, description: e.target.value })
                                }
                              />
                            </div>
                            <DialogFooter>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setEditOpen(false)}
                              >
                                Cancel
                              </Button>
                              <Button type="submit">Update</Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>

                  {membersLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {teamMembers.length === 0 ? (
                        <p className="text-sm text-gray-500">No members yet</p>
                      ) : (
                        teamMembers.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between rounded border border-gray-200 p-3"
                          >
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {member.user?.email || 'Unknown'}
                              </p>
                              {member.user?.display_name && (
                                <p className="text-xs text-gray-500">{member.user.display_name}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {isManager && (
                                <>
                                  <select
                                    value={member.role}
                                    onChange={(e) =>
                                      handleUpdateMemberRole(
                                        member.id,
                                        e.target.value as 'team_lead' | 'member',
                                      )
                                    }
                                    className="text-xs border border-gray-200 rounded px-2 py-1"
                                  >
                                    <option value="member">Member</option>
                                    <option value="team_lead">Lead</option>
                                  </select>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      handleRemoveMember(member.id, member.user?.email || 'unknown')
                                    }
                                  >
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                  </Button>
                                </>
                              )}
                              {!isManager && (
                                <span className="text-xs text-gray-500 capitalize">
                                  {member.role.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Add Member Form */}
                  {isManager && (
                    <form onSubmit={handleAddMember} className="flex gap-2 pt-2">
                      <Input
                        placeholder="Enter email to add member"
                        type="email"
                        value={addMemberEmail}
                        onChange={(e) => setAddMemberEmail(e.target.value)}
                      />
                      <Button type="submit">Add</Button>
                    </form>
                  )}
                </div>
              </div>

              <DialogFooter>
                {isManager && selectedTeam.name !== 'General' && (
                  <Button
                    variant="destructive"
                    onClick={() =>
                      handleDeleteTeam(selectedTeam.id, selectedTeam.name)
                    }
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Team
                  </Button>
                )}
                <Button variant="outline" onClick={() => setDetailsOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function TeamsPage() {
  return (
    <ProtectedRoute>
      <TeamsContent />
    </ProtectedRoute>
  );
}
