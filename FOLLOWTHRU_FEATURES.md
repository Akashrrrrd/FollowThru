# FollowThru - Turn Meeting Talk Into Tracked Action

## What is FollowThru?

FollowThru is an AI-powered commitment tracking platform that automatically extracts every commitment from meeting transcripts, assigns owners and deadlines, and tracks accountability across teams and over time. Never lose track of what was agreed in a meeting again.

---

## Core Features

### 1. **AI-Powered Extraction**
- Automatically analyzes meeting transcripts and extracts every commitment mentioned
- Identifies the owner of each commitment
- Determines deadlines based on natural language ("by Friday", "end of Q3", etc.)
- Captures exact quotes from the meeting for context and verification
- Rates confidence level (High/Medium/Low) for each extracted commitment
- Flags potential hallucinations to ensure accuracy

**Example:**
```
Transcript: "I'll send the revised pricing deck to Priya by Friday, 
once finance signs off."

Extracted:
- Description: Send revised pricing deck to Priya
- Owner: Maya
- Due: Friday
- Confidence: High
- Quote: "I'll send the revised pricing deck to Priya by Friday, once finance signs off."
```

### 2. **Smart Task Tracking**
- **Unified Dashboard** - View all commitments in one place across all meetings
- **Real-Time Status Updates** - Track task progress from open → in progress → blocked → completed
- **Drill-Down Capabilities** - Dig into specific meetings, teams, or people
- **Task Cards** - Rich interface showing task details, owner, due date, dependencies, and continuity
- **Filtering & Sorting** - Find tasks by owner, deadline, status, confidence level, or commitment type

**Dashboard Views:**
- Personal dashboard (your tasks)
- Team lead dashboard (team accountability)
- Manager dashboard (cross-team performance)
- Executive dashboard (organizational metrics)

### 3. **Intelligent Reminders & Nudges**
- **Automatic Reminders** - Get alerted as deadlines approach
- **Overdue Alerts** - Notifications for tasks past their due date
- **Smart Nudges** - Contextual messages based on task status and urgency
- **Customizable Notifications** - Control reminder frequency and channels
- **Email Integration** - Receive updates via email with actionable links

### 4. **Team Organization & Collaboration**
- **Multi-Team Support** - Organize your company into multiple teams
- **Role-Based Access** - Team member, team lead, manager, and owner roles
- **Team Invitations** - Invite members via email with customizable roles
- **Ownership Assignment** - Assign commitments to specific team members
- **Permission Management** - Control who can view, edit, and track tasks
- **General Team** - All users automatically added to a default team

### 5. **Advanced Analytics & Reporting**
- **Team Dashboards** - See performance by team, including:
  - Completion rates
  - Overdue task count
  - Team member accountability metrics
  - Trend analysis
- **Performance Metrics** - Track accountability metrics like:
  - Total commitments per person/team
  - Completion percentage
  - On-time delivery rate
  - Overdue task count
- **Accountability History** - See how commitments evolved across meetings
- **Executive Reports** - Organization-wide performance insights

### 6. **Meeting Integrations**
- **Zoom Integration** - Auto-capture Zoom meetings
- **Microsoft Teams Integration** - Capture Teams calls and meetings
- **Calendar Sync** - Connect your calendar for automatic meeting detection
- **Bidirectional Sync** - Keep commitments synchronized with calendar events
- **Transcript Upload** - Manually paste transcripts or upload files (TXT, VTT, SRT)

### 7. **Team Invitations & Member Management**
- **Email Invitations** - Send professional team invitations with custom messages
- **Invitation Links** - Secure links for accepting team membership
- **Role Assignment** - Assign roles during invitation (team_lead, member)
- **Member Directory** - View all team members and their roles
- **Permission-Based Access** - Different views for different roles

---

## Advanced Capabilities

### **Commitment Continuity Tracking**
- Track how commitments evolve and recur across multiple meetings
- Identify patterns in commitment types and owners
- Link related commitments together (dependencies, follow-ups)
- See full history of a commitment from creation through completion
- Detect when commitments become overdue across meetings
- Marks commitments as "Continued" if they appear in multiple meetings

**Example:**
```
Meeting 1: "I'll prepare the budget by end of month"
↓
Meeting 2: "I'll review the budget" (linked as continuation)
↓
Meeting 3: "Budget review is complete, let's implement it"
```

### **Hallucination Protection**
- AI verification ensures extracted commitments are grounded in actual meeting content
- Multiple confidence levels (High/Medium/Low) for each extraction
- Manual review system for low-confidence items
- Shows exact source quotes for verification
- Flags ambiguous or potentially false extractions
- Quality control before commitments are marked as final

### **Dependency Management**
- Track dependencies between commitments
- Identify blocking commitments that prevent progress
- Visual indicators for blocked/unblocked tasks
- See which tasks depend on other tasks completing first
- Prioritize based on dependency chains

### **Professional User Profiles**
- **Comprehensive Profile Setup** - 6-step onboarding with:
  - Account creation (name, email)
  - Personal information (display name, avatar)
  - Contact details (phone, secondary email)
  - Company information (company name)
  - Location and bio
  - Professional details
- **Public Profile Pages** - Share your professional profile with colleagues
- **Role Assignment** - Display job title and responsibilities
- **Organization Membership** - Show organizational affiliation

### **Owner Resolution**
- Automatically match meeting participant names to team members
- Link extracted owners to actual user accounts
- Handle name variations and nicknames
- Assign commitments to correct team members automatically
- Manual override for ambiguous cases

### **Team-Level Resolution**
- Assign commitments to specific teams based on context
- Identify which team needs to complete the task
- Show team-level task distribution and metrics
- Team lead accountability for team-wide commitments

### **Team Lead Identification**
- Automatically identify team leads in meetings
- Flag commitments made by leadership
- Show accountability chain from individual → team → organization
- Leader-level dashboards for team oversight

---

## User Experience Features

### **Responsive Design**
- Mobile-first responsive interface
- Works seamlessly on desktop, tablet, and mobile
- Touch-optimized controls
- Progressive web app capabilities

### **Real-Time Status Updates**
- Instant feedback when updating task status
- Live sync across all devices
- Real-time notification updates
- Optimistic UI updates for better UX

### **Data Validation & Error Handling**
- Input validation for all forms
- Friendly error messages
- Graceful degradation on connection loss
- Automatic retry on network failures
- Rate limiting (3 attempts per 60 seconds) to prevent abuse
- Exponential backoff on retries (100ms → 200ms → 400ms)

### **Loading States**
- Extraction progress indicators (4-step animation)
- Skeleton screens for data loading
- Loading spinners and progress bars
- Clear feedback on long operations

### **Accessibility**
- WCAG compliant component design
- Keyboard navigation support
- ARIA labels and roles
- Accessible color contrasts
- Screen reader friendly

---

## Authentication & Security

### **Sign Up & Onboarding**
- Email-based authentication
- 6-step professional profile collection during signup
- Rate-limited signup (max 3 attempts per 60 seconds)
- Professional profile validation
- Automatic team assignment to "General" team

### **Team Invitation Flow**
- Secure email invitations with unique links
- Accept invitation → auto-add to team
- Role assignment (team_lead, member)
- Permission-based access control

### **Organization & Team Authorization**
- Users belong to exactly one organization
- Users can belong to multiple teams within organization
- Role-based access control (owner, manager, member)
- Team-level permissions (view, edit, delete tasks)
- Row-level security (RLS) on database queries
- Only users in same organization can see each other's data

### **Database Security**
- Supabase PostgreSQL with RLS policies
- Secure token passing to authenticated endpoints
- No sensitive data in client-side storage
- Server-side session management

---

## Application Workflows

### **1. Demo Experience (No Sign In Required)**
**For Judges/Evaluators:**
1. Click "Try Demo" button on home page
2. Demo loads sample transcript automatically
3. Form fields populate (can be modified)
4. User clicks "Analyze Transcript"
5. Select participant role in meeting
6. Click "Extract Commitments"
7. Demo returns instant results (mock data)
8. View extracted commitments in demo results page
9. See "Sign In to Save" CTA to persist data

### **2. Main Application Flow (Authenticated)**

#### **Step 1: Upload Meeting**
- Paste transcript directly into text area
- Upload transcript file (TXT, VTT, SRT)
- Or integrate with calendar/meeting platform
- Provide meeting title for context

#### **Step 2: Extract Commitments**
- AI analyzes transcript
- Extracts all commitments mentioned
- Identifies owners, deadlines, quotes
- Runs hallucination detection
- Resolves owners to team members
- Assigns tasks to teams
- Links to previous commitments

#### **Step 3: Review & Organize**
- See extracted commitments as task cards
- Review owner assignments
- Verify extracted information
- Add or edit details as needed
- Assign to teams if needed

#### **Step 4: Track & Manage**
- View tasks on personal dashboard
- Update task status (open → in progress → blocked → completed)
- Get reminders for upcoming deadlines
- Receive alerts for overdue tasks
- See continuity with previous commitments

#### **Step 5: Team Accountability**
- Team leads view team dashboard
- Managers see cross-team metrics
- Executives see organization-wide analytics
- Track team performance over time

### **3. Commitment Lifecycle**

```
Created in Meeting
  ↓
AI Extracts from Transcript
  ↓
Hallucination Check
  ↓
Owner Resolution (match to user)
  ↓
Team Assignment
  ↓
Continuity Linking (check previous meetings)
  ↓
Inserted into Database
  ↓
Personal Dashboard (visible to owner)
  ↓
Status Updates (open → in progress → blocked → completed)
  ↓
Reminders & Nudges (as deadline approaches)
  ↓
Completion (task marked done)
  ↓
History Recorded (for continuity tracking)
```

---

## Key Use Cases

### **For Individuals**
- Never miss a commitment again
- Automatic action items from meetings
- Smart reminders keep you on track
- Clear view of what you committed to
- Historical record of commitments
- Status updates to keep team aware

### **For Team Leads**
- See all team member commitments at a glance
- Monitor team accountability and performance
- Identify blocked or overdue items
- Track team delivery on promises
- Hold team accountable for commitments
- Identify patterns and systemic issues

### **For Managers**
- Cross-team performance visibility
- Compare accountability across teams
- Drill down to see individual tasks
- Identify team performance trends
- Make data-driven team assignments
- Ensure organizational alignment

### **For Executives**
- Organization-wide accountability metrics
- See how well company follows through
- Identify teams and people with high delivery
- Spot systemic commitment tracking issues
- Make strategic decisions based on accountability
- Report to stakeholders on execution

---

## Technical Stack

### **Frontend**
- **Framework**: Next.js 14+ (React)
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui, Lucide icons
- **State Management**: React hooks, Context API
- **HTTP Client**: Custom fetch hooks with auth
- **Real-time**: Session-based updates

### **Backend**
- **Runtime**: Node.js (Next.js API routes)
- **Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth
- **AI**: Groq API for extraction
- **Email**: Email service integration

### **Infrastructure**
- **Hosting**: Vercel
- **Database**: Supabase PostgreSQL
- **CDN**: Vercel Edge Network
- **Analytics**: Vercel Speed Insights

---

## Data Model

### **Core Entities**
- **Users** - Authenticated user accounts
- **Organizations** - Company or workspace
- **Teams** - Groups within organization
- **Meetings** - Meeting records with transcripts
- **Tasks** - Extracted commitments
- **Task History** - Audit trail of task changes
- **Continuity Events** - Links between related tasks
- **Profiles** - Professional user information
- **Team Members** - Membership with roles
- **Team Invitations** - Pending team membership
- **Integrations** - Calendar/platform connections

### **Relationships**
- User → Organization (1:1)
- User → Teams (1:many, can be in multiple teams)
- Organization → Teams (1:many)
- Meeting → Tasks (1:many)
- Task → Task (many:many, via continuity events)
- User → Meetings (1:many, created_by)

---

## Database Structure

### **Users Table**
- ID, email, created_at
- Authentication via Supabase Auth

### **User Profiles Table**
- ID, user_id, full_name, display_name
- Job title, avatar URL, phone, email
- Company, bio, location
- Created/updated timestamps

### **Organizations Table**
- ID, name, owner_user_id
- Created/updated timestamps

### **Teams Table**
- ID, organization_id, name, description
- Created_by, created/updated timestamps

### **Team Members Table**
- ID, team_id, user_id, role
- Created/updated timestamps

### **Team Invitations Table**
- ID, team_id, email, role, token
- Accepted/created timestamps

### **Meetings Table**
- ID, user_id, title, transcript
- Created/updated timestamps

### **Tasks Table**
- ID, meeting_id, user_id, description
- Owner, owner_user_id, due_date
- Source quote, status
- Confidence, dependency, blocker
- Needs review, approved
- Created/updated timestamps
- Commitment type

### **Continuity Events Table**
- ID, parent_task_id, child_task_id
- Event type, confidence level
- Evidence (signals and scores)
- Source quotes and meeting info
- Created timestamp

---

## Performance Optimizations

### **Frontend**
- Code splitting by route
- Image optimization
- CSS minification
- JavaScript bundling
- Component lazy loading
- Efficient re-renders (React.memo)

### **Backend**
- Query optimization with indexes
- Connection pooling (Supabase)
- API response caching
- Rate limiting (3 attempts/60s)
- Exponential backoff on retries
- Batch operations where possible

### **Database**
- Strategic indexing on common queries
- Row-level security (RLS) optimization
- Pagination for large result sets
- Query result caching

---

## Analytics & Monitoring

### **What Gets Tracked**
- Meeting creation and extraction events
- Task status changes
- User engagement metrics
- Team performance metrics
- Extraction accuracy rates
- Continuity linking success rates
- Error rates and types
- Page load times (Vercel Speed Insights)

### **Available Reports**
- Personal task completion rate
- Team accountability metrics
- Organization-wide performance
- Commitment trend analysis
- Overdue task tracking
- Team member rankings
- Period-over-period comparisons

---

## Future Roadmap

### **Planned Features**
- Real-time meeting transcription (Zoom, Teams native)
- Calendar integration (Google Calendar, Outlook)
- Slack bot integration
- More sophisticated AI models
- Multi-language support
- Custom commitment types
- Advanced reporting and BI
- API for third-party integrations
- Mobile apps (iOS, Android)
- Voice command interface

### **Potential Integrations**
- Jira (task sync)
- Asana (project management)
- Monday.com (workflows)
- Notion (knowledge base)
- HubSpot (CRM)
- Salesforce (enterprise)
- ServiceNow (IT service management)

---

## Support & Contact

- **Email**: followthruai@gmail.com
- **Support**: In-app help and documentation
- **Feature Requests**: Submit via in-app feedback
- **Bugs**: Report via email or in-app support

---

## Privacy & Security

- **Data Encryption**: TLS/SSL for all data in transit
- **Database Security**: Supabase managed security with RLS
- **No Data Sharing**: Your data is never shared with third parties
- **Compliance**: GDPR compliant data handling
- **Data Retention**: Data retained per user account settings
- **Backup**: Automated daily backups

---

## Terms of Service

- Users must be 18+ to use FollowThru
- Organizations own their commitment data
- Individual contributors own personal profile data
- FollowThru reserves right to suspend accounts for abuse
- Refunds follow standard SaaS policies
- Service level agreement available on request

---

## Getting Started

### **For New Users**
1. Visit FollowThru website
2. Click "Get Started" or "Sign Up"
3. Enter email and create password
4. Complete professional profile (6 steps)
5. Get added to default "General" team
6. Start extracting commitments

### **For Teams**
1. Create organization account
2. Invite team members via email
3. Assign roles (team_lead, member)
4. Set up team-level views
5. Start tracking team commitments
6. View team dashboards

### **Try Demo First**
1. Click "Try Demo" on home page
2. No sign in required
3. Load demo transcript
4. See instant extraction
5. Explore commitment cards
6. Click "Sign In to Save" when ready

---

## Why FollowThru?

**The Problem**: Commitments made in meetings get lost. Follow-ups are missed. Accountability fades.

**The Solution**: FollowThru automatically captures every commitment, assigns owners, tracks progress, and keeps accountability visible across your team.

**Key Benefits**:
- ✅ Never lose track of a commitment again
- ✅ Automated extraction saves hours of manual work
- ✅ Clear ownership and accountability
- ✅ Team-wide visibility of commitments
- ✅ Smart reminders keep everyone on track
- ✅ Historical tracking shows commitment patterns
- ✅ Executive insights into organizational accountability
- ✅ Reduces meetings about meetings

---

## About FollowThru

FollowThru is built by a team passionate about accountability and execution. We believe that great organizations follow through on commitments. FollowThru makes that easy.

**Mission**: Help teams and individuals follow through on what they commit to.

**Vision**: Make accountability visible, simple, and automatic for every team.

**Values**:
- Accuracy (no hallucinated commitments)
- Transparency (clear ownership)
- Simplicity (easy to use)
- Accountability (visible to all stakeholders)
