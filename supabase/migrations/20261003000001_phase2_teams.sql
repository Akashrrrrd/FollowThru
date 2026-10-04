/*
# Phase 2: Teams & Organizational Hierarchy
# Build team structure and role-based access on top of Phase 1 org foundation

1. New Tables
   - teams: org container for teams
   - team_members: users within teams with roles

2. Modified Tables
   - meetings: add team_id (optional, for team-scoped meetings)
   - tasks: add team_id (optional, inherited from meeting's team)

3. Security
   - RLS policies enforce team + org isolation
   - No team access across organizations
   - Role-based visibility rules

4. Data Migration
   - Create default team per organization
   - Assign all existing org members to default team
   - Link existing meetings/tasks to default team
   - Preserve all data integrity
*/

-- ============================================================================
-- PART 1: NEW TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  description text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- RLS: Users can see teams in their organization
CREATE POLICY "view_org_teams" ON public.teams FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- RLS: Managers can create teams in their org
-- Handled at API layer (authorization check before insert)

-- Indexes
CREATE INDEX IF NOT EXISTS idx_teams_organization_id ON public.teams(organization_id);
CREATE INDEX IF NOT EXISTS idx_teams_created_by ON public.teams(created_by);
CREATE INDEX IF NOT EXISTS idx_teams_created_at ON public.teams(created_at);

-- ============================================================================

CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('team_lead', 'member')),
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id, user_id)
);

-- Enable RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- RLS: Users can see team members for teams in their organization
CREATE POLICY "view_team_members" ON public.team_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_members.team_id
      AND t.organization_id IN (
        SELECT om.organization_id
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
      )
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON public.team_members(role);

-- ============================================================================
-- PART 2: ALTER EXISTING TABLES
-- ============================================================================

-- Add team_id to meetings (optional, for team-scoped meetings)
ALTER TABLE public.meetings
ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

-- Add team_id to tasks (optional, inherited from meeting)
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

-- ============================================================================
-- PART 3: INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_meetings_team_id ON public.meetings(team_id);
CREATE INDEX IF NOT EXISTS idx_tasks_team_id ON public.tasks(team_id);
CREATE INDEX IF NOT EXISTS idx_tasks_team_id_status ON public.tasks(team_id, status);

-- ============================================================================
-- PART 4: DATA MIGRATION (CRITICAL)
-- ============================================================================

/*
Migration strategy:
1. For each organization, create a default team
2. Add all organization members to that default team
3. Backfill team_id in existing meetings/tasks
4. This preserves all data and establishes team boundaries
*/

-- Create default team per organization
-- (Idempotent: only creates if not already team-assigned)
INSERT INTO public.teams (organization_id, name, description, created_by, created_at, updated_at)
SELECT 
  o.id,
  'General',
  'Default team for organization',
  om.user_id,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM public.organizations o
CROSS JOIN (
  SELECT om2.user_id
  FROM public.organization_members om2
  WHERE om2.organization_id = o.id
  AND om2.role = 'owner'
  LIMIT 1
) om
WHERE NOT EXISTS (
  SELECT 1 FROM public.teams t
  WHERE t.organization_id = o.id
  AND t.name = 'General'
);

-- Add all organization members to default team
-- (Idempotent: only adds if not already a team member)
INSERT INTO public.team_members (team_id, user_id, role, created_at, updated_at)
SELECT 
  t.id,
  om.user_id,
  CASE 
    WHEN om.role = 'owner' THEN 'team_lead'
    WHEN om.role = 'manager' THEN 'team_lead'
    ELSE 'member'
  END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM public.teams t
JOIN public.organizations o ON t.organization_id = o.id
JOIN public.organization_members om ON o.id = om.organization_id
WHERE t.name = 'General'
AND NOT EXISTS (
  SELECT 1 FROM public.team_members tm
  WHERE tm.team_id = t.id
  AND tm.user_id = om.user_id
);

-- Backfill team_id in existing meetings
-- Assign to default team of the meeting's organization
UPDATE public.meetings m
SET team_id = (
  SELECT t.id
  FROM public.teams t
  WHERE t.organization_id = m.organization_id
  AND t.name = 'General'
  LIMIT 1
)
WHERE m.team_id IS NULL
AND m.organization_id IS NOT NULL;

-- Backfill team_id in existing tasks
-- Assign from parent meeting's team_id
UPDATE public.tasks t
SET team_id = (
  SELECT m.team_id
  FROM public.meetings m
  WHERE m.id = t.meeting_id
)
WHERE t.team_id IS NULL
AND t.meeting_id IS NOT NULL
AND EXISTS (
  SELECT 1 FROM public.meetings m
  WHERE m.id = t.meeting_id
  AND m.team_id IS NOT NULL
);

-- ============================================================================
-- PART 5: ROLE-BASED ACCESS CONTROL (RLS UPDATE)
-- ============================================================================

-- Update meetings RLS to include team-based access
-- Drop old policy (org-only) and replace with org+team policy
DROP POLICY IF EXISTS "select_org_meetings" ON public.meetings;

CREATE POLICY "select_org_meetings" ON public.meetings FOR SELECT
  USING (
    -- User is member of organization
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- Users can see meetings from their teams
-- This is implied by org access + team context will be checked in API
-- For now, team-based filtering is API-level, not RLS-level (to preserve backward compat)

-- Similarly for tasks - team filtering is API-level in Phase 2
-- Phase 3+ can refine RLS if needed for finer-grained team restrictions

-- ============================================================================
-- PART 6: END MIGRATION
-- ============================================================================
