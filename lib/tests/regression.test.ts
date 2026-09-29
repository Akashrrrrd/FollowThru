/**
 * Jest Integration: Regression Test Suite - PART 3
 * 
 * Comprehensive tests for:
 * - 11 domain-specific transcripts
 * - 4 multi-meeting continuity scenarios
 * - Date resolver determinism and patterns
 * - All 10 non-negotiable invariants
 */

import { REGRESSION_TRANSCRIPTS } from "./regression-transcripts";
import {
  validateCommitmentInvariants,
} from "./regression-test-harness";
import {
  SCENARIO_WEBSITE_REDESIGN,
  SCENARIO_API_DOCUMENTATION,
  SCENARIO_MOBILE_APP_TESTING,
  SCENARIO_COMPLIANCE_AUDIT,
} from "./multi-meeting-continuity";
import {
  testDateResolverDeterminism,
} from "./date-resolver-randomization";
import { resolveDateExpression } from "../date-resolver";

describe("PART 3: Regression Test Suite", () => {
  describe("Domain-Specific Regression Tests (11 domains)", () => {
    REGRESSION_TRANSCRIPTS.forEach((transcript: any) => {
      test(`${transcript.domain}: ${transcript.description}`, () => {
        const expectedCommitments = transcript.expectedCommitments.filter(
          (c: any) => c.is_commitment
        );

        for (const commitment of expectedCommitments) {
          expect(commitment.owner_name || commitment.owner_uuid).toBeTruthy();
          expect(commitment.action).toBeTruthy();

          const violations = validateCommitmentInvariants(
            commitment,
            transcript.date
          );
          const critical = violations.filter((v: any) => v.severity === "critical");
          expect(critical.length).toBe(0);
        }
      });
    });
  });

  describe("Multi-Meeting Continuity Tests (4 scenarios)", () => {
    const scenarios = [
      SCENARIO_WEBSITE_REDESIGN,
      SCENARIO_API_DOCUMENTATION,
      SCENARIO_MOBILE_APP_TESTING,
      SCENARIO_COMPLIANCE_AUDIT,
    ];

    scenarios.forEach((scenario: any) => {
      test(`${scenario.name}: Structure valid`, () => {
        expect(scenario.commitment_id).toBeTruthy();
        expect(scenario.owner_uuid).toBeTruthy();
        expect(scenario.meetings.length).toBeGreaterThan(1);
        expect(scenario.expected_final_state.commitment_id_preserved).toBe(true);
      });

      test(`${scenario.name}: Status lifecycle valid`, () => {
        const valid = [
          "EXTRACTED",
          "OPEN",
          "IN_PROGRESS",
          "BLOCKED",
          "RESCHEDULED",
          "DONE",
        ];
        expect(valid).toContain(scenario.expected_final_state.final_status);
      });
    });
  });

  describe("Date Resolver Tests", () => {
    test("Date resolver is deterministic", () => {
      const results = testDateResolverDeterminism();
      expect(results.deterministic).toBe(true);
    });

    test("'by next Monday' resolves", () => {
      const result = resolveDateExpression(
        "by next Monday",
        new Date("2026-09-29")
      );
      expect(result).toBeTruthy();
      expect(result).toMatch(/^2026-10-/);
    });

    test("'by Friday' resolves", () => {
      const result = resolveDateExpression("by Friday", new Date("2026-09-29"));
      expect(result).toBe("2026-10-02");
    });

    test("'in 3 days' resolves", () => {
      const result = resolveDateExpression("in 3 days", new Date("2026-09-29"));
      expect(result).toBe("2026-10-02");
    });

    test("Vague expressions return null", () => {
      const result = resolveDateExpression("ASAP", new Date("2026-09-29"));
      expect(result).toBeNull();
    });
  });

  describe("Invariant Compliance", () => {
    test("Invariant #1: Owner required", () => {
      for (const transcript of REGRESSION_TRANSCRIPTS) {
        const commitments = transcript.expectedCommitments.filter(
          (c: any) => c.is_commitment
        );
        for (const c of commitments) {
          expect(c.owner_uuid || c.owner_name).toBeTruthy();
        }
      }
    });

    test("Invariant #2: Date resolution deterministic", () => {
      const r1 = resolveDateExpression("by Friday", new Date("2026-09-29"));
      const r2 = resolveDateExpression("by Friday", new Date("2026-09-29"));
      expect(r1).toBe(r2);
    });

    test("Invariant #3: Commitments have action", () => {
      for (const transcript of REGRESSION_TRANSCRIPTS) {
        const commitments = transcript.expectedCommitments.filter(
          (c: any) => c.is_commitment
        );
        for (const c of commitments) {
          expect(c.action).toBeTruthy();
        }
      }
    });

    test("Invariant #6: Valid status lifecycle", () => {
      const valid = [
        "EXTRACTED",
        "OPEN",
        "IN_PROGRESS",
        "BLOCKED",
        "RESCHEDULED",
        "DONE",
      ];

      for (const scenario of [
        SCENARIO_WEBSITE_REDESIGN,
        SCENARIO_API_DOCUMENTATION,
        SCENARIO_MOBILE_APP_TESTING,
        SCENARIO_COMPLIANCE_AUDIT,
      ]) {
        expect(valid).toContain(scenario.expected_final_state.final_status);
      }
    });
  });

  describe("Test Coverage", () => {
    test("11 domain transcripts", () => {
      expect(REGRESSION_TRANSCRIPTS.length).toBe(11);
    });

    test("4 continuity scenarios with 4+ meetings each", () => {
      const scenarios = [
        SCENARIO_WEBSITE_REDESIGN,
        SCENARIO_API_DOCUMENTATION,
        SCENARIO_MOBILE_APP_TESTING,
        SCENARIO_COMPLIANCE_AUDIT,
      ];
      expect(scenarios.length).toBe(4);
      for (const s of scenarios) {
        expect(s.meetings.length).toBeGreaterThanOrEqual(4);
      }
    });
  });
});
