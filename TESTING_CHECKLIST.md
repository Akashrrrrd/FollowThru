# FollowThru Testing Checklist

## Setup Requirements

### 1. Environment Variables
- [x] `.env.local` created with Supabase URL
- [x] `.env.local` has Supabase anon key
- [ ] `.env.local` has Groq API key (needed for AI extraction)

### 2. Database Setup
Run these migrations in your Supabase SQL Editor:
- [ ] Run `supabase/migrations/20260922113630_create_meetings_and_tasks.sql`
- [ ] Run `supabase/migrations/20260922115833_switch_to_auth_user_id.sql`

**Or use Supabase CLI:**
```bash
supabase db push
```

### 3. Dependencies
- [ ] Run `npm install`
- [ ] Dev server starts without errors: `npm run dev`

---

## Feature Testing

### Authentication Flow
- [ ] Navigate to http://localhost:3000
- [ ] Homepage loads properly
- [ ] Click "Try it now" button
- [ ] Should redirect to `/login`
- [ ] Click "Sign up" link
- [ ] Create account with email/password
- [ ] Should redirect to `/dashboard` after signup
- [ ] Navbar shows user email
- [ ] Logout button works
- [ ] Login again with same credentials

### New Meeting Creation
- [ ] Click "New Meeting" in navbar
- [ ] Enter meeting title (e.g., "Q4 Planning")
- [ ] Paste sample transcript:
  ```
  John: I'll send the Q4 report by Friday.
  Sarah: I'll schedule the design review for next Tuesday.
  Mike: I'll update the project tracker by Monday.
  ```
- [ ] Click "Process Meeting"
- [ ] Should show loading state
- [ ] Should redirect to meeting detail page
- [ ] Should display 3 extracted tasks with owners and due dates
- [ ] Each task should show source quote when expanded

### Dashboard Features
- [ ] Navigate to `/dashboard`
- [ ] Should show all tasks from all meetings
- [ ] Filter by status (Open/Done/Overdue)
- [ ] Filter by owner
- [ ] Sort by due date
- [ ] Mark task as done
- [ ] Task should update immediately (optimistic UI)
- [ ] Status badge should change to "Done"
- [ ] Reopen task - should work

### Task Management
- [ ] Click "Edit" on a task
- [ ] Modify description, owner, or due date
- [ ] Save changes
- [ ] Changes should persist
- [ ] Click "Draft reminder" on open task
- [ ] Should generate AI nudge message
- [ ] Click "Copy" - message should copy to clipboard

### Meetings List
- [ ] Navigate to `/meetings`
- [ ] Should show all meetings with completion stats
- [ ] Progress bar should reflect done/total tasks
- [ ] Click on a meeting
- [ ] Should navigate to meeting detail page
- [ ] Should show all tasks for that meeting
- [ ] Original transcript should be viewable (expand section)

### Meeting Detail Page
- [ ] View carried-over tasks from previous meetings
- [ ] Click "Add task manually"
- [ ] Add new task with description, owner, due date
- [ ] Task should appear in list
- [ ] View original transcript (expand collapsible)

### Insights Page
- [ ] Navigate to `/insights`
- [ ] Should show summary cards:
  - Total tasks
  - Completion rate percentage
  - Overdue tasks count
- [ ] Bar chart should display tasks per meeting
- [ ] "Tasks by owner" section should show:
  - Total tasks per owner
  - Done tasks count
  - Completion rate percentage

### Overdue Task Detection
- [ ] Create task with due date in the past
- [ ] Refresh any page
- [ ] Task status should auto-update to "Overdue"
- [ ] Task should appear in overdue filter on dashboard
- [ ] Overdue badge should be red

### Protected Routes
- [ ] Logout
- [ ] Try to access `/dashboard` directly
- [ ] Should redirect to `/login`
- [ ] Try to access `/meetings`
- [ ] Should redirect to `/login`
- [ ] Try to access `/insights`
- [ ] Should redirect to `/login`
- [ ] Homepage should still be accessible

---

## Error Handling

### Network Errors
- [ ] Disconnect internet
- [ ] Try to create meeting
- [ ] Should show error message
- [ ] Try to mark task done
- [ ] Should show error and revert change

### Invalid Data
- [ ] Try to create meeting with empty title
- [ ] Should show validation error
- [ ] Try to create meeting with empty transcript
- [ ] Should show validation error
- [ ] Try to save task with empty description
- [ ] Should show validation error

### AI Extraction Edge Cases
- [ ] Paste transcript with no commitments
- [ ] Should save meeting
- [ ] Should show "No commitments found" message
- [ ] Paste very long transcript
- [ ] Should still extract commitments
- [ ] Paste transcript with relative dates ("next Friday")
- [ ] Should calculate actual date

---

## UI/UX Quality

### Responsive Design
- [ ] Test on mobile viewport (375px)
- [ ] Test on tablet viewport (768px)
- [ ] Test on desktop viewport (1440px)
- [ ] All features should be usable on mobile

### Loading States
- [ ] All buttons show loading spinners when processing
- [ ] Page transitions show loading skeletons
- [ ] No blank screens during data fetching

### Visual Polish
- [ ] Task cards have proper spacing and borders
- [ ] Status badges use correct colors (green=done, red=overdue, gray=open)
- [ ] Icons are consistent throughout
- [ ] Navbar is sticky and always visible
- [ ] Hover states work on all interactive elements

---

## Common Issues & Fixes

### "Invalid supabaseUrl" error
- Check `.env.local` has correct URL format: `https://xxx.supabase.co`
- Restart dev server after changing `.env.local`

### "GROQ_API_KEY not configured" error
- Add Groq API key to `.env.local`
- Get key from: https://console.groq.com/keys

### Tasks not updating to overdue
- Check `updateOverdueTasks()` is being called in API routes
- Verify due_date is in correct format (YYYY-MM-DD)

### Authentication redirects not working
- Check ProtectedRoute component is wrapping protected pages
- Verify AuthProvider is in layout.tsx
- Check Supabase auth is properly configured

### Database errors
- Verify migrations have been run
- Check Supabase RLS policies are correct
- Verify user_id columns are uuid type (not text)

---

## Performance Checks

- [ ] Initial page load < 3 seconds
- [ ] Task list with 50+ tasks renders smoothly
- [ ] No console errors in browser
- [ ] No unnecessary re-renders (React DevTools)
- [ ] API responses < 1 second

---

## Security Checks

- [ ] No API keys visible in browser console
- [ ] No API keys in client-side code
- [ ] Can only see own meetings/tasks
- [ ] Cannot access other users' data via API
- [ ] RLS policies enforced on all operations

---

## Sign-off

- [ ] All critical features working
- [ ] No blocking bugs
- [ ] UI is polished and responsive
- [ ] Error handling is user-friendly
- [ ] Performance is acceptable
- [ ] Security requirements met

**Migration Complete!** ✅
