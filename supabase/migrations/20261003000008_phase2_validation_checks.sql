-- Phase 2 Validation Checks
-- Final validation that all Phase 2 migrations completed successfully

-- Check 1: Teams table exists and has data
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teams') THEN
    RAISE EXCEPTION 'Phase 2 ERROR: teams table not created';
  END IF;
  
  RAISE NOTICE 'Phase 2 validation: teams table exists';
END $$;

-- Check 2: Team members table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members') THEN
    RAISE EXCEPTION 'Phase 2 ERROR: team_members table not created';
  END IF;
  
  RAISE NOTICE 'Phase 2 validation: team_members table exists';
END $$;

-- Check 3: All organizations have default teams
DO $$
DECLARE
  orgs_without_teams int;
BEGIN
  SELECT COUNT(*)  INTO orgs_without_teams FROM public.organizations o
  WHERE NOT EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.organization_id = o.id
    AND t.name = 'General'
  );
  
  IF orgs_without_teams > 0 THEN
    RAISE EXCEPTION 'Phase 2 ERROR: % organizations missing default teams', orgs_without_teams;
  END IF;
  
  RAISE NOTICE 'Phase 2 validation: all organizations have default teams';
END $$;

-- Check 4: All organization members have team memberships
DO $$
DECLARE
  users_without_teams int;
BEGIN
  SELECT COUNT(*) INTO users_without_teams FROM public.organization_members om
  WHERE NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.user_id = om.user_id
    AND tm.team_id IN (
      SELECT t.id FROM public.teams t
      WHERE t.organization_id = om.organization_id
    )
  );
  
  IF users_without_teams > 0 THEN
    RAISE EXCEPTION 'Phase 2 ERROR: % users missing team memberships', users_without_teams;
  END IF;
  
  RAISE NOTICE 'Phase 2 validation: all users have team memberships';
END $$;

-- Check 5: user_id columns are UUID type
DO $$
DECLARE
  text_cols int;
BEGIN
  SELECT COUNT(*) INTO text_cols FROM information_schema.columns
  WHERE table_name IN ('meetings', 'tasks')
  AND column_name = 'user_id'
  AND data_type != 'uuid';
  
  IF text_cols > 0 THEN
    RAISE EXCEPTION 'Phase 2 ERROR: user_id columns still text type instead of uuid';
  END IF;
  
  RAISE NOTICE 'Phase 2 validation: all user_id columns are UUID type';
END $$;

-- All Phase 2 validations passed
DO $$
BEGIN
  RAISE NOTICE 'Phase 2 validation complete: all checks passed';
END $$;
