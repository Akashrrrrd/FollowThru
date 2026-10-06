-- Add composite indexes for common query patterns
-- These indexes target high-frequency operations in task filtering, team membership,
-- and organization member access patterns used throughout the application.

-- Phase 1: Critical indexes (deployed immediately for authentication performance)

-- Team member lookup by user and team (called on nearly every API request)
-- Used in: lib/team-context.ts, team authorization, profile endpoint
CREATE INDEX IF NOT EXISTS idx_team_members_user_id_team_id 
  ON public.team_members(user_id, team_id);

-- Organization member lookup by org and user (authorization checks on every request)
-- Used in: app/api/profile/route.ts, bulk operations, lib/bulk-action-service.ts
CREATE INDEX IF NOT EXISTS idx_organization_members_organization_id_user_id 
  ON public.organization_members(organization_id, user_id);

-- Phase 2: High-ROI indexes (dashboard and analytics performance)

-- Task filtering by team and status (analytics, team dashboards)
-- Query pattern: WHERE team_id IN (?) AND status = ?
CREATE INDEX IF NOT EXISTS idx_tasks_team_id_status 
  ON public.tasks(team_id, status);

-- Task filtering by organization and status (manager dashboards)
-- Query pattern: WHERE organization_id = ? AND status IN (...)
CREATE INDEX IF NOT EXISTS idx_tasks_organization_id_status 
  ON public.tasks(organization_id, status);

-- Task filtering by owner and status (personal dashboards)
-- Query pattern: WHERE owner_user_id = ? AND status = ?
CREATE INDEX IF NOT EXISTS idx_tasks_owner_user_id_status 
  ON public.tasks(owner_user_id, status);

-- Phase 3: Medium-priority indexes (team and invitation management)

-- Team invitation filtering by team and status (invitation management, expiration)
-- Query pattern: WHERE team_id = ? AND status = 'pending'
CREATE INDEX IF NOT EXISTS idx_team_invitations_team_id_status 
  ON public.team_invitations(team_id, status);

-- Team invitation lookup by email and status (authentication flow)
-- Query pattern: WHERE email = ? AND status = 'pending'
CREATE INDEX IF NOT EXISTS idx_team_invitations_email_status 
  ON public.team_invitations(email, status);

-- Team invitation filtering by organization and status (team management)
-- Query pattern: WHERE organization_id = ? AND status = 'pending'
CREATE INDEX IF NOT EXISTS idx_team_invitations_organization_id_status 
  ON public.team_invitations(organization_id, status);

-- Task filtering with sort by due date (task lists)
-- Query pattern: WHERE team_id IN (?) AND status = ? ORDER BY due_date ASC
-- This allows sorting without post-fetch processing
CREATE INDEX IF NOT EXISTS idx_tasks_team_id_status_due_date 
  ON public.tasks(team_id, status, due_date);
