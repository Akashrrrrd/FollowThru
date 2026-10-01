# Implementation Tasks: Collective Commitments Owner and Due Date Fix

## Overview
The fix requires updating the AI system prompt in lib/groq.ts to explicitly instruct Groq to:
1. Use "Unassigned" for collective commitments with no named individual
2. Always extract explicit dates from commitment phrases, regardless of commitment type
3. Provide concrete examples of both correct patterns

---

## Task 1: Update SYSTEM_PROMPT - Owner Assignment Rules Section

- [ ] 1.1 Add OWNER ASSIGNMENT RULES section to SYSTEM_PROMPT
  - Location: After "FIELDS" line in SYSTEM_PROMPT constant
  - Add new section: "OWNER ASSIGNMENT RULES (CRITICAL)"
  - Include subsection for EXPLICIT commitments with example
  - Include subsection for COLLECTIVE commitments with detailed rules
  - Include subsection for ACCEPTANCE commitments with example
  - Collective subsection MUST include:
    - Rule: IF a person is NAMED IN THE PHRASE → they are owner
    - Rule: IF NO person is NAMED → owner = "Unassigned"
    - CRITICAL note: NEVER use speaker's name for collective unless named in phrase
    - Include WRONG/RIGHT examples showing the difference
  - _Requirements: 2.3, 3.1, 3.4_

---

## Task 2: Update SYSTEM_PROMPT - Add Worked Example for Bug Condition

- [ ] 2.1 Add WORKED EXAMPLE 2 to SYSTEM_PROMPT
  - Location: After first WORKED EXAMPLE in SYSTEM_PROMPT constant
  - Example shows: collective commitment with no named individual + explicit date
  - Must include:
    - Realistic transcript line with "We'll" or "Let's"
    - No named person in the phrase
    - Explicit date in the phrase (e.g., "October 8")
    - Expected JSON output showing:
      - owner: "Unassigned"
      - due_date: the extracted date
      - commitment_type: "collective"
  - Example format:
    ```
    WORKED EXAMPLE 2
    Transcript line: "Priya: We'll have a final review meeting on October 8."
    Output: [{"owner":"Unassigned","description":"Have a final review meeting","due_date":"October 8","source_quote":"We'll have a final review meeting on October 8.","confidence":"medium","dependency":null,"commitment_type":"collective"}]
    ```
  - _Requirements: 2.1, 2.2, 2.3_

---

## Task 3: Update SYSTEM_PROMPT - Clarify Date Extraction Rule

- [ ] 3.1 Add explicit instruction for date extraction in collective commitments
  - Location: In due_date field description
  - Add line: "ALWAYS extract explicit dates even for collective commitments."
  - Ensure existing rules about null dates for dependencies are preserved
  - Updated text should be:
    ```
    - due_date: Copy the spoken time phrase exactly as said ("tomorrow", "by Friday", "next Wednesday", "in two weeks", "end of week"). Never calculate, convert or reformat it. Copy a YYYY-MM-DD only if the transcript says it that way. ALWAYS extract explicit dates even for collective commitments. Use null if no time is said, or if the only timing is a dependency ("after Rahul finishes"). If both a date and a dependency exist, keep the date.
    ```
  - _Requirements: 2.2_

---

## Task 4: Test - Verify Groq Now Extracts Bug-Condition Correctly

- [ ] 4.1 Create test script to verify bug-condition extraction
  - Test case 1: "Priya: We'll have a final review meeting on October 8."
    - Expected: owner="Unassigned", due_date="October 8", type="collective"
  - Test case 2: "Ananya: Let's finalize the checklist tomorrow."
    - Expected: owner="Unassigned", due_date="tomorrow", type="collective"
  - Test case 3: "Vikram: Let's have Priya validate the numbers by Friday."
    - Expected: owner="Priya", due_date="by Friday", type="collective"
  - Test case 4: "Rahul: I'll send the report by Monday."
    - Expected: owner="Rahul", due_date="by Monday", type="explicit"

- [ ] 4.2 Run test cases through Groq
  - Execute test script with updated SYSTEM_PROMPT
  - Document results for each test case
  - Verify all 4 tests produce valid JSON output
  - Verify test cases 1-3 show correct Unassigned/named owner behavior
  - Verify test case 4 shows no regression in individual commitments
  - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.4_

---

## Task 5: Test - Extract Full Transcript and Verify All 8 Items

- [ ] 5.1 Run complete transcript through extraction pipeline
  - Transcript contains 8 commitments across 12 lines
  - Expected item #8 to now correctly extract as: owner="Unassigned", due_date="October 8"
  - Expected items #1-7 to maintain existing correct extractions

- [ ] 5.2 Verify all 8 items extract with correct attributes
  - Item 1: Rahul, "Send updated API documentation", "October 2", Explicit
  - Item 2: Vikram, "Review competitor pricing", "October 3", Explicit
  - Item 3: Rahul, "Compile feedback and create summary", "October 4", Explicit
  - Item 4: Rahul, "Take ownership of landing page", "October 5", Explicit
  - Item 5: Priya, "Schedule meeting with marketing", "October 6", Explicit
  - Item 6: Ananya, "Create demo video and share", "October 7", Explicit
  - Item 7: Priya, "Upload latest screenshots", "tomorrow evening", Explicit
  - Item 8 (FIXED): **Unassigned**, "Have a final review meeting", "October 8", Collective
  - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

---

## Task 6: Regression Test - Verify Existing Extractions Still Work

- [ ] 6.1 Test individual commitment extraction ("I'll" with dates)
  - "I'll send it by Friday" → owner=speaker, date="by Friday", type=explicit
  - Verify no regression in speaker assignment for individual commitments

- [ ] 6.2 Test acceptance commitment extraction ("Sure, I'll")
  - "Sure, I'll prepare it" → owner=speaker, type=acceptance
  - Verify no regression in acceptance type assignment

- [ ] 6.3 Test named collective extraction ("Let's have X")
  - "Let's have Priya test it" → owner="Priya", type=collective
  - Verify no regression in named owner extraction

- [ ] 6.4 Test collective with relative dates
  - "We should finalize this next week" → owner="Unassigned", date="next week"
  - Verify collective commitments now properly extract relative dates

- [ ] 6.5 Test dependency-only extraction (no date)
  - "I can review it once you send it" → owner=speaker, date=null, dependency="you send it"
  - Verify no regression in dependency handling

- [ ] 6.6 Test mixed batch of commitments
  - Run a variety of commitment types through extraction
  - Verify all types (explicit, collective, acceptance) work correctly
  - Verify confidence levels remain appropriate
  - Verify source quotes remain accurate
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

---

## Task 7: Code Review - Verify Changes Are Minimal and Correct

- [ ] 7.1 Verify only lib/groq.ts was modified
  - Check git status to ensure no other files changed
  - Confirm no other code besides SYSTEM_PROMPT constant was touched

- [ ] 7.2 Review SYSTEM_PROMPT changes for correctness
  - Verify all three sections added: owner rules, worked example 2, date extraction rule
  - Check for syntax errors in prompt string
  - Verify JSON examples are valid JSON format
  - Confirm no unintended character escaping issues
  - Verify double quotes used consistently

- [ ] 7.3 Verify existing prompt sections preserved
  - Confirm all original sections still present (WHAT COUNTS, EXCLUDE, KEY RULE, FIELDS, etc.)
  - Ensure nothing was accidentally deleted
  - Verify prompt still fits within API limits
  - _Requirements: 2.1, 2.2, 2.3_

---

## Task 8: Deploy and Monitor

- [ ] 8.1 Commit changes with clear message
  - Use message like: "fix(extraction): use 'Unassigned' for collective commitments without named owner, always extract explicit dates"
  - Reference the bugfix spec in commit body

- [ ] 8.2 Deploy to production environment
  - Push to main branch (or create PR for review first if needed)
  - Deploy to Vercel or appropriate environment
  - Monitor for any deployment errors

- [ ] 8.3 Run manual extraction test
  - Test with the full 8-item transcript
  - Verify item #8 now correctly shows owner="Unassigned", due_date="October 8"
  - Verify items #1-7 still extract correctly

- [ ] 8.4 Monitor for errors and regressions
  - Check logs for any extraction errors
  - Verify tasks are created in database with "Unassigned" owner values
  - Verify UI correctly displays unassigned commitments
  - Confirm no errors in meeting extraction flow
  - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

---

## Summary

These 8 tasks implement the minimal fix required:
- Tasks 1-3: Make the three targeted prompt changes to lib/groq.ts SYSTEM_PROMPT
- Tasks 4-6: Verify the fix works and doesn't break existing behavior
- Task 7: Code review the changes
- Task 8: Deploy to production

**Total Scope**: Single file (lib/groq.ts), single constant (SYSTEM_PROMPT), three targeted additions/clarifications.
