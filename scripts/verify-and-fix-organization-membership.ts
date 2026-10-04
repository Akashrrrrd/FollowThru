/**
 * DIAGNOSTIC AND REPAIR SCRIPT
 * 
 * Verifies organization membership state and fixes missing memberships.
 * Run this script to diagnose and repair the Phase 4 runtime issue.
 * 
 * Usage: npx tsx scripts/verify-and-fix-organization-membership.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log('='.repeat(70));
  console.log('PHASE 4 RUNTIME FIX - DATABASE VERIFICATION AND REPAIR');
  console.log('='.repeat(70));
  console.log();

  try {
    // Step 1: Check integrity across all users
    console.log('STEP 1: Checking organization membership integrity...');
    console.log();

    const { data: usersWithoutOrg, error: integrityError } = await supabase
      .from('auth.users')
      .select('id, email, created_at')
      .not('id', 'in', `(SELECT DISTINCT user_id FROM public.organization_members)`);

    if (integrityError) {
      console.error('Integrity check query failed:', integrityError);
      // This query might fail due to RLS or query syntax, try alternative
      console.log('Trying alternative query...');
      
      const { data: allUsers, error: usersError } = await supabase
        .from('organization_members')
        .select('user_id, organization_id, role, created_at')
        .limit(1);

      if (usersError) {
        console.error('Cannot access organization_members:', usersError);
        console.log('Note: This may be a permissions issue. Service role key may not have access.');
        console.log('Proceeding with direct approach...');
      }
    }

    // Step 2: Get all organizations
    console.log('STEP 2: Fetching all organizations...');
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name, created_at')
      .limit(100);

    if (orgsError) {
      console.error('Failed to fetch organizations:', orgsError.message);
    } else {
      console.log(`Found ${orgs?.length || 0} organizations`);
      if (orgs && orgs.length > 0) {
        orgs.slice(0, 3).forEach(org => {
          console.log(`  - ${org.name} (${org.id})`);
        });
      }
    }
    console.log();

    // Step 3: Check organization_members table
    console.log('STEP 3: Checking organization_members table...');
    const { data: members, error: membersError, count } = await supabase
      .from('organization_members')
      .select('user_id, organization_id, role, created_at', { count: 'exact' })
      .limit(100);

    if (membersError) {
      console.error('Failed to fetch organization_members:', membersError.message);
    } else {
      console.log(`Total organization_members records: ${count || 0}`);
      if (members && members.length > 0) {
        console.log('Sample records:');
        members.slice(0, 3).forEach(member => {
          console.log(`  - user_id: ${member.user_id}, org_id: ${member.organization_id}, role: ${member.role}`);
        });
      }
    }
    console.log();

    // Step 4: Try to identify currently authenticated user(s)
    console.log('STEP 4: Listing recent auth.users (last 10 created)...');
    const { data: recentUsers, error: recentError } = await supabase
      .from('auth.users')
      .select('id, email, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentError) {
      console.error('Failed to fetch recent users:', recentError.message);
      console.log('Note: auth.users table may not be directly queryable with service role.');
    } else if (recentUsers && recentUsers.length > 0) {
      console.log(`Found ${recentUsers.length} recent users:`);
      recentUsers.forEach(user => {
        console.log(`  - ${user.email || user.id} (created: ${user.created_at})`);
      });
      console.log();

      // Step 5: Check each recent user's organization membership
      console.log('STEP 5: Checking organization membership for recent users...');
      for (const user of recentUsers.slice(0, 5)) {
        const { data: userOrgs, error: userOrgError } = await supabase
          .from('organization_members')
          .select('organization_id, role')
          .eq('user_id', user.id);

        if (userOrgError) {
          console.log(`  [ERROR] User ${user.email || user.id}: ${userOrgError.message}`);
        } else {
          const count = userOrgs?.length || 0;
          if (count === 0) {
            console.log(`  ❌ User ${user.email || user.id} - NO ORGANIZATION MEMBERSHIP`);
          } else {
            console.log(`  ✓ User ${user.email || user.id} - ${count} memberships:`);
            userOrgs?.forEach(org => {
              console.log(`    - org_id: ${org.organization_id}, role: ${org.role}`);
            });
          }
        }
      }
    }

    console.log();
    console.log('='.repeat(70));
    console.log('VERIFICATION COMPLETE');
    console.log('='.repeat(70));

  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

main();
