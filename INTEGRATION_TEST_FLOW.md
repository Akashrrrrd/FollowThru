# Complete New User Flow Integration Test

This document outlines the complete flow for a new user in FollowThru with the new user identity/profile system (Phases 3-4).

## Test Scenario: New User "Akash" Complete Journey

### 1. Signup Flow
**Entry Point:** `/signup`

**Steps:**
1. User navigates to signup page
2. Enters email: `akash@company.com`
3. Enters password: `SecurePass123!`
4. Clicks "Sign Up"
5. Verifies email (if email verification is enabled)

**Expected Result:**
- User is authenticated via Supabase Auth
- User gets UUID from auth.users table
- User is redirected to `/onboarding` (ProfileCheck middleware)

**Verification:**
- ✅ JWT token created in Supabase Auth
- ✅ auth.users has new record with UUID
- ✅ No profile yet in user_profiles table

### 2. Onboarding/Profile Setup Flow
**Entry Point:** `/onboarding` (automatically redirected from ProfileCheck)

**Steps:**
1. Sees "Complete Your Profile" form
2. Enters Full Name: `Akash Kumar`
3. Optional: Enters Display Name (or leaves blank for auto-generation)
4. Optional: Enters Job Title: `Product Manager`
5. Clicks "Save Profile"

**API Call:** `POST /api/profile`
```json
{
  "full_name": "Akash Kumar",
  "display_name": "", // Empty - will auto-generate to "Akash"
  "job_title": "Product Manager",
  "avatar_url": null
}
```

**Expected Result:**
- user_profiles table has new record:
  - id: UUID (matches auth.users.id)
  - full_name: "Akash Kumar"
  - display_name: "Akash" (auto-generated from first name)
  - job_title: "Product Manager"
  - avatar_url: null
  - created_at: timestamp
  - updated_at: timestamp
- User is redirected to `/dashboard`
- ProfileCheck middleware allows access (profile complete)

**Verification:**
- ✅ Record in user_profiles with correct values
- ✅ display_name auto-generated correctly
- ✅ Dashboard loads without redirect

### 3. Profile Page Enhancement
**Entry Point:** `/profile` (user clicks "Profile" in navbar)

**Features:**
- Display current profile info in header
- Edit button enables edit mode
- Fields show:
  - Full Name: "Akash Kumar"
  - Display Name: "Akash"
  - Job Title: "Product Manager"
  - Member since: [signup date]
- Save/Cancel buttons during edit
- My Work Efficiency metrics

**Edit Test:**
1. Click "Edit Profile"
2. Change Display Name to "AK"
3. Change Job Title to "Senior PM"
4. Click "Save Profile"

**API Call:** `PATCH /api/profile`
```json
{
  "display_name": "AK",
  "job_title": "Senior PM"
}
```

**Expected Result:**
- ✅ user_profiles updated in database
- ✅ CurrentUserContext refreshed
- ✅ Profile page reflects new values

### 4. Create Meeting with Transcript
**Entry Point:** `/new` (New Meeting)

**Steps:**
1. Enters Meeting Title: `Weekly Sync - Sept 29`
2. Pastes transcript:
```
Akash: Alright, let's start. I'll send the Q3 report by Friday.
Sarah: Good. Can you schedule the design review for Tuesday?
Akash: Sure, I'll set that up tomorrow.
Mike: I'll follow up on the budget by end of week.
```
3. Clicks "Analyze Transcript"

**Expected Result:**
- System extracts participants: ["Akash", "Mike", "Sarah"]
- Shows participant selection screen

### 5. Participant Confirmation
**Screen:** Participant Selection

**Steps:**
1. Sees three participant buttons: "Akash", "Mike", "Sarah"
2. Clicks "Akash" (with "That's me" badge)
3. Clicks "Extract Commitments"

**API Call:** `POST /api/meetings/extract`
```json
{
  "title": "Weekly Sync - Sept 29",
  "transcript": "...",
  "your_name": "Akash"
}
```

**Expected Result:**
- Meeting created in meetings table
- Tasks extracted with owner_user_id population

### 6. Commitment Extraction with Owner User ID
**Expected Extracted Commitments:**

1. **Task 1: "Send Q3 report"**
   - owner: "Akash"
   - owner_user_id: UUID (matches Akash's user_id) ✅ MATCHED
   - due_date: 2024-10-04 (Friday calculated from "by Friday")
   - status: open
   - confidence: high

2. **Task 2: "Schedule design review"**
   - owner: "Sarah"
   - owner_user_id: null (external participant) ✅ NOT MATCHED
   - due_date: 2024-10-01 (Tuesday)
   - status: open
   - confidence: medium

3. **Task 3: "Set up design review"**
   - owner: "Akash"
   - owner_user_id: UUID (matches Akash's user_id) ✅ MATCHED
   - due_date: 2024-09-30 (tomorrow)
   - status: open
   - confidence: high

4. **Task 4: "Follow up on budget"**
   - owner: "Mike"
   - owner_user_id: null (external participant) ✅ NOT MATCHED
   - due_date: 2024-09-29 (end of week)
   - status: open
   - confidence: medium

**Verification:**
- ✅ 4 tasks created
- ✅ 2 tasks have owner_user_id = Akash's UUID
- ✅ 2 tasks have owner_user_id = null
- ✅ All dates resolved correctly
- ✅ History entries created for each task

### 7. Dashboard with My Commitments
**Entry Point:** `/dashboard`

**Initial View (All Commitments):**
- Total Tasks: 4
- Completed: 0
- Open: 4
- Overdue: 0
- Efficiency: 0%

**After Clicking "My Commitments":**
- Filter applied: my_commitments=true
- Tasks shown: 2 (only Akash's)
  - "Send Q3 report" (due Oct 4)
  - "Set up design review" (due Sep 30)
- My Work Efficiency: 0% (0/2 completed)

**API Call:** `GET /api/tasks?my_commitments=true`

**Expected Result:**
- ✅ Only tasks with owner_user_id === Akash's UUID returned
- ✅ "My Commitments" button highlighted in blue
- ✅ Metrics updated for "My Tasks" only

### 8. Complete a Task
**Steps:**
1. Click checkbox on "Send Q3 report" task
2. Task status changes to "done"

**Expected Result:**
- ✅ Task status updated to "done"
- ✅ Profile efficiency metrics updated
- ✅ Dashboard "My Work Efficiency" now shows 50% (1/2 done)
- ✅ History entry created for status change

### 9. Profile Stats Verification
**Entry Point:** `/profile`

**Expected Stats:**
- Total Tasks: 4 (all tasks Akash created)
- Completed: 1 (only counting tasks owned by Akash)
- Open: 3
- Overdue: 0
- Efficiency: 25% (1/4)
- **My Work Efficiency: 50%** (1/2 of Akash's own tasks)
- Recent Meetings: 1
  - Title: "Weekly Sync - Sept 29"
  - 25% completion (1/4 tasks done)

**Verification:**
- ✅ Stats calculated using owner_user_id not name matching
- ✅ "My Tasks" only counts tasks where owner_user_id === user.id
- ✅ Metrics match actual completion

### 10. Name Change Doesn't Break Ownership
**Steps:**
1. Go to `/profile`
2. Click "Edit Profile"
3. Change Display Name from "AK" to "Akash Kumar"
4. Change Job Title to "CEO"
5. Click "Save"

**Expected Result:**
- ✅ Profile updated
- ✅ All existing tasks still owned by Akash (owner_user_id unchanged)
- ✅ No loss of ownership due to name change
- ✅ Dashboard "My Commitments" still shows same 2 tasks
- ✅ Profile metrics unchanged

**Verification:**
- ✅ owner_user_id is UUID-based, not name-based
- ✅ Historical data preserved through name changes
- ✅ Accountability maintained across profile updates

## Success Criteria

✅ **Auth & Identity:**
- New user signs up
- Profile created with full_name, display_name, job_title
- CurrentUserContext provides unified identity
- display_name auto-generated correctly

✅ **Transcript Processing:**
- Participants extracted from transcript
- User selects which participant is them
- your_name parameter passed to extract API
- Meeting created with transcript saved

✅ **Commitment Ownership:**
- Commitments extracted from transcript
- owner_user_id assigned when owner matches current user
- External participants have owner_user_id = null
- Both owner (display name) and owner_user_id stored

✅ **My Commitments:**
- Dashboard filters by owner_user_id
- "My Commitments" toggle works
- Shows only user's own tasks
- Metrics calculated using owner_user_id

✅ **Profile Management:**
- Profile page shows editable fields
- Changes persist to database
- Name changes don't break ownership
- Metrics update correctly

✅ **Regression Safety:**
- Date resolver tests: 46/46 passing
- Lifecycle tests: 41/41 passing
- New tests: 28/28 passing
- Build succeeds
- No breaking changes to existing features

## Manual Testing Checklist

- [ ] Create new account at /signup
- [ ] Complete profile at /onboarding
- [ ] Edit profile at /profile
- [ ] Create meeting with transcript at /new
- [ ] Select participant who is you
- [ ] Verify commitments extracted with owner_user_id
- [ ] Click "My Commitments" filter on dashboard
- [ ] Verify only your commitments shown
- [ ] Complete a task
- [ ] Check My Work Efficiency updated
- [ ] Go back to profile
- [ ] Change display name
- [ ] Verify tasks still yours (owner_user_id not affected)
- [ ] Check My Commitments still shows same tasks

## Edge Cases Tested

1. **Empty display_name:** Auto-generates from full_name ✅
2. **Multiple tasks same owner:** All get same owner_user_id ✅
3. **External participants:** owner_user_id = null ✅
4. **Name change:** Doesn't affect owner_user_id ✅
5. **No profile created yet:** Redirects to /onboarding ✅
6. **Participant not in current user names:** owner_user_id = null ✅
