import { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export interface CreateInvitationParams {
  teamId: string;
  organizationId: string;
  email: string;
  role: 'team_lead' | 'member';
  invitedBy: string;
}

export interface TeamInvitation {
  id: string;
  team_id: string;
  organization_id: string;
  email: string;
  role: 'team_lead' | 'member';
  invited_by: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  token: string;
  token_expires_at: string;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

const INVITATION_TTL_DAYS = 7;

export class TeamInvitationService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Mark pending invitations whose expiry has passed as expired.
   * Without this, a stale pending row blocks re-inviting the same email
   * (hasPendingInvitation + the partial unique index).
   */
  private async expireStale(teamId?: string, email?: string): Promise<void> {
    let query = this.supabase
      .from('team_invitations')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('token_expires_at', new Date().toISOString());

    if (teamId) query = query.eq('team_id', teamId);
    if (email) query = query.eq('email', email.toLowerCase().trim());

    const { error } = await query;
    if (error) {
      console.warn('Failed to expire stale invitations:', error.message);
    }
  }

  async createInvitation(params: CreateInvitationParams): Promise<TeamInvitation> {
    const email = params.email.toLowerCase().trim();
    await this.expireStale(params.teamId, email);

    const token = this.generateToken();
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + INVITATION_TTL_DAYS);

    const { data, error } = await this.supabase
      .from('team_invitations')
      .insert({
        team_id: params.teamId,
        organization_id: params.organizationId,
        email,
        role: params.role,
        invited_by: params.invitedBy,
        token,
        token_expires_at: tokenExpiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create invitation: ${error.message}`);
    }

    return data as TeamInvitation;
  }

  async getInvitationByToken(token: string): Promise<TeamInvitation | null> {
    const { data, error } = await this.supabase
      .from('team_invitations')
      .select()
      .eq('token', token)
      .eq('status', 'pending')
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch invitation: ${error.message}`);
    }

    if (!data) return null;

    if (new Date(data.token_expires_at) < new Date()) {
      await this.supabase
        .from('team_invitations')
        .update({ status: 'expired' })
        .eq('id', data.id);
      return null;
    }

    return data as TeamInvitation;
  }

  /**
   * Accept an invitation.
   *
   * - The signed-in user's email must match the invited email.
   * - Invited people are usually brand-new users who are not yet in the
   *   organization, so accepting adds them to the organization (as a
   *   regular member) first. The invitation was issued by an org manager,
   *   so the token itself is the authorization.
   */
  async acceptInvitation(
    token: string,
    userId: string,
    userEmail: string | null,
  ): Promise<void> {
    console.log(`[acceptInvitation] Accepting invitation for user ${userId} email ${userEmail}`);
    
    const invitation = await this.getInvitationByToken(token);

    if (!invitation) {
      throw new Error('Invalid or expired invitation');
    }

    if (
      !userEmail ||
      userEmail.toLowerCase().trim() !== invitation.email.toLowerCase().trim()
    ) {
      throw new Error('Invitation email mismatch');
    }

    // Ensure organization membership
    const { data: orgMember, error: orgError } = await this.supabase
      .from('organization_members')
      .select('id')
      .eq('user_id', userId)
      .eq('organization_id', invitation.organization_id)
      .maybeSingle();

    if (orgError) {
      console.error(`[acceptInvitation] Failed to check org membership:`, orgError);
      throw new Error(`Failed to verify organization membership: ${orgError.message}`);
    }

    if (!orgMember) {
      console.log(`[acceptInvitation] User ${userId} not in org ${invitation.organization_id}, adding...`);
      const { error: joinError } = await this.supabase
        .from('organization_members')
        .insert({
          user_id: userId,
          organization_id: invitation.organization_id,
          role: 'member',
        });

      // 23505 = already a member (race) -> fine
      if (joinError && joinError.code !== '23505') {
        console.error(`[acceptInvitation] Failed to join org:`, joinError);
        throw new Error(`Failed to join organization: ${joinError.message}`);
      }
      console.log(`[acceptInvitation] Successfully added user ${userId} to org ${invitation.organization_id}`);
    } else {
      console.log(`[acceptInvitation] User ${userId} already in org ${invitation.organization_id}`);
    }

    // Add to team if not already a member
    const { data: existingMember, error: existingError } = await this.supabase
      .from('team_members')
      .select('id')
      .eq('team_id', invitation.team_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Failed to check team membership: ${existingError.message}`);
    }

    if (!existingMember) {
      const { error: insertError } = await this.supabase
        .from('team_members')
        .insert({
          team_id: invitation.team_id,
          user_id: userId,
          role: invitation.role,
        });

      if (insertError && insertError.code !== '23505') {
        console.error(`[acceptInvitation] Failed to add user ${userId} to team ${invitation.team_id}:`, insertError);
        throw new Error(`Failed to add user to team: ${insertError.message}`);
      }
      
      console.log(`[acceptInvitation] Successfully added user ${userId} to team ${invitation.team_id} with role ${invitation.role}`);
    } else {
      console.log(`[acceptInvitation] User ${userId} already a member of team ${invitation.team_id}`);
    }

    // Mark accepted (guard on status so a double-click can't re-accept)
    const { error: updateError } = await this.supabase
      .from('team_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invitation.id)
      .eq('status', 'pending');

    if (updateError) {
      throw new Error(`Failed to update invitation: ${updateError.message}`);
    }
  }

  async hasPendingInvitation(email: string, teamId: string): Promise<boolean> {
    const normalized = email.toLowerCase().trim();
    await this.expireStale(teamId, normalized);

    const { data, error } = await this.supabase
      .from('team_invitations')
      .select('id')
      .eq('email', normalized)
      .eq('team_id', teamId)
      .eq('status', 'pending')
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to check invitation: ${error.message}`);
    }

    return !!data;
  }

  async getPendingInvitationsByEmail(email: string): Promise<TeamInvitation[]> {
    const { data, error } = await this.supabase
      .from('team_invitations')
      .select()
      .eq('email', email.toLowerCase().trim())
      .eq('status', 'pending')
      .gt('token_expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch invitations: ${error.message}`);
    }

    return (data || []) as TeamInvitation[];
  }

  /**
   * Pending, unexpired invitations for a team (token is NOT returned).
   */
  async getPendingInvitationsForTeam(teamId: string) {
    const { data, error } = await this.supabase
      .from('team_invitations')
      .select('id, email, role, created_at, token_expires_at')
      .eq('team_id', teamId)
      .eq('status', 'pending')
      .gt('token_expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch team invitations: ${error.message}`);
    }

    return data || [];
  }

  async rejectInvitation(token: string): Promise<void> {
    const invitation = await this.getInvitationByToken(token);

    if (!invitation) {
      throw new Error('Invalid or expired invitation');
    }

    const { error } = await this.supabase
      .from('team_invitations')
      .update({ status: 'rejected' })
      .eq('id', invitation.id);

    if (error) {
      throw new Error(`Failed to reject invitation: ${error.message}`);
    }
  }

  getAcceptanceUrl(token: string, baseUrl: string): string {
    return `${baseUrl.replace(/\/$/, '')}/accept-team-invitation?token=${token}`;
  }

  async getInvitationWithDetails(token: string) {
    const invitation = await this.getInvitationByToken(token);

    if (!invitation) return null;

    const { data: team } = await this.supabase
      .from('teams')
      .select('id, name, organization_id')
      .eq('id', invitation.team_id)
      .maybeSingle();

    const { data: inviterProfile } = invitation.invited_by
      ? await this.supabase
          .from('user_profiles')
          .select('display_name, full_name')
          .eq('id', invitation.invited_by)
          .maybeSingle()
      : { data: null };

    return { invitation, team, inviterProfile };
  }
}