# Generic Commitment Extraction System

## Overview

The FollowThru commitment extraction system has been redesigned to work **generically** for any meeting transcript, on any date, with any participants, in any context.

---

## ✅ Key Improvements

### 1. **No Hardcoded Values**
- ❌ No hardcoded names (Maya, Sarah, David, Arjun, etc.)
- ❌ No hardcoded dates (Sep 29, Oct 5, Oct 13, etc.)
- ❌ No hardcoded weekdays (Tuesday → Wednesday mapping)
- ❌ No hardcoded phrases or sentences
- ✅ ALL logic is dynamic and calculated from meeting date

### 2. **Dynamic Date Calculations**
The system calculates dates relative to the **meeting date**, not the current system date.

For ANY meeting date and weekday:
- Plain weekdays → next occurrence after meeting
- "next <weekday>" → occurrence in following calendar week
- "in N days/weeks" → calculated duration from meeting date
- Dependencies → null unless explicit deadline exists

### 3. **Precise Commitment Detection**
The system distinguishes between:
- ✅ **Commitments** (person accepts responsibility)
- ❌ **Requests** (person asks someone else)
- ❌ **Questions** (no commitment made)
- ❌ **Suggestions** (no firm commitment)
- ❌ **Discussions** (general observations)

### 4. **Correct Owner Attribution**
- Extracts who actually COMMITS, not who REQUESTS
- Handles request + acceptance correctly (ONE task, owned by person who accepts)
- Recognizes "Let's..." and "We'll..." with speaker as owner
- Uses "Unassigned" only when truly unclear

---

## 📋 Comprehensive Rules

### Commitment Indicators
```
✅ Extract these:
- "I'll do X"
- "I will handle X"
- "Sure, I'll do X"
- "Let me do X"
- "Let's do X" (speaker owns)
- "We'll do X" (speaker owns)
- "I can do X" (when accepting, not just capability)

❌ Do NOT extract these:
- "John, please do X" (request, not commitment)
- "Can someone do X?" (question)
- "Maybe we should do X" (suggestion)
- "We need better X" (discussion)
- "Someone should do X" (no owner)
```

### Date Calculation Logic

**Meeting on ANY weekday → dynamic calculation:**

For meeting on Tuesday:
- "Wednesday" → +1 day
- "Friday" → +3 days
- "next Monday" → +6 days (following week)

For meeting on Friday:
- "Monday" → +3 days
- "Wednesday" → +5 days
- "next Monday" → +10 days (following week)

For meeting on Saturday:
- "Monday" → +2 days
- "Friday" → +6 days
- "next Monday" → +9 days (following week)

**The system calculates these dynamically for ANY meeting date.**

### Relative Duration Parsing
```
"in 2 days" → meeting date + 2 days
"in 1 week" → meeting date + 7 days
"in 2 weeks" → meeting date + 14 days
"in 3 weeks" → meeting date + 21 days
"in a couple of days" → meeting date + 2 days
"within 5 days" → meeting date + 5 days
```

### Dependency Handling
```
"Once X is done, I'll do Y" → due_date = null
"After approval, I'll send it" → due_date = null
"When ready, I'll publish" → due_date = null

BUT:
"I'll send it after approval by Friday" → due_date = Friday
(explicit deadline overrides dependency)
```

### Request + Acceptance
```
Scenario:
Maya: "Sarah, can you check with the team by Friday?"
Sarah: "Sure, I'll contact them tomorrow."

Result: ONE task
owner: Sarah (she committed)
description: Contact the team
due_date: tomorrow
source_quote: "Sure, I'll contact them tomorrow."

NOT two tasks.
```

---

## 🧪 Test Coverage

The system must work correctly for:

### Different Meeting Days
- Monday meetings
- Tuesday meetings
- Wednesday meetings
- Thursday meetings
- Friday meetings
- Saturday meetings
- Sunday meetings

### Different Date References
- Plain weekdays ("Wednesday", "Friday")
- "next <weekday>" phrases
- "tomorrow", "day after tomorrow"
- "in N days", "in N weeks"
- "by the end of the week"
- "early next week"

### Different Commitment Patterns
- "I'll..." statements
- "Let's..." statements
- Request → acceptance sequences
- Multiple commitments in one sentence
- Dependency-based commitments
- Commitments without dates

### Different Scenarios
- Requests without acceptance (no task)
- Questions (no task)
- Suggestions (no task)
- General discussions (no task)
- Duplicate prevention
- Ambiguous ownership

---

## 🎯 Validation Checklist

Before extracting any commitment, the system validates:

1. ✅ Is there a genuine action being committed to?
2. ✅ Did someone clearly accept responsibility?
3. ✅ Who specifically committed (not who requested)?
4. ✅ Is this a commitment or just a request/question/suggestion?
5. ✅ Is this already covered by another extracted task?
6. ✅ Can the due date be calculated from the meeting date?
7. ✅ If dependency-based without explicit date, is due_date = null?
8. ✅ Is the source_quote exact and unmodified?

**Principle: Precision over Recall**
Better to omit a questionable item than create a false action item.

---

## 📝 Output Format

Every extracted commitment returns:

```json
{
  "owner": "Name of person who committed",
  "description": "Clear action (no filler: 'Sure', 'Okay', 'I'll')",
  "due_date": "YYYY-MM-DD or null",
  "source_quote": "Exact sentence where commitment was made"
}
```

If no genuine commitments exist: `[]`

---

## 🔍 Example Scenarios

### Scenario 1: Request + Acceptance (Monday meeting)
```
Meeting: Monday, Jan 5, 2026
Transcript:
Manager: "Can you prepare the report by Wednesday?"
Employee: "Sure, I'll have it ready by Wednesday."

Output:
[{
  "owner": "Employee",
  "description": "Prepare the report",
  "due_date": "2026-01-07",  // Wednesday (2 days later)
  "source_quote": "Sure, I'll have it ready by Wednesday."
}]
```

### Scenario 2: Let's Commitment (Friday meeting)
```
Meeting: Friday, Mar 20, 2026
Transcript:
Team Lead: "Let's review the designs next Monday."

Output:
[{
  "owner": "Team Lead",
  "description": "Review the designs",
  "due_date": "2026-03-23",  // Next Monday (3 days later)
  "source_quote": "Let's review the designs next Monday."
}]
```

### Scenario 3: Relative Duration (Thursday meeting)
```
Meeting: Thursday, Jul 10, 2026
Transcript:
Developer: "I'll deploy the changes in two weeks."

Output:
[{
  "owner": "Developer",
  "description": "Deploy the changes",
  "due_date": "2026-07-24",  // 14 days later
  "source_quote": "I'll deploy the changes in two weeks."
}]
```

### Scenario 4: Dependency Without Date (Wednesday meeting)
```
Meeting: Wednesday, Nov 4, 2026
Transcript:
Designer: "Once the client approves, I'll finalize the mockups."

Output:
[{
  "owner": "Designer",
  "description": "Finalize the mockups",
  "due_date": null,  // No fixed date
  "source_quote": "Once the client approves, I'll finalize the mockups."
}]
```

### Scenario 5: No Commitment (any meeting)
```
Transcript:
Manager: "Can someone check the server status?"
Developer: "Maybe we should upgrade the infrastructure."
Designer: "The client hasn't responded yet."

Output: []
// No genuine commitments extracted
```

---

## 🚫 What Was NOT Changed

- ✅ UI/design unchanged
- ✅ Database schema unchanged
- ✅ API routes unchanged (except passing meeting date parameter)
- ✅ Task cards unchanged
- ✅ Nudge generation unchanged
- ✅ All other features preserved

---

## 🔧 Implementation Details

### Modified Function Signatures

```typescript
// Now accepts optional meeting date
buildSystemPrompt(meetingDate?: Date): string

// Now accepts optional meeting date
callGroqForExtraction(
  transcript: string, 
  meetingDate?: Date
): Promise<ExtractedCommitment[]>

// Now accepts optional meeting date
parseCommitments(
  text: string, 
  meetingDate?: Date
): ExtractedCommitment[]
```

### Meeting Date Flow

1. User submits transcript → creates meeting record
2. Meeting record has `created_at` timestamp
3. Extract route passes `new Date(meeting.created_at)` to extraction
4. Extraction uses this date for ALL relative calculations
5. AI prompt receives meeting date and weekday
6. AI calculates all dates from this reference point

---

## ✅ Result

The FollowThru extraction system now works **generically** for:
- Any meeting date
- Any weekday
- Any participants
- Any commitment patterns
- Any relative date phrases

No hardcoded logic. No special cases. Pure dynamic extraction.

**The same logic handles ALL meetings.**
