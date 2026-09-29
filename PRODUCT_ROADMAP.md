# FollowThru: AI Commitment Accountability System
## Product Evolution Roadmap

---

## 🎯 Product Vision

**From:** Generic AI meeting action-item extractor  
**To:** Focused AI Commitment Accountability System

**Core Question:**  
*"What did each person actually commit to, what evidence proves it, when is it due, what is blocking it, and did they follow through?"*

---

## ✅ Phase 1: Foundation (COMPLETE)

### Implemented:
- ✅ Enhanced commitment data model with lifecycle states
- ✅ AI confidence detection (high/medium/low)
- ✅ Automatic dependency extraction
- ✅ Commitment type classification (explicit/collective/acceptance)
- ✅ Review workflow (low-confidence items flagged)
- ✅ Audit trail (commitment_history table)
- ✅ Backward compatibility maintained

### Database:
- ✅ Extended `tasks` table with 9 new accountability fields
- ✅ Created `commitment_history` table
- ✅ Auto-update triggers and overdue detection

### API/Extraction:
- ✅ Enhanced Groq prompt with confidence rules
- ✅ Dependency phrase detection
- ✅ History entry creation on extract

---

## 🚧 Phase 2: Core Accountability Features (NEXT)

### UI Components to Build:

**1. AI Commitment Review Screen**
- Post-extraction review interface
- Show all extracted commitments with confidence badges
- [Approve] / [Edit] / [Reject] buttons per commitment
- "Approve all high-confidence" bulk action
- Display source evidence inline

**2. Needs Attention Dashboard Section**
```
┌─────────────────────────────────┐
│ NEEDS ATTENTION                  │
├─────────────────────────────────┤
│ Due Today        [2 items]       │
│ Due Soon         [4 items]       │
│ Overdue          [1 item]        │
│ Blocked          [3 items]       │
│ Needs Review     [2 items]       │
└─────────────────────────────────┘
```

**3. Blocker Management**
- Add/edit blocker field on task cards
- Visual blocker indicator
- Filter by blocked commitments

**4. Source Evidence Display**
- Enhanced "View source" modal
- Show request vs commitment distinction
- Display meeting context
- Highlight commitment type badge

**5. Status Lifecycle UI**
- Dropdown: Open → In Progress → Blocked → Completed
- Color-coded status badges
- Status change triggers history entry

### API Endpoints to Create:
- `PATCH /api/tasks/[id]/approve` - Approve low-confidence commitment
- `PATCH /api/tasks/[id]/block` - Add blocker
- `PATCH /api/tasks/[id]/unblock` - Remove blocker
- `GET /api/commitments/needs-attention` - Get attention-worthy items
- `GET /api/tasks/[id]/history` - Get commitment history

---

## 📊 Phase 3: Cross-Meeting Intelligence

### Features:

**1. Commitment Timeline (per person)**
```
Sarah's Commitment Timeline
─────────────────────────────
Sep 22  Send client proposal         ✓ Completed
Sep 25  Update project tracker       ✓ Completed
Sep 29  Review campaign analytics    ● Open
Oct 2   Send final assets            ⚠ Due soon
```

**2. Commitment Update Detection**
```
Meeting 1: "I'll send the report by Friday."
Meeting 2: "I'll actually send the report next Monday."

Detection:
┌─────────────────────────────────────┐
│ COMMITMENT UPDATED                   │
├─────────────────────────────────────┤
│ Previous: Due Sep 30                 │
│ New:      Due Oct 5                  │
│ Reason: "I'll actually send..."      │
└─────────────────────────────────────┘
```

**3. Meeting-to-Meeting Linking**
- Detect when later meetings reference earlier commitments
- Show "Related Commitments" section
- Track commitment lifecycle across meetings

**4. Commitment History View**
- Full timeline of all changes to a commitment
- Status changes, date changes, blockers added/removed
- Who made each change and when

### Technical:
- Semantic similarity detection for related commitments
- Fuzzy matching on owner + description
- History aggregation queries

---

## 👥 Phase 4: Person & Accountability Views

### Features:

**1. Person-Focused View**
```
┌─────────────────────────────────────┐
│ SARAH                                │
├─────────────────────────────────────┤
│ Open commitments      3              │
│ Due this week         2              │
│ Blocked               1              │
│ Completed            12              │
│                                      │
│ Recent Commitments:                  │
│ • Send campaign assets — Sep 30      │
│ • Contact design team — Sep 30       │
│ • Upload final versions — awaiting   │
└─────────────────────────────────────┘
```

**2. Follow-Through Tracking**
```
FOLLOW-THROUGH: Sarah
─────────────────────
12 commitments
 9 completed
 2 open
 1 overdue

Completion rate: 75%
```

**3. Accountability Dashboard Redesign**
- Replace generic dashboard with commitment-focused layout
- Top cards: Open / Due Today / Overdue / Blocked / Completed
- "Needs Attention" prominent section
- Recent commitments stream
- Quick filters by owner/status/confidence

**4. Meeting Accountability Summary**
```
MEETING: Marketing Campaign Launch
─────────────────────────────────
Commitments:        6
High confidence:    5
Needs review:       1
Due this week:      4
Dependencies:       2
New commitments:    6
Updated:            0
```

---

## 📈 Phase 5: Advanced Features

### Features:

**1. Dependency Graph Visualization**
```
    [Finance approval]
           ↓
    [Final pricing]
           ↓
   [Campaign assets]
           ↓
   [Website launch]
```
- Interactive dependency tree
- Node shows owner, status, due date
- Visual flow of blocked → unblocked

**2. Smart Reminder Generation**
```
Instead of:
"Reminder: Send the report."

Generate:
"Reminder: You committed to sending the client 
report by Friday. The latest meeting mentioned 
that finance numbers were required before 
completion."
```

**3. Advanced Insights**
- Commitments over time (chart)
- Completion rate trends
- Average time to completion
- Blocked commitment analysis
- Rescheduled commitment tracking
- Owner performance (factual, not judgmental)

**4. Commitment Search & Filtering**
- Full-text search across commitments
- Filter by: owner, status, confidence, meeting, date range
- Saved filters
- Export capabilities

---

## 🎨 Design Principles

### Visual Identity:
- **NOT:** Another generic project management tool
- **YES:** Focused commitment accountability system
- **Flow:** MEETINGS → COMMITMENTS → FOLLOW-THROUGH

### Color Coding:
- **High confidence:** Green
- **Medium confidence:** Blue
- **Low confidence:** Yellow (needs review)
- **Blocked:** Red
- **Completed:** Gray/checkmark
- **Overdue:** Red warning

### Language:
- Use "commitment" not "task"
- Use "owner" not "assignee"
- Use "follow-through" not "completion"
- Use "blocker" not "issue"
- Use "source evidence" not "notes"

---

## 🚀 Deployment Strategy

### Phase 1: ✅ COMPLETE
- Migration ready
- Backend foundation solid
- Extraction enhanced
- Ready to deploy

### Phase 2: Estimated 2-3 days
- AI review screen
- Needs attention section
- Blocker management
- Status lifecycle UI

### Phase 3: Estimated 3-4 days
- Timeline views
- Update detection
- Cross-meeting linking
- History displays

### Phase 4: Estimated 4-5 days
- Dashboard redesign
- Person views
- Follow-through tracking
- Accountability summaries

### Phase 5: Estimated 5-7 days
- Dependency graphs
- Smart reminders
- Advanced insights
- Search & filtering

---

## ✅ Success Metrics

### Product Metrics:
- Commitments tracked per user
- Approval rate (high vs low confidence)
- Follow-through rate (completed / total)
- Average time to completion
- Blocker frequency
- Cross-meeting connections made

### User Value:
- "I can see exactly who committed to what"
- "I have evidence for every commitment"
- "I know what's blocking progress"
- "I can track follow-through across meetings"
- "Commitments don't get lost between meetings"

---

## 🎯 Competitive Differentiation

### vs Generic Meeting Notes:
- ✅ Extracts actual commitments, not just notes
- ✅ Tracks accountability, not just summaries
- ✅ Evidence-based with source quotes

### vs Project Management:
- ✅ Focuses on commitments made in meetings
- ✅ Automatic extraction, no manual entry
- ✅ Cross-meeting intelligence
- ✅ Built-in confidence and review workflow

### vs Action Item Trackers:
- ✅ Distinguishes commitments from requests
- ✅ Tracks dependencies and blockers
- ✅ Shows follow-through trends
- ✅ Connects commitments across time

---

**Product Positioning:**

> **FollowThru: AI Commitment Accountability System**
> 
> Turn meeting promises into accountable follow-through.
> 
> ✓ Capture every real commitment  
> ✓ Assign the right owner  
> ✓ Track deadlines and blockers  
> ✓ Keep commitments connected across meetings  
> ✓ See whether commitments were followed through  

---

**Current Status:** Phase 1 Complete ✅  
**Next Steps:** Deploy migration → Build Phase 2 UI → Test → Iterate
