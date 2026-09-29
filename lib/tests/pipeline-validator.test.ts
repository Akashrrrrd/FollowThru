/**
 * Pipeline Validator Test Suite
 * 
 * Tests all 5 pipeline stages with success and failure scenarios.
 */

import {
  validateExtraction,
  validateParsing,
  validateLinking,
  validateContinuity,
  validateDatabase,
  validatePipeline,
  StageContext,
} from "../pipeline-validator";
import {
  logRejection,
  logRejections,
  getRecoverableRejections,
  getErrorMetrics,
  clearRejectionLogs,
} from "../pipeline-error-handler";

describe("Pipeline Validator", () => {
  describe("STAGE 1: EXTRACTION", () => {
    test("Valid extraction passes", () => {
      const context: StageContext = {
        meeting_id: "meeting-1",
        user_id: "user-1",
        transcript: "Alice: I'll do X by Friday",
        meeting_date: "2026-09-29",
        extraction_response: {
          commitments: [
            {
              owner_user_id: "uuid-alice",
              owner_name: "Alice",
              action: "Do X",
              due_date_expression: "by Friday",
            },
          ],
        },
      };

      const result = validateExtraction(context);
      expect(result.stage).toBe("EXTRACTION");
      expect(result.passed).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test("Missing extraction response fails", () => {
      const context: StageContext = {
        meeting_id: "meeting-1",
        user_id: "user-1",
        transcript: "test",
        meeting_date: "2026-09-29",
      };

      const result = validateExtraction(context);
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.code === "EXTRACTION_NO_RESPONSE")).toBe(true);
    });

    test("Missing commitments array fails", () => {
      const context: StageContext = {
        meeting_id: "meeting-1",
        user_id: "user-1",
        transcript: "test",
        meeting_date: "2026-09-29",
        extraction_response: { data: "invalid" },
      };

      const result = validateExtraction(context);
      expect(result.passed).toBe(false);
      expect(
        result.errors.some((e) => e.code === "EXTRACTION_NO_COMMITMENTS_ARRAY")
      ).toBe(true);
    });

    test("Empty commitments generates warning", () => {
      const context: StageContext = {
        meeting_id: "meeting-1",
        user_id: "user-1",
        transcript: "test",
        meeting_date: "2026-09-29",
        extraction_response: { commitments: [] },
      };

      const result = validateExtraction(context);
      expect(result.passed).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("STAGE 2: PARSING", () => {
    test("Valid commitment parses", () => {
      const context: StageContext = {
        meeting_id: "meeting-1",
        user_id: "user-1",
        transcript: "test",
        meeting_date: "2026-09-29",
        extraction_response: {
          commitments: [
            {
              owner_user_id: "uuid-alice",
              owner_name: "Alice",
              action: "Complete report",
              due_date_expression: "by Friday",
            },
          ],
        },
      };

      const result = validateParsing(context);
      expect(result.passed).toBe(true);
      expect(context.parsed_commitments).toHaveLength(1);
    });

    test("Missing owner fails (Invariant #1)", () => {
      const context: StageContext = {
        meeting_id: "meeting-1",
        user_id: "user-1",
        transcript: "test",
        meeting_date: "2026-09-29",
        extraction_response: {
          commitments: [
            {
              action: "Complete report",
              due_date_expression: "by Friday",
            },
          ],
        },
      };

      const result = validateParsing(context);
      expect(result.errors.some((e) => e.code === "PARSING_MISSING_OWNER")).toBe(true);
      expect(result.errors[0].invariant).toBe(1);
    });

    test("Missing action fails (Invariant #3)", () => {
      const context: StageContext = {
        meeting_id: "meeting-1",
        user_id: "user-1",
        transcript: "test",
        meeting_date: "2026-09-29",
        extraction_response: {
          commitments: [
            {
              owner_user_id: "uuid-alice",
              owner_name: "Alice",
              due_date_expression: "by Friday",
            },
          ],
        },
      };

      const result = validateParsing(context);
      expect(result.errors.some((e) => e.code === "PARSING_MISSING_ACTION")).toBe(true);
      expect(result.errors[0].invariant).toBe(3);
    });

    test("No deadline generates warning", () => {
      const context: StageContext = {
        meeting_id: "meeting-1",
        user_id: "user-1",
        transcript: "test",
        meeting_date: "2026-09-29",
        extraction_response: {
          commitments: [
            {
              owner_user_id: "uuid-alice",
              action: "Complete report",
            },
          ],
        },
      };

      const result = validateParsing(context);
      expect(result.warnings.some((w) => w.code === "PARSING_NO_DEADLINE")).toBe(true);
    });
  });

  describe("STAGE 3: LINKING", () => {
    test("Valid commitment links", () => {
      const context: StageContext = {
        meeting_id: "meeting-1",
        user_id: "user-1",
        transcript: "test",
        meeting_date: "2026-09-29",
        parsed_commitments: [
          {
            owner_user_id: "uuid-alice",
            owner_name: "Alice",
            action: "Complete report",
          },
        ],
      };

      const result = validateLinking(context);
      expect(result.passed).toBe(true);
      expect(context.linked_commitments).toHaveLength(1);
    });

    test("Missing owner UUID generates warning", () => {
      const context: StageContext = {
        meeting_id: "meeting-1",
        user_id: "user-1",
        transcript: "test",
        meeting_date: "2026-09-29",
        parsed_commitments: [
          {
            owner_name: "Alice",
            action: "Complete report",
          },
        ],
      };

      const result = validateLinking(context);
      expect(result.warnings.some((w) => w.code === "LINKING_NO_OWNER_UUID")).toBe(true);
    });
  });

  describe("STAGE 4: CONTINUITY", () => {
    test("Valid commitment preserves chain", () => {
      const context: StageContext = {
        meeting_id: "meeting-1",
        user_id: "user-1",
        transcript: "test",
        meeting_date: "2026-09-29",
        linked_commitments: [
          {
            commitment_id: "123e4567-e89b-12d3-a456-426614174000",
            owner_user_id: "uuid-alice",
            action: "Complete report",
            status: "OPEN",
          },
        ],
      };

      const result = validateContinuity(context);
      expect(result.passed).toBe(true);
      expect(context.continuity_chains).toHaveLength(1);
    });

    test("Invalid UUID format fails (Invariant #4)", () => {
      const context: StageContext = {
        meeting_id: "meeting-1",
        user_id: "user-1",
        transcript: "test",
        meeting_date: "2026-09-29",
        linked_commitments: [
          {
            commitment_id: "invalid-id",
            owner_user_id: "uuid-alice",
            action: "Complete report",
          },
        ],
      };

      const result = validateContinuity(context);
      expect(result.errors.some((e) => e.code === "CONTINUITY_INVALID_UUID")).toBe(true);
      expect(result.errors[0].invariant).toBe(4);
    });

    test("Duplicate commitment IDs fail (Invariant #4)", () => {
      const context: StageContext = {
        meeting_id: "meeting-1",
        user_id: "user-1",
        transcript: "test",
        meeting_date: "2026-09-29",
        linked_commitments: [
          {
            commitment_id: "123e4567-e89b-12d3-a456-426614174000",
            owner_user_id: "uuid-alice",
            action: "Complete report",
          },
          {
            commitment_id: "123e4567-e89b-12d3-a456-426614174000",
            owner_user_id: "uuid-bob",
            action: "Different task",
          },
        ],
      };

      const result = validateContinuity(context);
      expect(result.errors.some((e) => e.code === "CONTINUITY_DUPLICATE_CHAIN")).toBe(true);
    });

    test("Invalid status fails (Invariant #6)", () => {
      const context: StageContext = {
        meeting_id: "meeting-1",
        user_id: "user-1",
        transcript: "test",
        meeting_date: "2026-09-29",
        linked_commitments: [
          {
            owner_user_id: "uuid-alice",
            action: "Complete report",
            status: "INVALID_STATUS",
          },
        ],
      };

      const result = validateContinuity(context);
      expect(result.errors.some((e) => e.code === "CONTINUITY_INVALID_STATUS")).toBe(true);
      expect(result.errors[0].invariant).toBe(6);
    });
  });

  describe("STAGE 5: DATABASE", () => {
    test("Valid data prepares for write", () => {
      const context: StageContext = {
        meeting_id: "meeting-1",
        user_id: "user-1",
        transcript: "test",
        meeting_date: "2026-09-29",
        continuity_chains: [
          {
            owner_user_id: "uuid-alice",
            action: "Complete report",
          },
        ],
      };

      const result = validateDatabase(context);
      expect(result.passed).toBe(true);
      expect(context.database_writes).toHaveLength(1);
    });

    test("Missing owner fails (Invariant #8)", () => {
      const context: StageContext = {
        meeting_id: "meeting-1",
        user_id: "user-1",
        transcript: "test",
        meeting_date: "2026-09-29",
        continuity_chains: [
          {
            action: "Complete report",
          },
        ],
      };

      const result = validateDatabase(context);
      expect(result.errors.some((e) => e.code === "DATABASE_MISSING_OWNER_USER_ID")).toBe(
        true
      );
      expect(result.errors[0].invariant).toBe(8);
    });

    test("Missing meeting ID fails (Invariant #10)", () => {
      const context: StageContext = {
        user_id: "user-1",
        transcript: "test",
        meeting_date: "2026-09-29",
        continuity_chains: [
          {
            owner_user_id: "uuid-alice",
            action: "Complete report",
          },
        ],
      } as any;

      const result = validateDatabase(context);
      expect(result.errors.some((e) => e.code === "DATABASE_NO_MEETING_ID")).toBe(true);
      expect(result.errors[0].invariant).toBe(10);
    });
  });

  describe("Full Pipeline Validation", () => {
    test("Complete success path", () => {
      const context: StageContext = {
        meeting_id: "meeting-1",
        user_id: "user-1",
        transcript: "Alice will complete report by Friday",
        meeting_date: "2026-09-29",
        extraction_response: {
          commitments: [
            {
              owner_user_id: "uuid-alice",
              owner_name: "Alice",
              action: "Complete report",
              due_date_expression: "by Friday",
            },
          ],
        },
      };

      const result = validatePipeline(context);
      expect(result.overall_passed).toBe(true);
      expect(result.error_count).toBe(0);
      expect(result.stages.length).toBe(5);
      expect(result.stages.every((s) => s.passed)).toBe(true);
    });

    test("Pipeline stops at extraction failure", () => {
      const context: StageContext = {
        meeting_id: "meeting-1",
        user_id: "user-1",
        transcript: "test",
        meeting_date: "2026-09-29",
        // Missing extraction_response
      };

      const result = validatePipeline(context);
      expect(result.overall_passed).toBe(false);
      expect(result.stages[0].stage).toBe("EXTRACTION");
      expect(result.stages[0].passed).toBe(false);
      // Should not continue past extraction
      expect(result.stages.length).toBe(1);
    });

    test("Pipeline stops at parsing failure", () => {
      const context: StageContext = {
        meeting_id: "meeting-1",
        user_id: "user-1",
        transcript: "test",
        meeting_date: "2026-09-29",
        extraction_response: {
          commitments: [
            {
              // Missing owner
              action: "Complete report",
            },
          ],
        },
      };

      const result = validatePipeline(context);
      expect(result.overall_passed).toBe(false);
      // Should pass extraction, fail on parsing
      expect(result.stages[0].passed).toBe(true);
      expect(result.stages[1].passed).toBe(false);
    });

    test("Timing is recorded for each stage", () => {
      const context: StageContext = {
        meeting_id: "meeting-1",
        user_id: "user-1",
        transcript: "test",
        meeting_date: "2026-09-29",
        extraction_response: {
          commitments: [],
        },
      };

      const result = validatePipeline(context);
      expect(result.total_duration_ms).toBeGreaterThan(0);
      expect(result.stages.every((s) => s.duration_ms >= 0)).toBe(true);
    });
  });

  describe("Error Handling", () => {
    beforeEach(() => {
      clearRejectionLogs();
    });

    test("Rejection logs recorded", () => {
      const context: StageContext = {
        meeting_id: "meeting-1",
        user_id: "user-1",
        transcript: "test",
        meeting_date: "2026-09-29",
      };

      const result = validateExtraction(context);
      for (const error of result.errors) {
        logRejection("meeting-1", "user-1", "EXTRACTION", error, context);
      }

      const recoverable = getRecoverableRejections();
      expect(recoverable.length).toBeGreaterThan(0);
    });

    test("Error metrics calculated", () => {
      const context: StageContext = {
        meeting_id: "meeting-1",
        user_id: "user-1",
        transcript: "test",
        meeting_date: "2026-09-29",
      };

      logRejections("meeting-1", "user-1", "EXTRACTION", validateExtraction(context).errors, context);
      logRejections("meeting-1", "user-1", "PARSING", validateParsing(context).errors, context);

      const metrics = getErrorMetrics();
      expect(metrics.total_errors).toBeGreaterThan(0);
      expect(metrics.errors_by_stage.EXTRACTION).toBeGreaterThan(0);
    });
  });
});
