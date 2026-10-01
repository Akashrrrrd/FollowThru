# Collective Commitments Owner and Due Date Fix - Design

## Overview

The commitment extraction system fails to correctly handle collective commitments ("We'll", "Let's") in two ways:

1. **Incorrect Owner Assignment**: Collective commitments without named individuals are assigned the speaker's name instead of "Unassigned"
2. **Missing Date Extraction**: Explicit dates in collective commitment phrases are not extracted, resulting in null due_date

The root cause is insufficient clarity in the Groq AI system prompt about how to handle collective commitments without named owners. The fix requires updating the prompt to explicitly distinguish between collective commitments with named individuals vs. those without, plus ensuring dates are always extracted when present.

This fix is minimal, focused, and preserves all existing behavior for individual commitments, relative dates, and dependencies.

## Glossary

- **Bug_Condition (C)**: A collective commitment statement with no named person mentioned in the commitment phrase itself, such as "We'll have a final review meeting on October 8" or "Let's finalize the checklist"
- **Property (P)**: The desired behavior when C(X) is true - extracting owner as "Unassigned" and preserving explicit date phrases
- **Preservation**: All existing working behaviors for individual commitments ("I'll"), named collective commitments ("Let's have Priya..."), relative dates, and dependencies
- **SYSTEM_PROMPT**: The hardcoded AI prompt in `lib/groq.ts` that instructs Groq how to extract commitments
- **parseCommitments**: Function in `lib/groq.ts` that validates and deduplicates Groq's JSON output
- **ExtractedCommitment**: Type in `lib/types.ts` representing a single extracted commitment with fields: owner, description, due_date, source_quote, confidence, dependency, commitment_type
- **Groq AI Model**: The language model called via API to extract commitments from meeting transcripts
- **Date Resolver**: Pipeline component in `lib/date-resolver.ts` that converts spoken phrases ("by Friday") to YYYY-MM-DD dates

## Bug Details

### Bug Condition

The bug manifests when a collective commitment is made ("We'll...", "Let's...") without naming a specific individual within the commitment phrase itself. In these cases, the Groq prompt lacks explicit guidance to distinguish this from cases where a person is named.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type ExtractedCommitment
  OUTPUT: boolean
  
  RETURN input.commitment_type == "collective"
         AND input.owner != "Unassigned"
         AND NOT (input.owner IN transcript_speakers)
         AND NOT (input.description contains input.owner)
END FUNCTION
```

More simply: **C(X) is true when extracted commitment has collective type but owner is not "Unassigned" and the named person is not mentioned in the action itself.**

Alternatively, from the AI prompt perspective:
```
FUNCTION isBuggyPromptBehavior(transcript_line)
  INPUT: transcript_line contains "We'll..." or "Let's..." with explicit date
  OUTPUT: boolean
  
  RETURN (no specific person named in the commitment phrase)
         AND (date is present in the phrase)
         AND (Groq returns owner = speaker name instead of "Unassigned")
         AND (Groq returns due_date = null instead of the date)
END FUNCTION
```

### Examples

**Example 1: Collective with no named person + explicit date (BUGGY)**
```
Transcript: "Priya: We'll have a final review meeting on October 8."
Current (Wrong):
  {owner: "Priya", due_date: null, type: "collective"}
Expected (Correct):
  {owner: "Unassigned", due_date: "October 8", type: "collective"}
Bug: Speaker name used for collective action; date not extracted
```

**Example 2: Collective with named person + explicit date (WORKS)**
```
Transcript: "Priya: We'll have Sarah lead the testing by October 10."
Current (Correct):
  {owner: "Sarah", due_date: "by October 10", type: "collective"}
Expected (Correct):
  {owner: "Sarah", due_date: "by October 10", type: "collective"}
No bug: Named person extracted correctly; date extracted
```

**Example 3: Individual with explicit date (WORKS)**
```
Transcript: "Rahul: I'll send the report by Friday."
Current (Correct):
  {owner: "Rahul", due_date: "by Friday", type: "explicit"}
Expected (Correct):
  {owner: "Rahul", due_date: "by Friday", type: "explicit"}
No bug: Individual commitment works correctly
```

**Example 4: Collective with relative date (BUGGY)**
```
Transcript: "Ananya: Let's finalize the checklist tomorrow."
Current (Wrong):
  {owner: "Ananya", due_date: null, type: "collective"}
Expected (Correct):
  {owner: "Unassigned", due_date: "tomorrow", type: "collective"}
Bug: Speaker name used; relative date not extracted
```

**Example 5: Edge case - Collective with named person + relative date (WORKS)**
```
Transcript: "Vikram: Let's have Priya validate the numbers tomorrow."
Current (Correct):
  {owner: "Priya", due_date: "tomorrow", type: "collective"}
Expected (Correct):
  {owner: "Priya", due_date: "tomorrow", type: "collective"}
No bug: Named person and date extracted correctly
```

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors** (What MUST Continue to Work):
- Mouse clicks on action buttons must continue to work exactly as before
- Button display with numbered shortcuts must remain unchanged
- Game state transitions between UI contexts must remain unchanged
- Individual commitments with "I'll" or "I will" must continue to assign the speaker as owner
- Relative date phrases must continue to be extracted and preserved exactly as spoken
- Explicit individual commitments with named owners (Rahul, Vikram, Ananya) must continue to extract all attributes correctly
- Collective commitments WITH a named person must continue to extract that person as owner
- Dependency expressions must continue to be extracted and prevent date extraction when no date is present
- Acceptance commitments ("Sure, I'll", "Yes, I'll") must continue to assign the speaker as owner

**Scope**:
All inputs that do NOT involve the bug condition (collective commitments without named individuals) should be completely unaffected by this fix. This includes:
- Individual commitments using "I'll" or "I will"
- Collective commitments with named individuals mentioned in the phrase
- Any commitment type with relative dates (relative to meeting context)
- Any commitment with dependency conditions
- Any non-collective, non-acceptance commitment types

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **Insufficient Owner Assignment Rules in Prompt**: The current SYSTEM_PROMPT in `lib/groq.ts` has only a brief example ("Let's have Priya test it = Priya") in the FIELDS section. It lacks explicit rules for when a person is NOT named.

2. **No Explicit "Unassigned" Guidance**: The prompt does not instruct Groq to use "Unassigned" as a specific value for collective commitments without named individuals. The current owner assignment logic says "For 'Let's' and 'We'll', use the speaker unless a name is given", which creates ambiguity about what to do when no name is given.

3. **Date Extraction Not Explicitly Required for All Types**: The due_date rules say "Copy the spoken time phrase exactly as said" but don't explicitly state this applies to collective commitments. The current example works for individual commitments but doesn't show collective + date combinations.

4. **No Worked Examples for Bug Condition**: The WORKED EXAMPLE section shows only an explicit individual commitment. There's no example showing a collective commitment with no named person and an explicit date.

5. **Implicit Speaker Assumption**: When the rules say "use the speaker unless a name is given" for "Let's"/"We'll", it doesn't explicitly forbid using the speaker when no name is found. Groq may default to the speaker assumption as a fallback.

## Correctness Properties

Property 1: Bug Condition - Collective Commitments Without Named Individuals

_For any_ extracted commitment where the bug condition holds (collective type, no named individual in phrase, explicit date present), the fixed extraction function SHALL output owner = "Unassigned" and SHALL extract the date as due_date, enabling proper task assignment tracking and deadline capture.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Non-Buggy Commitments

_For any_ extracted commitment where the bug condition does NOT hold (individual commitments, named collective commitments, or any commitment without the bug pattern), the fixed extraction function SHALL produce the same result as the original function, preserving all existing extraction behavior including owner assignment, date handling, confidence levels, and commitment types.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct, the fix involves updating the SYSTEM_PROMPT in `lib/groq.ts` to provide explicit, unambiguous guidance about collective commitments.

**File**: `lib/groq.ts`

**Constant**: `SYSTEM_PROMPT`

**Specific Changes**:

1. **Add Explicit Owner Assignment Rules Section** (after "FIELDS" section begins)
   - Create a new "OWNER ASSIGNMENT RULES (CRITICAL)" subsection
   - Distinguish explicitly between individual and collective commitments
   - Document the "Unassigned" value as the correct choice for unnamed collective commitments
   - Provide clear negation: "NEVER use the speaker's name for collective commitments unless their name appears in the commitment phrase"

2. **Add Concrete Bug Condition Example** (in WORKED EXAMPLE section)
   - Add "WORKED EXAMPLE 2" showing a collective commitment with no named individual + explicit date
   - Input: "Priya: We'll have a final review meeting on October 8."
   - Expected output including owner="Unassigned", due_date="October 8", type="collective"
   - This directly addresses the bug pattern

3. **Clarify Date Extraction for All Types** (in due_date rules)
   - Add explicit statement: "ALWAYS extract explicit dates even for collective commitments"
   - Change wording from "Copy the spoken time phrase..." to "Copy the spoken time phrase exactly. This applies to all commitment types including collective."

### Prompt Changes (Pseudocode)

```
OWNER ASSIGNMENT RULES (CRITICAL)

For EXPLICIT commitments ("I'll", "I will", "Sure, I'll", "Yes, I'll"):
  - owner = the speaker's name

For COLLECTIVE commitments ("We'll", "Let's") with a concrete action:
  - If a specific person is NAMED IN THE COMMITMENT PHRASE, that person is the owner.
    Example: "Let's have Priya test it" → owner "Priya"
  - If NO PERSON IS NAMED in the commitment phrase itself, owner = "Unassigned"
    Example: "We'll have a final review meeting" → owner "Unassigned"
    Example: "Let's finalize the checklist" → owner "Unassigned"
  - NEVER use the speaker's name for collective commitments unless their name appears IN the commitment phrase.
    WRONG: "We'll review the proposal" → owner "Priya" (speaker name - incorrect)
    RIGHT: "We'll review the proposal" → owner "Unassigned"

For ACCEPTANCE commitments ("Sure, I'll", "Yes, I'll", "I can"):
  - owner = the speaker's name
```

Plus add to WORKED EXAMPLE section:

```
WORKED EXAMPLE 2
Transcript line: "Priya: We'll have a final review meeting on October 8."
Output: [{"owner":"Unassigned","description":"Have a final review meeting","due_date":"October 8","source_quote":"We'll have a final review meeting on October 8.","confidence":"medium","dependency":null,"commitment_type":"collective"}]
```

Plus update due_date rules to add:

```
CRITICAL: ALWAYS extract explicit dates even for collective commitments.
```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code (run tests on current Groq prompt), then verify the fix works correctly and preserves existing behavior (run tests on updated prompt).

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the prompt fix. Confirm the root cause is indeed insufficient prompt guidance.

**Test Plan**: 
1. Write integration tests that send meeting transcripts containing collective commitments (with and without named individuals) to Groq with the CURRENT prompt
2. Capture the actual JSON output from Groq
3. Parse and examine the owner and due_date fields
4. Document the failure pattern (speaker name used for unnamed collective, dates missing)
5. This confirms the bug exists and validates our root cause hypothesis

**Test Cases**:
1. **Unnamed Collective with Explicit Date**: Send "Priya: We'll have a final review meeting on October 8" and expect current (buggy) output to show owner="Priya" and due_date=null
2. **Unnamed Collective with Relative Date**: Send "Ananya: Let's finalize the checklist tomorrow" and expect owner="Ananya" and due_date=null
3. **Named Collective with Date**: Send "Vikram: Let's have Priya validate tomorrow" and expect (correct) output with owner="Priya", due_date="tomorrow"
4. **Individual with Date**: Send "Rahul: I'll send it by Friday" and expect (correct) output with owner="Rahul", due_date="by Friday"

**Expected Counterexamples** (failures on current code):
- Test case 1: owner field is "Priya" instead of "Unassigned"; due_date is null instead of "October 8"
- Test case 2: owner field is "Ananya" instead of "Unassigned"; due_date is null instead of "tomorrow"
- Test cases 3 and 4: These should already pass (not in bug condition)

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed extraction produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := extractCommitments_fixed(input)
  ASSERT result.owner == "Unassigned"
  ASSERT result.due_date != null
  ASSERT result.commitment_type == "collective"
END FOR
```

**Implementation**:
1. Update SYSTEM_PROMPT in lib/groq.ts with the new owner assignment rules
2. Re-run the same exploratory test cases
3. Verify test cases 1 and 2 now pass (owner="Unassigned", due_date extracted)
4. Document the fixed output from Groq showing the correct behavior

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed extraction produces identical results as the original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  result_original := extractCommitments_original(input)
  result_fixed := extractCommitments_fixed(input)
  ASSERT result_original == result_fixed
END FOR
```

**Testing Approach**: Property-based testing is recommended because:
- It generates many test case combinations automatically (different speakers, different commitment types, different date formats)
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs
- The test suite can be reused to prevent regressions

**Test Plan**: 
1. Create a property-based test that generates random transcripts
2. Filter to generate only non-bug-condition inputs (individual commitments, named collective commitments, etc.)
3. Run both old and new Groq prompts on the same inputs
4. Verify all extracted commitments are identical between the two

**Test Cases**:
1. **Individual Commitment Preservation**: Verify "I'll" and "I will" commitments continue to extract speaker as owner
2. **Named Collective Preservation**: Verify collective commitments with named individuals continue to extract correctly
3. **Relative Date Preservation**: Verify all relative date phrases continue to be extracted and preserved
4. **Dependency Preservation**: Verify dependency expressions continue to be handled correctly
5. **Confidence Level Preservation**: Verify confidence levels remain unchanged
6. **Commitment Type Preservation**: Verify commitment types continue to be correctly classified

### Unit Tests

- Test parsing logic for JSON validation with various owner values including "Unassigned"
- Test deduplication logic with "Unassigned" as an owner value
- Test edge cases: empty owner values, null owner values, special characters in owner names
- Test that both relative ("tomorrow") and absolute ("October 8") dates are preserved correctly
- Test quote verification doesn't break with "Unassigned" commitments

### Property-Based Tests

- Generate random collective commitment phrases and verify owner is either a named person or "Unassigned"
- Generate random combinations of commitment types, speaker names, and date formats, verify only bug-condition cases change
- Generate random action descriptions and verify they don't become owners
- Generate random transcripts and verify total commitment count and breakdown by type/owner/confidence is stable

### Integration Tests

- Extract commitments from full sample transcripts with mixed commitment types
- Verify the extracted set includes unassigned collective items with dates
- Verify the extraction pipeline can handle the updated commitments through to task creation
- Test that date resolver works correctly on "Unassigned" commitments with explicit dates
- Test that task assignment system handles "Unassigned" owner correctly downstream

