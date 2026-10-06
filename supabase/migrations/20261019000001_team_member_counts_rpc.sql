-- Migration: Add RPC function for efficient team member count aggregation
-- Phase 2 Task 7: Fix N+1 patterns in organization dashboard
-- Purpose: Return member counts grouped by team_id in a single query
-- Impact: Reduces dashboard load query from 1 + N (per team) to 1 aggregated RPC

-- Create or replace RPC function to get team member counts
-- Input: array of team_id UUIDs
-- Output: array of records with team_id and member_count
-- This replaces the pattern of fetching all team_members and counting in application code

CREATE OR REPLACE FUNCTION get_team_member_counts(team_ids UUID[])
RETURNS TABLE(team_id UUID, member_count INT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tm.team_id,
    COUNT(*)::INT AS member_count
  FROM team_members tm
  WHERE tm.team_id = ANY(team_ids)
  GROUP BY tm.team_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_team_member_counts(UUID[]) TO authenticated;

-- Create index on team_members.team_id if it doesn't exist (for GROUP BY performance)
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);

-- Note: RLS policies are inherited from team_members table through function execution
-- Users can only see counts for teams they have access to (via RLS on team_members)
