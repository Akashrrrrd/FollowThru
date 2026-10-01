# Bugfix Requirements: Collective Commitments Owner and Due Date Extraction

## Introduction

When extracting meeting commitments, the system incorrectly handles collective commitments (those using "We'll", "Let's", etc.). Specifically:
1. Collective commitments without a named individual are assigned the speaker's name as owner instead of "Unassigned"
2. Explicit due dates in collective commitment statements are not being extracted
3. The Groq AI prompt does not clearly distinguish between collective commitments with named owners vs. those without

This bug affects task creation accuracy and prevents unassigned team commitments from being properly tracked. The fix must preserve backward compatibility with all existing working extractions (explicit individual commitments, relative dates, etc.).

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a collective commitment ("We'll...", "Let's...") is extracted with no named individual THEN the system assigns the speaker as owner instead of "Unassigned"

1.2 WHEN a collective commitment contains an explicit date phrase (e.g., "We'll have a final review meeting on October 8") THEN the system fails to extract the date, resulting in null due_date

1.3 WHEN the Groq prompt processes a collective commitment THEN it does not distinguish between "collective with named owner" and "collective without named owner", causing incorrect owner inference

### Expected Behavior (Correct)

2.1 WHEN a collective commitment is extracted with no named individual THEN the system SHALL assign owner = "Unassigned"

2.2 WHEN a collective commitment contains an explicit date phrase THEN the system SHALL extract the date and set it as due_date, independent of commitment type

2.3 WHEN the Groq prompt processes a collective commitment THEN it SHALL output owner = "Unassigned" when no named person is identified, or owner = [the named person] if a specific individual is mentioned

### Unchanged Behavior (Regression Prevention)

3.1 WHEN an individual commitment uses "I'll" or "I will" THEN the system SHALL CONTINUE TO assign the speaker as owner

3.2 WHEN a commitment contains a relative date phrase ("by Friday", "tomorrow", "next Wednesday") THEN the system SHALL CONTINUE TO extract and preserve the date phrase for later resolution

3.3 WHEN a commitment contains a dependency expression ("after X finishes", "once Y is done") THEN the system SHALL CONTINUE TO extract the dependency and set due_date to null if only a dependency exists

3.4 WHEN an acceptance commitment ("Sure, I'll...", "Yes, I'll...") is extracted THEN the system SHALL CONTINUE TO assign the speaker as owner

3.5 WHEN explicit individual commitments with named owners are extracted (Rahul, Vikram, Ananya, etc.) THEN the system SHALL CONTINUE TO extract correctly with all original attributes (owner, due_date, type, confidence)

3.6 WHEN relative dates are extracted in collective commitments THEN the system SHALL CONTINUE TO preserve them exactly as spoken and resolve them through the date resolver pipeline

3.7 WHEN a collective commitment has both an explicit date and a named person ("We'll have Sarah lead testing by October 5") THEN the system SHALL CONTINUE TO extract owner = "Sarah" and due_date = "by October 5"

3.8 WHEN processing the 8-item test transcript THEN the system SHALL CONTINUE TO extract items 1-7 correctly and now fix item 8 to have owner = "Unassigned" and due_date = "October 8"
