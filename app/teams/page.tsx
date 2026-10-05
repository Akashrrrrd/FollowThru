'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Edit2, Users, Loader2, Mail } from 'lucide-react';
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
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/hooks/use-toast';
import type { Team, TeamMember } from '@/lib/types';

interface TeamWithMembers extends Team {
  member_count?: number;
  user_role?: 'team_lead' | 'member';
}

interface MemberView extends Omit<TeamMember, 'user'> {
  user?: {
    id: string;
    email?: string | null;
    display_name?: string | null;
    full_name?: string | null;
  };
}

interface PendingInvitation {
  id: string;
  email: string;
  role: 'team_lead' | 'member';
  created_at: string;
  token_expires_at: string;
}

function memberName(m: MemberView): string {
  return m.user?.full_name || m.user?.display_name || m.user?.email || 'Unknown member';
}

function TeamsContent() {
  const authFetch = useAuthFetch();
  const { toast } = useToast();
  const { user: authUser, organization } = useAuth();

  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Creating teams is an org-level action; the API still enforces it.
  const canCreateTeam = organization?.role === 'owner' || organization?.role === 'manager';

  // Modal states
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamWithMembers | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [addMemberEmail, setAddMemberEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  // Members + permissions for the currently open team (all computed by the server)
  const [teamMembers, setTeamMembers] = useState<MemberView[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [orgRole, setOrgRole] = useState<string | null>(null);

  // Org owners/managers: delete teams, change roles, remove team leads (the API enforces this too)
  const canDeleteTeam = orgRole === 'owner' || orgRole === 'manager';

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

      setTeams(data.teams || []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching teams:', err);
      setError('Failed to load teams');
      setLoading(false);
    }
  }, [authFetch]);

  /** Returns true when members were loaded successfully. */
  const fetchTeamMembers = useCallback(
    async (teamId: string): Promise<boolean> => {
      setMembersLoading(true);

      try {
        const res = await authFetch(`/api/teams/${teamId}/members`);
        const data = await res.json();

        if (!res.ok) {
          toast({ title: 'Error', description: data.error || 'Failed to load members' });
          return false;
        }

        setTeamMembers(data.members || []);
        setPendingInvitations(data.invitations || []);
        setCanManage(Boolean(data.can_manage));
        setOrgRole(data.org_role ?? null);
        return true;
      } catch (err) {
        console.error('Error fetching team members:', err);
        toast({ title: 'Error', description: 'Failed to load members' });
        return false;
      } finally {
        setMembersLoading(false);
      }
    },
    [authFetch, toast],
  );

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

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
      setSelectedTeam({
        ...selectedTeam,
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
      } as TeamWithMembers);
    } catch (err) {
      console.error('Error updating team:', err);
      toast({ title: 'Error', description: 'Failed to update team' });
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Are you sure you want to delete "${teamName}"?`)) return;

    try {
      const res = await authFetch(`/api/teams/${teamId}`, { method: 'DELETE' });

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

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTeam || !addMemberEmail.trim()) {
      toast({ title: 'Error', description: 'Email is required' });
      return;
    }

    setAddingMember(true);

    try {
      const res = await authFetch(`/api/teams/${selectedTeam.id}/members`, {
        method: 'POST',
        body: JSON.stringify({ email: addMemberEmail.trim(), role: 'member' }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({ title: 'Error', description: data.error || 'Failed to add member' });
        return;
      }

      if (data.warning) {
        toast({ title: 'Invitation created', description: data.warning });
      } else {
        toast({ title: 'Success', description: data.message || 'Member added to team' });
      }

      setAddMemberEmail('');
      await fetchTeamMembers(selectedTeam.id);
    } catch (err) {
      console.error('Error adding member:', err);
      toast({ title: 'Error', description: 'Failed to add member' });
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string, label: string) => {
    if (!selectedTeam) return;
    if (!confirm(`Remove ${label} from this team?`)) return;

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
    // Reset anything left over from a previously opened team so permissions never leak across teams
    setSelectedTeam(team);
    setEditForm({ name: team.name, description: team.description || '' });
    setTeamMembers([]);
    setPendingInvitations([]);
    setCanManage(false);
    setOrgRole(null);

    const ok = await fetchTeamMembers(team.id);
    if (ok) setDetailsOpen(true);
  };

  if (loading) return <PageLoading />;
  if (error) return <PageError message={error} />;

  const renderCreateDialog = (label: string) => (
    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          {label}
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
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900">Description (optional)</label>
            <Textarea
              placeholder="Team description and purpose"
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Team</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Teams</h1>
          <p className="mt-1 text-sm text-gray-600">Manage your organization's teams and members</p>
        </div>
        {canCreateTeam && renderCreateDialog('New Team')}
      </div>

      {/* Teams Grid */}
      {teams.length === 0 ? (
        <EmptyState
          title="No teams yet"
          description={
            canCreateTeam
              ? 'Create your first team to get started organizing your members'
              : 'You are not part of any team yet'
          }
          action={canCreateTeam ? renderCreateDialog('Create Team') : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <button
              type="button"
              key={team.id}
              className="rounded-lg border border-gray-200 bg-white p-6 text-left transition-all hover:border-gray-300 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
              onClick={() => handleOpenTeamDetails(team)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{team.name}</h3>
                  {team.description && (
                    <p className="mt-1 text-sm text-gray-600">{team.description}</p>
                  )}
                </div>
                {team.user_role === 'team_lead' && (
                  <span className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                    Lead
                  </span>
                )}
              </div>

              <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                <Users className="h-4 w-4" />
                <span>{team.member_count || 0} members</span>
              </div>
            </button>
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
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-900">Description</p>
                  <p className="text-sm text-gray-600">{selectedTeam.description || 'No description'}</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">
                      Members{!membersLoading && ` (${teamMembers.length})`}
                    </p>

                    {/* Edit button: only for people who can manage THIS team */}
                    {canManage && (
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
                              <label className="block text-sm font-medium text-gray-900">Team Name</label>
                              <Input
                                value={editForm.name}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-900">Description</label>
                              <Textarea
                                value={editForm.description}
                                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                              />
                            </div>
                            <DialogFooter>
                              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
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
                    <ul className="max-h-64 space-y-2 overflow-y-auto">
                      {teamMembers.length === 0 ? (
                        <li className="text-sm text-gray-500">No members yet</li>
                      ) : (
                        teamMembers.map((member) => {
                          const name = memberName(member);
                          const isYou = member.user_id === authUser?.id;
                          const secondary =
                            member.user?.email && member.user.email !== name ? member.user.email : null;

                          return (
                            <li
                              key={member.id}
                              className="flex items-center justify-between rounded border border-gray-200 p-3"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-gray-900">
                                  {name}
                                  {isYou && <span className="ml-2 text-xs font-normal text-gray-500">(you)</span>}
                                </p>
                                {secondary && <p className="truncate text-xs text-gray-500">{secondary}</p>}
                              </div>

                              <div className="ml-3 flex shrink-0 items-center gap-2">
                                {canManage ? (
                                  <>
                                    {canDeleteTeam ? (
<select
                                      aria-label={`Role for ${name}`}
                                      value={member.role}
                                      onChange={(e) =>
                                        handleUpdateMemberRole(member.id, e.target.value as 'team_lead' | 'member')
                                      }
                                      className="rounded border border-gray-200 px-2 py-1 text-xs"
                                    >
                                      <option value="member">Member</option>
                                      <option value="team_lead">Lead</option>
                                    </select>
) : (
<span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-600">{member.role === 'team_lead' ? 'Team lead' : 'Member'}</span>
)}
                                    {!isYou && (member.role !== 'team_lead' || canDeleteTeam) && (
<Button
                                      variant="ghost"
                                      size="sm"
                                      aria-label={`Remove ${name}`}
                                      onClick={() => handleRemoveMember(member.id, name)}
                                    >
                                      <Trash2 className="h-4 w-4 text-red-600" />
                                    </Button>
)}
                                  </>
                                ) : (
                                  <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-600">
                                    {member.role === 'team_lead' ? 'Team lead' : 'Member'}
                                  </span>
                                )}
                              </div>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  )}

                  {/* Pending invitations (managers only) */}
                  {canManage && pendingInvitations.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-900">Pending invitations</p>
                      {pendingInvitations.map((inv) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between rounded border border-dashed border-gray-300 bg-gray-50 p-3"
                        >
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-700">{inv.email}</span>
                          </div>
                          <span className="text-xs text-gray-500">
                            expires {new Date(inv.token_expires_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add member / invite (managers only) */}
                  {canManage && (
                    <form onSubmit={handleAddMember} className="flex gap-2 pt-2">
                      <Input
                        placeholder="Enter email to add or invite"
                        type="email"
                        value={addMemberEmail}
                        onChange={(e) => setAddMemberEmail(e.target.value)}
                      />
                      <Button type="submit" disabled={addingMember}>
                        {addingMember ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
                      </Button>
                    </form>
                  )}
                </div>
              </div>

              <DialogFooter>
                {canDeleteTeam && selectedTeam.name !== 'General' && (
                  <Button variant="destructive" onClick={() => handleDeleteTeam(selectedTeam.id, selectedTeam.name)}>
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