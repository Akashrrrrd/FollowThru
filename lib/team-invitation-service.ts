import { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

interface CreateInvitationParams {
  teamId: string;
  organizationId: string;
  email: string;
  role: 'team_lead' | 'member';
  invitedBy: string;
}

interface TeamInvitation {
  id: string;
  team_id: string;
  organization_id: string;
  email: string;
  role: 'team_lead' | 'member';
  invited_by: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  token: string;
  token_expires_at: string;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export class TeamInvitationService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Generate a secure random token for the invitation
   */
  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create a new team invitation
   */
  async createInvitation(params: CreateInvitationParams): Promise<TeamInvitation> {
    const token = this.generateToken();
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 7); // Valid for 7 days

    const { data, error } = await this.supabase
      .from('team_invitations')
      .insert({
        team_id: params.teamId,
        organization_id: params.organizationId,
        email: params.email.toLowerCase().trim(),
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

  /**
   * Get invitation by token
   */
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

    if (!data) {
      return null;
    }

    // Check if token has expired
    const expiresAt = new Date(data.token_expires_at);
    if (expiresAt < new Date()) {
      // Mark as expired
      await this.supabase
        .from('team_invitations')
        .update({ status: 'expired' })
        .eq('id', data.id);

      return null;
    }

    return data as TeamInvitation;
  }

  /**
   * Accept an invitation and add user to team
   */
  async acceptInvitation(token: string, userId: string): Promise<void> {
    const invitation = await this.getInvitationByToken(token);

    if (!invitation) {
      throw new Error('Invalid or expired invitation');
    }

    // Verify user is in organization
    const { data: orgMember, error: orgError } = await this.supabase
      .from('organization_members')
      .select('id')
      .eq('user_id', userId)
      .eq('organization_id', invitation.organization_id)
      .maybeSingle();

    if (orgError || !orgMember) {
      throw new Error('User is not a member of this organization');
    }

    // Add user to team if not already a member
    const { data: existingMember } = await this.supabase
      .from('team_members')
      .select('id')
      .eq('team_id', invitation.team_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existingMember) {
      const { error: insertError } = await this.supabase
        .from('team_members')
        .insert({
          team_id: invitation.team_id,
          user_id: userId,
          role: invitation.role,
        });

      if (insertError) {
        throw new Error(`Failed to add user to team: ${insertError.message}`);
      }
    }

    // Mark invitation as accepted
    const { error: updateError } = await this.supabase
      .from('team_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invitation.id);

    if (updateError) {
      throw new Error(`Failed to update invitation: ${updateError.message}`);
    }
  }

  /**
   * Check if an email already has a pending invitation for a team
   */
  async hasPendingInvitation(email: string, teamId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('team_invitations')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .eq('team_id', teamId)
      .eq('status', 'pending')
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to check invitation: ${error.message}`);
    }

    return !!data;
  }

  /**
   * Get all pending invitations for an email
   */
  async getPendingInvitationsByEmail(email: string): Promise<TeamInvitation[]> {
    const { data, error } = await this.supabase
      .from('team_invitations')
      .select()
      .eq('email', email.toLowerCase().trim())
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch invitations: ${error.message}`);
    }

    return (data || []) as TeamInvitation[];
  }

  /**
   * Reject an invitation
   */
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

  /**
   * Generate invitation acceptance URL
   */
  getAcceptanceUrl(token: string, baseUrl: string): string {
    return `${baseUrl}/accept-team-invitation?token=${token}`;
  }

  /**
   * Get invitation details with team and inviter info
   */
  async getInvitationWithDetails(token: string) {
    const invitation = await this.getInvitationByToken(token);

    if (!invitation) {
      return null;
    }

    const { data: team } = await this.supabase
      .from('teams')
      .select('id, name, organization_id')
      .eq('id', invitation.team_id)
      .maybeSingle();

    const { data: inviterProfile } = await this.supabase
      .from('user_profiles')
      .select('display_name, full_name')
      .eq('id', invitation.invited_by)
      .maybeSingle();

    return {
      invitation,
      team,
      inviterProfile,
    };
  }
}
