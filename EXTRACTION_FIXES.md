# Commitment Extraction Logic Fixes

## Summary of Changes

All fixes implemented in `lib/groq.ts` to improve AI-based commitment extraction from meeting transcripts.

---

## ✅ Fixed Issues

### 1. Owner Attribution
**Problem:** Tasks were incorrectly assigned to the person who requested them, not who committed to them.

**Example:**
- David: "Arjun, please create a backup."
- Arjun: "Sure, I'll create the backup."
- ❌ Old: Owner = David
- ✅ New: Owner = Arjun

**Fix:** Enhanced AI prompt with clear owner attribution rules and examples showing the difference between requesting and committing.

---

### 2. Relative Date Calculations
**Problem:** Incorrect calculation of relative dates like "Wednesday", "Friday", "next Monday".

**Examples (meeting on Tuesday, Sep 29, 2026):**
- "by Wednesday" → ✅ Sep 30 (was: Oct 4)
- "by Friday" → ✅ Oct 2 (was: Sep 30)
- "next Monday" → ✅ Oct 5 (was: Oct 6)
- "next Tuesday" → ✅ Oct 6

**Fix:** Added comprehensive date calculation rules with distinction between:
- Plain weekday (same/next week): "Wednesday", "Friday"
- "next <weekday>" (following week): "next Monday", "next Tuesday"

---

### 3. Meeting Date Reference
**Problem:** Used current date instead of meeting date for calculations.

**Fix:** 
- Updated `callGroqForExtraction()` to accept `meetingDate` parameter
- Updated `buildSystemPrompt()` to use meeting date
- Updated extraction route to pass meeting date from created meeting record

---

### 4. Dependency-Based Tasks
**Problem:** Would sometimes invent dates for tasks with dependencies.

**Example:**
- "Once the backup is verified, I'll document it."
- ✅ Due date: null (no fixed date)

**Fix:** Added explicit rule to use `null` for dependency phrases like "once X", "after Y".

---

### 5. "Let's..." / "We'll..." Commitments
**Problem:** Tasks with "Let's..." or "We'll..." were not being extracted.

**Example:**
- Maya: "Let's review the campaign status in two weeks."
- ❌ Old: Task not extracted
- ✅ New: Owner = Maya, Due = Oct 13

**Fix:** Added "Let's...", "We'll...", "We need to..." to commitment phrase patterns with speaker as owner.

---

### 6. Relative Duration Phrases
**Problem:** "in two weeks", "in three days" were not being parsed.

**Examples (meeting on Sep 29, 2026):**
- "in two days" → Oct 1
- "in three days" → Oct 2
- "in one week" → Oct 6
- "in two weeks" → Oct 13

**Fix:** Added relative duration calculation rules with examples.

---

## 📋 Complete Test Cases

For meeting on **Tuesday, September 29, 2026**:

| Phrase | Expected Date | Days from Meeting |
|--------|---------------|-------------------|
| tomorrow | Sep 30, 2026 | +1 |
| Wednesday | Sep 30, 2026 | +1 |
| by Wednesday | Sep 30, 2026 | +1 |
| Friday | Oct 2, 2026 | +3 |
| by Friday | Oct 2, 2026 | +3 |
| next Monday | Oct 5, 2026 | +6 |
| next Tuesday | Oct 6, 2026 | +7 |
| in two days | Oct 1, 2026 | +2 |
| in three days | Oct 2, 2026 | +3 |
| in one week | Oct 6, 2026 | +7 |
| in two weeks | Oct 13, 2026 | +14 |
| once X is done | null | (dependency) |

---

## 🔧 Implementation Details

### Modified Functions

1. **`buildSystemPrompt(meetingDate?: Date)`**
   - Now accepts optional meeting date parameter
   - Uses meeting date for all date calculations in prompt
   - Falls back to current date if not provided

2. **`callGroqForExtraction(transcript: string, meetingDate?: Date)`**
   - Now accepts optional meeting date parameter
   - Passes meeting date to prompt builder
   - Passes meeting date to parser for validation

3. **`parseCommitments(text: string, meetingDate?: Date)`**
   - Now accepts optional meeting date parameter
   - Uses meeting date for validation warnings
   - Falls back to current date if not provided

### Enhanced AI Prompt

The system prompt now includes:
- ✅ Clear owner attribution rules with examples
- ✅ Comprehensive commitment phrase patterns
- ✅ Detailed date calculation rules
- ✅ Plain weekday vs "next <weekday>" distinction
- ✅ Relative duration phrase support
- ✅ Dependency-based task handling
- ✅ Concrete calculation examples for reference date

---

## 🧪 Testing

Use the test transcript in `test-transcript.txt` which includes:
1. Various owner attribution scenarios
2. All relative date patterns
3. Dependency-based task
4. "Let's..." style commitment
5. Relative duration phrase

Expected: 7 tasks extracted with correct owners and dates.

---

## ✅ Verification Checklist

After implementing these fixes, verify:
- [ ] Owner is correctly attributed to person who commits (not requester)
- [ ] "tomorrow" resolves correctly
- [ ] Plain weekdays ("Wednesday", "Friday") resolve to next occurrence
- [ ] "next <weekday>" resolves to following week
- [ ] "in X days/weeks" resolves to correct duration
- [ ] "Let's..." extracts with speaker as owner
- [ ] Dependency-based tasks have null date
- [ ] Meeting date is used for all calculations (not current date)
- [ ] Existing extraction still works for explicit "I'll" commitments

---

## 🚫 What Was NOT Changed

- UI/design remains unchanged
- Database schema unchanged
- API routes unchanged (except passing meeting date)
- Nudge generation unchanged
- Task card display unchanged
- All other existing functionality preserved
