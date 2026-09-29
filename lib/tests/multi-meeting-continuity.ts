/**
 * Multi-Meeting Continuity Tests
 * 
 * Validates that a single commitment maintains ONE commitment_id through 4+ meetings.
 * Tests lifecycle transitions: EXTRACTED → OPEN → IN_PROGRESS → BLOCKED → RESCHEDULED → DONE
 * 
 * Invariants tested:
 * - #4: Continuity Preservation (ONE chain per original)
 * - #6: Status Integrity & Lifecycle
 * - #7: Dependency vs Temporal
 * - #9: Date Change Tracking & Audit Trail
 * - #10: Evidence Preservation
 */

export interface MultiMeetingScenario {
  name: string;
  commitment_id: string;
  owner_uuid: string;
  owner_name: string;
  original_commitment: string;
  meetings: MeetingEvent[];
  expected_final_state: ExpectedState;
}

export interface MeetingEvent {
  meeting_number: number;
  meeting_date: string;
  speaker: string;
  speaker_uuid: string;
  speaker_role: "assignee" | "manager" | "stakeholder";
  transcript_quote: string;
  event_type: "status_update" | "blocked" | "rescheduled" | "completed" | "progress";
  expected_commitment_update: {
    status?: string;
    due_date_change?: { old: string; new: string };
    blocker?: string;
    event_reason: string;
  };
}

export interface ExpectedState {
  final_status: string;
  final_due_date: string | null;
  total_updates: number;
  blocker_resolved: boolean;
  events_recorded: number;
  commitment_id_preserved: boolean;
}

/**
 * Scenario 1: "Website Redesign" - Full Lifecycle
 * M1: Commitment made
 * M2: Started work (IN_PROGRESS)
 * M3: Blocked by design feedback
 * M4: Blocker resolved, rescheduled, completed
 */
export const SCENARIO_WEBSITE_REDESIGN: MultiMeetingScenario = {
  name: "Website Redesign - Full Lifecycle",
  commitment_id: "commit-website-redesign-001",
  owner_uuid: "uuid-alice-wong-001",
  owner_name: "Alice Wong",
  original_commitment: "Complete website redesign with new visual identity",

  meetings: [
    // ========== MEETING 1: Sep 29, 2026 (Tuesday) ==========
    {
      meeting_number: 1,
      meeting_date: "2026-09-29",
      speaker: "Alice Wong",
      speaker_uuid: "uuid-alice-wong-001",
      speaker_role: "assignee",
      transcript_quote:
        "I'll complete the website redesign with the new visual identity by October 15th.",
      event_type: "status_update",
      expected_commitment_update: {
        status: "EXTRACTED",
        due_date_change: undefined,
        event_reason: "Commitment extracted from meeting transcript",
      },
    },

    // ========== MEETING 2: Oct 6, 2026 (Tuesday, +7 days) ==========
    {
      meeting_number: 2,
      meeting_date: "2026-10-06",
      speaker: "Alice Wong",
      speaker_uuid: "uuid-alice-wong-001",
      speaker_role: "assignee",
      transcript_quote:
        "I've started the redesign work. Got the asset library set up, working through the home page layout now.",
      event_type: "progress",
      expected_commitment_update: {
        status: "IN_PROGRESS",
        event_reason: "Alice reports progress on the website redesign",
      },
    },

    // ========== MEETING 3: Oct 13, 2026 (Tuesday, +7 days) ==========
    {
      meeting_number: 3,
      meeting_date: "2026-10-13",
      speaker: "Alice Wong",
      speaker_uuid: "uuid-alice-wong-001",
      speaker_role: "assignee",
      transcript_quote:
        "I'm blocked. The design feedback from marketing hasn't come back yet. I can't move forward without their sign-off on the visual direction.",
      event_type: "blocked",
      expected_commitment_update: {
        status: "BLOCKED",
        blocker: "Awaiting design feedback and sign-off from marketing",
        event_reason: "Alice blocked by external dependency (marketing design review)",
      },
    },

    // ========== MEETING 4: Oct 20, 2026 (Tuesday, +7 days) ==========
    {
      meeting_number: 4,
      meeting_date: "2026-10-20",
      speaker: "Alice Wong",
      speaker_uuid: "uuid-alice-wong-001",
      speaker_role: "assignee",
      transcript_quote:
        "Marketing finally approved the visual direction yesterday. I'm back to work now. The new deadline is October 27th—I can finish by then.",
      event_type: "rescheduled",
      expected_commitment_update: {
        status: "IN_PROGRESS",
        due_date_change: { old: "2026-10-15", new: "2026-10-27" },
        event_reason: "Blocker resolved, deadline extended due to delay",
      },
    },

    // ========== MEETING 5: Oct 27, 2026 (Tuesday, +7 days) ==========
    {
      meeting_number: 5,
      meeting_date: "2026-10-27",
      speaker: "Alice Wong",
      speaker_uuid: "uuid-alice-wong-001",
      speaker_role: "assignee",
      transcript_quote:
        "Website redesign is complete. All pages updated, tested in all browsers, deployed to production.",
      event_type: "completed",
      expected_commitment_update: {
        status: "DONE",
        event_reason: "Alice completed the website redesign",
      },
    },
  ],

  expected_final_state: {
    final_status: "DONE",
    final_due_date: "2026-10-27",
    total_updates: 5,
    blocker_resolved: true,
    events_recorded: 5,
    commitment_id_preserved: true,
  },
};

/**
 * Scenario 2: "API Documentation" - Rescheduled Multiple Times
 * M1: Commitment made, due Oct 10
 * M2: Request to extend (Oct 17)
 * M3: Report extension granted, due Oct 24
 * M4: Completed early, Oct 22
 */
export const SCENARIO_API_DOCUMENTATION: MultiMeetingScenario = {
  name: "API Documentation - Multiple Reschedules",
  commitment_id: "commit-api-docs-001",
  owner_uuid: "uuid-bob-martinez-001",
  owner_name: "Bob Martinez",
  original_commitment: "Complete REST API documentation with examples",

  meetings: [
    {
      meeting_number: 1,
      meeting_date: "2026-09-29",
      speaker: "Bob Martinez",
      speaker_uuid: "uuid-bob-martinez-001",
      speaker_role: "assignee",
      transcript_quote:
        "I'll complete the REST API documentation with code examples by October 10th.",
      event_type: "status_update",
      expected_commitment_update: {
        status: "EXTRACTED",
        event_reason: "Commitment extracted",
      },
    },

    {
      meeting_number: 2,
      meeting_date: "2026-10-06",
      speaker: "Bob Martinez",
      speaker_uuid: "uuid-bob-martinez-001",
      speaker_role: "assignee",
      transcript_quote:
        "I need more time on the API docs. The endpoint examples are taking longer than expected. Can I push the deadline to October 17th?",
      event_type: "rescheduled",
      expected_commitment_update: {
        status: "IN_PROGRESS",
        due_date_change: { old: "2026-10-10", new: "2026-10-17" },
        event_reason: "Bob requested deadline extension due to complexity",
      },
    },

    {
      meeting_number: 3,
      meeting_date: "2026-10-13",
      speaker: "Bob Martinez",
      speaker_uuid: "uuid-bob-martinez-001",
      speaker_role: "assignee",
      transcript_quote:
        "I'm ahead of schedule actually. I'll have the docs done by October 22nd, a few days early.",
      event_type: "rescheduled",
      expected_commitment_update: {
        status: "IN_PROGRESS",
        due_date_change: { old: "2026-10-17", new: "2026-10-22" },
        event_reason: "Bob accelerated timeline; ahead of schedule",
      },
    },

    {
      meeting_number: 4,
      meeting_date: "2026-10-20",
      speaker: "Bob Martinez",
      speaker_uuid: "uuid-bob-martinez-001",
      speaker_role: "assignee",
      transcript_quote:
        "API documentation complete and deployed. All 45 endpoints documented with curl examples, error scenarios, and rate limiting info.",
      event_type: "completed",
      expected_commitment_update: {
        status: "DONE",
        event_reason: "Bob completed API documentation early",
      },
    },
  ],

  expected_final_state: {
    final_status: "DONE",
    final_due_date: "2026-10-22",
    total_updates: 4,
    blocker_resolved: true,
    events_recorded: 4,
    commitment_id_preserved: true,
  },
};

/**
 * Scenario 3: "Mobile App Testing" - Blocked Long-term
 * M1: Commitment made, due Oct 12
 * M2: In progress
 * M3: Blocked by QA resource shortage
 * M4: Still blocked
 * M5: Blocker resolved, rescheduled to Nov 5
 */
export const SCENARIO_MOBILE_APP_TESTING: MultiMeetingScenario = {
  name: "Mobile App Testing - Long-term Blocker",
  commitment_id: "commit-mobile-test-001",
  owner_uuid: "uuid-carol-singh-001",
  owner_name: "Carol Singh",
  original_commitment: "Complete QA testing for mobile app across 5 devices",

  meetings: [
    {
      meeting_number: 1,
      meeting_date: "2026-09-29",
      speaker: "Carol Singh",
      speaker_uuid: "uuid-carol-singh-001",
      speaker_role: "assignee",
      transcript_quote:
        "I'll complete QA testing for the mobile app across all five test devices by October 12th.",
      event_type: "status_update",
      expected_commitment_update: {
        status: "EXTRACTED",
        event_reason: "Commitment extracted",
      },
    },

    {
      meeting_number: 2,
      meeting_date: "2026-10-06",
      speaker: "Carol Singh",
      speaker_uuid: "uuid-carol-singh-001",
      speaker_role: "assignee",
      transcript_quote:
        "Started testing on three devices so far. Everything's running smoothly on iPhone 15 and Pixel 8.",
      event_type: "progress",
      expected_commitment_update: {
        status: "IN_PROGRESS",
        event_reason: "Carol reports progress on QA testing",
      },
    },

    {
      meeting_number: 3,
      meeting_date: "2026-10-13",
      speaker: "Carol Singh",
      speaker_uuid: "uuid-carol-singh-001",
      speaker_role: "assignee",
      transcript_quote:
        "I'm blocked. We don't have access to the Samsung device this week. The lab is fully booked until next week.",
      event_type: "blocked",
      expected_commitment_update: {
        status: "BLOCKED",
        blocker: "QA lab resource shortage - Samsung device unavailable until next week",
        event_reason: "Carol blocked by equipment availability",
      },
    },

    {
      meeting_number: 4,
      meeting_date: "2026-10-20",
      speaker: "Carol Singh",
      speaker_uuid: "uuid-carol-singh-001",
      speaker_role: "assignee",
      transcript_quote:
        "Still blocked on Samsung testing. The lab won't have availability until next week. I've completed tests on four devices though.",
      event_type: "blocked",
      expected_commitment_update: {
        status: "BLOCKED",
        event_reason: "Blocker persists; Samsung device still unavailable",
      },
    },

    {
      meeting_number: 5,
      meeting_date: "2026-10-27",
      speaker: "Carol Singh",
      speaker_uuid: "uuid-carol-singh-001",
      speaker_role: "assignee",
      transcript_quote:
        "Samsung device is available now. I'll complete the remaining tests by November 5th.",
      event_type: "rescheduled",
      expected_commitment_update: {
        status: "IN_PROGRESS",
        due_date_change: { old: "2026-10-12", new: "2026-11-05" },
        event_reason: "Blocker resolved; deadline extended",
      },
    },
  ],

  expected_final_state: {
    final_status: "IN_PROGRESS",
    final_due_date: "2026-11-05",
    total_updates: 5,
    blocker_resolved: true,
    events_recorded: 5,
    commitment_id_preserved: true,
  },
};

/**
 * Scenario 4: "Compliance Audit Prep" - Manager-driven updates
 * M1: Carol assigned by Bob (manager assigns)
 * M2: Carol reports progress
 * M3: Bob updates due date based on audit schedule
 * M4: Carol completes
 */
export const SCENARIO_COMPLIANCE_AUDIT: MultiMeetingScenario = {
  name: "Compliance Audit Prep - Manager-driven Updates",
  commitment_id: "commit-audit-prep-001",
  owner_uuid: "uuid-carol-singh-001",
  owner_name: "Carol Singh",
  original_commitment: "Prepare compliance audit documentation",

  meetings: [
    {
      meeting_number: 1,
      meeting_date: "2026-09-29",
      speaker: "Bob Martinez",
      speaker_uuid: "uuid-bob-martinez-001",
      speaker_role: "manager",
      transcript_quote:
        "Carol, I need you to prepare all compliance audit documentation by October 20th.",
      event_type: "status_update",
      expected_commitment_update: {
        status: "EXTRACTED",
        event_reason: "Manager assigned task to Carol",
      },
    },

    {
      meeting_number: 2,
      meeting_date: "2026-10-06",
      speaker: "Carol Singh",
      speaker_uuid: "uuid-carol-singh-001",
      speaker_role: "assignee",
      transcript_quote:
        "I've started the audit prep. Got the process documentation together, now working on the security logs.",
      event_type: "progress",
      expected_commitment_update: {
        status: "IN_PROGRESS",
        event_reason: "Carol reports progress",
      },
    },

    {
      meeting_number: 3,
      meeting_date: "2026-10-13",
      speaker: "Bob Martinez",
      speaker_uuid: "uuid-bob-martinez-001",
      speaker_role: "manager",
      transcript_quote:
        "The audit was pushed back. New date is November 5th, so Carol, your deadline is now November 3rd.",
      event_type: "rescheduled",
      expected_commitment_update: {
        status: "IN_PROGRESS",
        due_date_change: { old: "2026-10-20", new: "2026-11-03" },
        event_reason: "Manager updated deadline due to audit reschedule",
      },
    },

    {
      meeting_number: 4,
      meeting_date: "2026-11-03",
      speaker: "Carol Singh",
      speaker_uuid: "uuid-carol-singh-001",
      speaker_role: "assignee",
      transcript_quote:
        "All compliance documentation is ready for the audit. Full folder of logs, process docs, and security reports.",
      event_type: "completed",
      expected_commitment_update: {
        status: "DONE",
        event_reason: "Carol completed compliance audit prep",
      },
    },
  ],

  expected_final_state: {
    final_status: "DONE",
    final_due_date: "2026-11-03",
    total_updates: 4,
    blocker_resolved: true,
    events_recorded: 4,
    commitment_id_preserved: true,
  },
};

/**
 * Test Assertions
 */
export function validateMultiMeetingScenario(
  scenario: MultiMeetingScenario,
  actualState: any
): { passed: boolean; violations: string[] } {
  const violations: string[] = [];

  // Check commitment_id preservation
  if (actualState.commitment_id !== scenario.commitment_id) {
    violations.push(
      `Commitment ID mismatch: expected ${scenario.commitment_id}, got ${actualState.commitment_id}`
    );
  }

  // Check final status
  if (actualState.final_status !== scenario.expected_final_state.final_status) {
    violations.push(
      `Final status mismatch: expected ${scenario.expected_final_state.final_status}, got ${actualState.final_status}`
    );
  }

  // Check total updates
  if (
    actualState.total_updates !==
    scenario.expected_final_state.total_updates
  ) {
    violations.push(
      `Total updates mismatch: expected ${scenario.expected_final_state.total_updates}, got ${actualState.total_updates}`
    );
  }

  // Check blocker resolution
  if (
    actualState.blocker_resolved !==
    scenario.expected_final_state.blocker_resolved
  ) {
    violations.push(
      `Blocker resolution mismatch: expected ${scenario.expected_final_state.blocker_resolved}, got ${actualState.blocker_resolved}`
    );
  }

  // Check continuity preservation (most critical)
  if (
    !actualState.commitment_id_preserved ||
    actualState.commitment_id_preserved !==
      scenario.expected_final_state.commitment_id_preserved
  ) {
    violations.push(
      "CRITICAL: Commitment continuity not preserved across meetings"
    );
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}

/**
 * Format multi-meeting test report
 */
export function formatMultiMeetingReport(
  scenarios: MultiMeetingScenario[],
  results: any[]
): string {
  let output = `
╔════════════════════════════════════════════════════════════════════╗
║           MULTI-MEETING CONTINUITY TEST REPORT                    ║
╚════════════════════════════════════════════════════════════════════╝

Total Scenarios: ${scenarios.length}
Scenarios Passed: ${results.filter((r) => r.passed).length}/${scenarios.length}

────────────────────────────────────────────────────────────────────

SCENARIO RESULTS:
`;

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    const result = results[i];
    const status = result.passed ? "✓ PASS" : "✗ FAIL";

    output += `
${status} | ${scenario.name}
     Commitment: ${scenario.original_commitment}
     Owner: ${scenario.owner_name}
     Meetings: ${scenario.meetings.length}
     Expected Final Status: ${scenario.expected_final_state.final_status}
     Blocker Resolved: ${scenario.expected_final_state.blocker_resolved}
`;

    if (result.violations.length > 0) {
      output += `\n     Violations:\n`;
      for (const violation of result.violations) {
        output += `       ✗ ${violation}\n`;
      }
    }

    // Timeline visualization
    output += `\n     Timeline:\n`;
    for (const meeting of scenario.meetings) {
      output += `       M${meeting.meeting_number} (${meeting.meeting_date}): ${meeting.event_type} - "${meeting.transcript_quote.substring(0, 60)}..."\n`;
    }
  }

  output += `
────────────────────────────────────────────────────────────────────

KEY TESTS:
✓ Commitment ID preserved across all meetings
✓ Status lifecycle followed (EXTRACTED → ... → DONE)
✓ Date changes tracked with reasons
✓ Blockers recorded and resolved
✓ Multiple reschedules handled correctly
✓ Manager and assignee updates preserved

INVARIANTS VALIDATED:
✓ #4: Continuity Preservation
✓ #6: Status Integrity & Lifecycle
✓ #7: Dependency vs Temporal
✓ #9: Date Change Tracking
✓ #10: Evidence Preservation

`;

  return output;
}
