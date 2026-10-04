# Phase 2: Team Context Integration Guide

## Overview

Phase 2 adds team context to the application's auth flow and provides client-side hooks for accessing team information. All existing features remain unchanged; teams are integrated seamlessly.

## Architecture

### Server-Side (Backend)

**Organization Context** (Phase 1)
- User belongs to exactly ONE organization
- Resolved via `getUserOrganizationContext()`
- Returns: `organizationId`, `role` (owner/manager/member)

**Team Context** (Phase 2 - NEW)
- User can belong to MULTIPLE teams within their organization
- Each team has a role: `team_lead` or `member`
- Resolved via `getUserTeamContext()`
- Returns: list of teams with roles, default team info

### Data Flow

1. **Login** → `/api/profile` GET
2. Profile endpoint:
   - Fetches user profile, stats
   - Ensures user in default team (`ensureUserInDefaultTeam()`)
   - Returns organization + team context
3. Client receives `organization` and `teams` in response
4. Components use hooks to access context

## Server-Side Helpers

All in `lib/team-context.ts` (server-side helpers, use in API routes):

```typescript
// Get user's complete team context
const teamContext = await getUserTeamContext(supabase, userId, orgId);
// Returns: { organizationId, teams: [{teamId, teamName, role}], defaultTeamId, defaultTeamName }

// Get team with member count
const teamWithCount = await getTeamWithMemberCount(supabase, teamId);

// Get user's role in a specific team
const role = await getUserRoleInTeam(supabase, userId, teamId);

// Get team members with profiles
const members = await getTeamMembersWithProfiles(supabase, teamId);

// Check if user is team lead
const isLead = await isTeamLead(supabase, userId, teamId);
```

## Client-Side Hooks (NEW)

All in `hooks/use-team-context.ts` and `hooks/use-organization-context.ts`:

### useTeamContext()

```typescript
const { context, loading, error } = useTeamContext();

// context = {
//   organizationId: string,
//   teams: [{ teamId, teamName, role }],
//   defaultTeamId?: string,
//   defaultTeamName?: string
// }
```

**Helper hooks:**

```typescript
// Check if user is team lead in any team
const isTeamLead = useIsTeamLead();

// Get user's default team
const { teamId, teamName } = useDefaultTeam();

// Check if user is in a specific team
const inTeam = useIsInTeam(teamId);
```

### useOrganizationContext()

```typescript
const { organization, loading, error, isManager } = useOrganizationContext();

// organization = { id, role: 'owner' | 'manager' | 'member' }
// isManager = true if role is 'owner' or 'manager'
```

**Helper hooks:**

```typescript
// Check if user is manager/owner
const isManager = useIsManager();

// Get organization ID
const orgId = useOrganizationId();
```

## Usage Examples

### Example 1: Show Create Team Button (Managers Only)

```typescript
'use client';
import { useIsManager } from '@/hooks/use-organization-context';
import { Button } from '@/components/ui/button';

export function TeamActions() {
  const isManager = useIsManager();

  if (!isManager) return null;

  return (
    <Button onClick={() => setCreateOpen(true)}>
      Create Team
    </Button>
  );
}
```

### Example 2: Display User's Teams

```typescript
'use client';
import { useTeamContext } from '@/hooks/use-team-context';

export function TeamsList() {
  const { context, loading } = useTeamContext();

  if (loading) return <div>Loading teams...</div>;
  if (!context) return <div>No teams found</div>;

  return (
    <div>
      <h3>My Teams ({context.teams.length})</h3>
      {context.teams.map((team) => (
        <div key={team.teamId}>
          <p>{team.teamName}</p>
          <span className="text-sm text-gray-500">
            Role: {team.role.replace('_', ' ')}
          </span>
        </div>
      ))}
    </div>
  );
}
```

### Example 3: Show Team Management UI (Team Leads Only)

```typescript
'use client';
import { useTeamContext, useIsTeamLead } from '@/hooks/use-team-context';
import { Button } from '@/components/ui/button';

export function TeamSettings() {
  const isTeamLead = useIsTeamLead();

  if (!isTeamLead) return <p>You don't have permission to manage teams</p>;

  return (
    <div>
      <h3>Team Management</h3>
      <Button>Add Member</Button>
      <Button>Remove Member</Button>
    </div>
  );
}
```

### Example 4: API Route Using Team Context

```typescript
// app/api/some-endpoint/route.ts
import { getUserTeamContext } from '@/lib/team-context';
import { getUserOrganizationContext } from '@/lib/organization-context';

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  const supabase = createServerClient();

  // Get org and team context
  const orgContext = await getUserOrganizationContext(supabase, user.userId);
  const teamContext = await getUserTeamContext(supabase, user.userId, orgContext.organizationId);

  // Use team context in query
  const teamIds = teamContext.teams.map(t => t.teamId);
  const { data } = await supabase
    .from('some_table')
    .select('*')
    .in('team_id', teamIds);

  return NextResponse.json({ data });
}
```

## Profile API Response (Updated)

The `/api/profile` endpoint now returns:

```json
{
  "profile": { /* user profile */ },
  "user": { "id", "email", "created_at" },
  "organization": {
    "id": "org-uuid",
    "role": "manager"
  },
  "teams": {
    "organizationId": "org-uuid",
    "teams": [
      { "teamId": "team-uuid", "teamName": "General", "role": "team_lead" },
      { "teamId": "team-uuid-2", "teamName": "Engineering", "role": "member" }
    ],
    "defaultTeamId": "team-uuid",
    "defaultTeamName": "General"
  },
  "stats": { /* ... */ },
  "recentMeetings": [ /* ... */ ],
  "upcomingTasks": [ /* ... */ ]
}
```

## Important Notes

1. **Teams are optional for now**: The migration creates a default "General" team, but the system gracefully degrades if team info is missing.

2. **Team context is user-scoped**: Each user only sees teams they're members of.

3. **Non-blocking**: If team context fails to load, the profile API still succeeds (graceful degradation).

4. **Idempotent operations**: `ensureUserInDefaultTeam()` is safe to call repeatedly on every login.

5. **RLS policies**: Team data is protected by RLS - users can only see teams and members in their organization.

## Migration Notes

- Existing users are automatically added to the "General" team
- Existing meetings/tasks are backfilled with team_id pointing to General team
- No breaking changes to existing APIs or UI
- Team filtering is applied at the API level (not RLS level) for Phase 2 compatibility

## Next Steps

- Use team context in dashboard and task filtering
- Add team selector to meeting/task creation
- Update reports to show team breakdowns
- (Future phases) Finer-grained RLS-level team filtering
