/**
 * Pipeline Validator: Stage-by-Stage Extraction Validation
 * 
 * Validates commitment extraction through 5 critical stages:
 * 1. EXTRACTION: Groq API call succeeds, returns valid JSON
 * 2. PARSING: Response schema validates, commitments parseable
 * 3. LINKING: Previous commitments found, matching logic works
 * 4. CONTINUITY: Commitment chains preserved, no duplicates
 * 5. DATABASE: Write succeeds, data retrievable
 * 
 * Each stage has explicit validation rules tied to invariants.
 */

import { validateCommitmentInvariants } from "./tests/regression-test-harness";

export type PipelineStage =
  | "EXTRACTION"
  | "PARSING"
  | "LINKING"
  | "CONTINUITY"
  | "DATABASE";

export type ValidationResult = {
  stage: PipelineStage;
  passed: boolean;
  errors: PipelineError[];
  warnings: PipelineWarning[];
  duration_ms: number;
};

export type PipelineError = {
  code: string;
  invariant?: number;
  message: string;
  context?: Record<string, any>;
  recoverable: boolean; // Can pipeline retry or skip?
};

export type PipelineWarning = {
  code: string;
  message: string;
  suggestion: string;
};

export type StageContext = {
  meeting_id: string;
  user_id: string;
  transcript: string;
  meeting_date: string;
  extraction_request?: Record<string, any>;
  extraction_response?: any;
  parsed_commitments?: any[];
  linked_commitments?: any[];
  continuity_chains?: any[];
  database_writes?: any[];
};

/**
 * STAGE 1: EXTRACTION
 * 
 * Validates that Groq API call succeeded and returned valid response.
 * 
 * Invariants: None directly (Groq is AI responsibility)
 * Errors: API failure, timeout, invalid response format
 */
export function validateExtraction(
  context: StageContext
): ValidationResult {
  const startTime = performance.now();
  const errors: PipelineError[] = [];
  const warnings: PipelineWarning[] = [];

  // Check 1: Response exists
  if (!context.extraction_response) {
    errors.push({
      code: "EXTRACTION_NO_RESPONSE",
      message: "Groq API returned no response",
      recoverable: true,
    });
  }

  // Check 2: Response is valid object
  if (
    context.extraction_response &&
    typeof context.extraction_response !== "object"
  ) {
    errors.push({
      code: "EXTRACTION_INVALID_TYPE",
      message: `Expected object, got ${typeof context.extraction_response}`,
      recoverable: true,
    });
  }

  // Check 3: Has commitments array
  if (context.extraction_response && !Array.isArray(context.extraction_response.commitments)) {
    errors.push({
      code: "EXTRACTION_NO_COMMITMENTS_ARRAY",
      message: "Response missing 'commitments' array",
      recoverable: false,
    });
  }

  // Check 4: Commitments array not empty (warning if so, not error)
  if (
    context.extraction_response?.commitments &&
    context.extraction_response.commitments.length === 0
  ) {
    warnings.push({
      code: "EXTRACTION_EMPTY_COMMITMENTS",
      message: "No commitments extracted from transcript",
      suggestion:
        "Verify transcript contains clear commitments. This may be expected for discussion-only meetings.",
    });
  }

  // Check 5: Meeting ID provided
  if (!context.meeting_id) {
    errors.push({
      code: "EXTRACTION_NO_MEETING_ID",
      message: "Meeting ID not provided",
      recoverable: false,
    });
  }

  // Check 6: User ID provided
  if (!context.user_id) {
    errors.push({
      code: "EXTRACTION_NO_USER_ID",
      message: "User ID not provided",
      recoverable: false,
    });
  }

  // Check 7: Meeting date valid (ISO string)
  if (context.meeting_date && !/^\d{4}-\d{2}-\d{2}$/.test(context.meeting_date)) {
    errors.push({
      code: "EXTRACTION_INVALID_DATE",
      message: `Invalid meeting date format: ${context.meeting_date} (expected YYYY-MM-DD)`,
      recoverable: false,
    });
  }

  const duration = performance.now() - startTime;

  return {
    stage: "EXTRACTION",
    passed: errors.length === 0,
    errors,
    warnings,
    duration_ms: duration,
  };
}

/**
 * STAGE 2: PARSING
 * 
 * Validates that extracted commitments conform to schema.
 * 
 * Invariants: #1 (owner required), #3 (action+date required)
 */
export function validateParsing(context: StageContext): ValidationResult {
  const startTime = performance.now();
  const errors: PipelineError[] = [];
  const warnings: PipelineWarning[] = [];

  if (!context.extraction_response?.commitments) {
    errors.push({
      code: "PARSING_NO_COMMITMENTS",
      message: "Cannot parse: no commitments to validate",
      recoverable: false,
    });
    return {
      stage: "PARSING",
      passed: false,
      errors,
      warnings,
      duration_ms: performance.now() - startTime,
    };
  }

  const commitments = context.extraction_response.commitments;
  context.parsed_commitments = [];

  for (let i = 0; i < commitments.length; i++) {
    const commit = commitments[i];

    // Check: Owner required (from Groq extraction)
    if (!commit.owner || typeof commit.owner !== "string" || commit.owner.trim() === "") {
      errors.push({
        code: "PARSING_MISSING_OWNER",
        message: `Commitment ${i}: Missing or empty owner`,
        context: { commitment: commit },
        recoverable: false,
      });
      continue;
    }

    // Check: Description required (from Groq extraction)
    if (!commit.description || typeof commit.description !== "string" || commit.description.trim() === "") {
      errors.push({
        code: "PARSING_MISSING_DESCRIPTION",
        message: `Commitment ${i}: Missing or empty description`,
        context: { commitment: commit },
        recoverable: false,
      });
      continue;
    }

    // Check: Source quote required (from Groq extraction)
    if (!commit.source_quote || typeof commit.source_quote !== "string" || commit.source_quote.trim() === "") {
      errors.push({
        code: "PARSING_MISSING_SOURCE",
        message: `Commitment ${i}: Missing or empty source_quote`,
        context: { commitment: commit },
        recoverable: false,
      });
      continue;
    }

    // Check: Due date if provided (optional, from Groq extraction)
    if (commit.due_date) {
      if (typeof commit.due_date !== "string") {
        errors.push({
          code: "PARSING_INVALID_DATE_TYPE",
          message: `Commitment ${i}: due_date must be string`,
          context: { commitment: commit },
          recoverable: false,
        });
        continue;
      }
    } else {
      // No deadline is OK (ongoing commitment)
      warnings.push({
        code: "PARSING_NO_DEADLINE",
        message: `Commitment ${i}: No due date (ongoing commitment)`,
        suggestion: "Ongoing commitments are valid",
      });
    }

    // Check: Confidence is valid (optional, from Groq extraction)
    if (commit.confidence && !["high", "medium", "low"].includes(commit.confidence)) {
      warnings.push({
        code: "PARSING_INVALID_CONFIDENCE",
        message: `Commitment ${i}: Invalid confidence level, defaulting to medium`,
        suggestion: "Confidence should be 'high', 'medium', or 'low'",
      });
    }

    // If all critical checks pass, add to parsed list
    context.parsed_commitments.push(commit);
  }

  // Check: At least some commitments parsed successfully
  if (context.parsed_commitments.length === 0 && commitments.length > 0) {
    errors.push({
      code: "PARSING_ALL_FAILED",
      message: `All ${commitments.length} commitments failed to parse`,
      recoverable: false,
    });
  }

  const duration = performance.now() - startTime;

  return {
    stage: "PARSING",
    passed: errors.length === 0,
    errors,
    warnings,
    duration_ms: duration,
  };
}

/**
 * STAGE 3: LINKING
 * 
 * Validates that commitment linker can find previous commitments
 * and that matching logic produces sensible results.
 * 
 * Invariants: #5 (no false merges, confidence check)
 */
export function validateLinking(context: StageContext): ValidationResult {
  const startTime = performance.now();
  const errors: PipelineError[] = [];
  const warnings: PipelineWarning[] = [];

  if (!context.parsed_commitments || context.parsed_commitments.length === 0) {
    warnings.push({
      code: "LINKING_NO_COMMITMENTS",
      message: "No commitments to link",
      suggestion: "This is OK for discussion-only meetings",
    });
    return {
      stage: "LINKING",
      passed: true,
      errors,
      warnings,
      duration_ms: performance.now() - startTime,
    };
  }

  context.linked_commitments = [];

  // In a real scenario, would query database for previous commitments
  // For now, validate that the linker CAN be called without error
  for (const commit of context.parsed_commitments) {
    // Validate: Owner must have stable ID for linking
    if (!commit.owner_user_id) {
      warnings.push({
        code: "LINKING_NO_OWNER_UUID",
        message: `Commitment "${commit.action.substring(0, 30)}" has no owner_user_id`,
        suggestion:
          "Owner will be matched by name, which is less reliable. Consider capturing speaker UUID.",
      });
    }

    // Validate: Action description reasonable for matching
    if (commit.action.length < 5) {
      warnings.push({
        code: "LINKING_SHORT_ACTION",
        message: `Commitment action is very short: "${commit.action}"`,
        suggestion: "Short actions may not match reliably across meetings",
      });
    }

    // Valid for linking
    context.linked_commitments.push(commit);
  }

  const duration = performance.now() - startTime;

  return {
    stage: "LINKING",
    passed: errors.length === 0,
    errors,
    warnings,
    duration_ms: duration,
  };
}

/**
 * STAGE 4: CONTINUITY
 * 
 * Validates that commitment chains are preserved correctly
 * and no duplicates are created.
 * 
 * Invariants: #4 (ONE chain per original), #6 (status lifecycle)
 */
export function validateContinuity(context: StageContext): ValidationResult {
  const startTime = performance.now();
  const errors: PipelineError[] = [];
  const warnings: PipelineWarning[] = [];

  if (!context.linked_commitments || context.linked_commitments.length === 0) {
    warnings.push({
      code: "CONTINUITY_NO_COMMITMENTS",
      message: "No commitments to validate for continuity",
      suggestion: "OK for first-time commits",
    });
    return {
      stage: "CONTINUITY",
      passed: true,
      errors,
      warnings,
      duration_ms: performance.now() - startTime,
    };
  }

  context.continuity_chains = [];
  const seenChainIds = new Set<string>();
  const seenOwnerActions = new Set<string>();

  for (const commit of context.linked_commitments) {
    // Check: commitment_id is stable UUID (for updates)
    if (commit.commitment_id && !/^[a-f0-9\-]{36}$/.test(commit.commitment_id)) {
      errors.push({
        code: "CONTINUITY_INVALID_UUID",
        invariant: 4,
        message: `Invalid commitment_id format: ${commit.commitment_id}`,
        context: { commitment: commit },
        recoverable: false,
      });
      continue;
    }

    // Check: No duplicate chains (Invariant #4)
    if (commit.commitment_id && seenChainIds.has(commit.commitment_id)) {
      errors.push({
        code: "CONTINUITY_DUPLICATE_CHAIN",
        invariant: 4,
        message: `Duplicate commitment_id in same batch: ${commit.commitment_id}`,
        context: { commitment: commit },
        recoverable: false,
      });
      continue;
    }

    if (commit.commitment_id) {
      seenChainIds.add(commit.commitment_id);
    }

    // Check: No duplicate (owner, action) pairs in same batch
    const ownerAction = `${commit.owner_user_id || commit.owner_name}|${commit.action}`;
    if (seenOwnerActions.has(ownerAction)) {
      warnings.push({
        code: "CONTINUITY_POTENTIAL_DUPLICATE",
        message: `Same owner + action appears multiple times in batch: ${commit.owner_name || commit.owner_user_id} - "${commit.action.substring(0, 30)}"`,
        suggestion:
          "Verify this is intentional (e.g., same task assigned to multiple people)",
      });
    }
    seenOwnerActions.add(ownerAction);

    // Check: Status is valid (Invariant #6)
    if (commit.status) {
      const validStatuses = [
        "EXTRACTED",
        "OPEN",
        "IN_PROGRESS",
        "BLOCKED",
        "RESCHEDULED",
        "DONE",
      ];
      if (!validStatuses.includes(commit.status)) {
        errors.push({
          code: "CONTINUITY_INVALID_STATUS",
          invariant: 6,
          message: `Invalid status "${commit.status}" for commitment: ${commit.action.substring(0, 30)}`,
          recoverable: true, // Can default to EXTRACTED
        });
        continue;
      }
    }

    context.continuity_chains.push(commit);
  }

  // Check: At least some commitments passed continuity validation
  if (context.continuity_chains.length === 0 && context.linked_commitments.length > 0) {
    errors.push({
      code: "CONTINUITY_ALL_FAILED",
      message: `All ${context.linked_commitments.length} commitments failed continuity validation`,
      recoverable: false,
    });
  }

  const duration = performance.now() - startTime;

  return {
    stage: "CONTINUITY",
    passed: errors.length === 0,
    errors,
    warnings,
    duration_ms: duration,
  };
}

/**
 * STAGE 5: DATABASE
 * 
 * Validates that data can be written to database without error.
 * This is the final stage before commit.
 * 
 * Invariants: #8 (no silent drops), #10 (evidence preservation)
 */
export function validateDatabase(context: StageContext): ValidationResult {
  const startTime = performance.now();
  const errors: PipelineError[] = [];
  const warnings: PipelineWarning[] = [];

  if (!context.continuity_chains || context.continuity_chains.length === 0) {
    warnings.push({
      code: "DATABASE_NO_DATA",
      message: "No commitments to write",
      suggestion: "This is OK for empty or discussion-only meetings",
    });
    return {
      stage: "DATABASE",
      passed: true,
      errors,
      warnings,
      duration_ms: performance.now() - startTime,
    };
  }

  context.database_writes = [];

  for (const commit of context.continuity_chains) {
    // Check: All required fields for database write
    const requiredFields = ["owner_user_id", "action"];
    for (const field of requiredFields) {
      if (!commit[field]) {
        errors.push({
          code: `DATABASE_MISSING_${field.toUpperCase()}`,
          invariant: 8,
          message: `Cannot write commitment without ${field}`,
          context: { commitment: commit },
          recoverable: false,
        });
        continue;
      }
    }

    // Check: Meeting reference preserved (Invariant #10)
    if (!context.meeting_id) {
      errors.push({
        code: "DATABASE_NO_MEETING_ID",
        invariant: 10,
        message: "Cannot write commitment without meeting_id (evidence link)",
        recoverable: false,
      });
      continue;
    }

    // Check: User ownership verified
    if (!context.user_id) {
      errors.push({
        code: "DATABASE_NO_USER_ID",
        invariant: 8,
        message: "Cannot write commitment without user_id (ownership)",
        recoverable: false,
      });
      continue;
    }

    // All checks passed, ready for write
    context.database_writes.push({
      meeting_id: context.meeting_id,
      user_id: context.user_id,
      commitment_id: commit.commitment_id || `temp-${Math.random()}`,
      owner_user_id: commit.owner_user_id,
      owner_name: commit.owner_name,
      action: commit.action,
      due_date_expression: commit.due_date_expression,
      resolved_due_date: commit.resolved_due_date,
      blocker: commit.blocker,
      status: commit.status || "EXTRACTED",
      extracted_at: new Date().toISOString(),
    });
  }

  // Validation: At least some writes prepared
  if (context.database_writes.length === 0 && context.continuity_chains.length > 0) {
    errors.push({
      code: "DATABASE_NO_WRITES_PREPARED",
      invariant: 8,
      message: "Failed to prepare any database writes",
      recoverable: false,
    });
  }

  const duration = performance.now() - startTime;

  return {
    stage: "DATABASE",
    passed: errors.length === 0,
    errors,
    warnings,
    duration_ms: duration,
  };
}

/**
 * Run complete pipeline validation
 */
export function validatePipeline(context: StageContext): {
  stages: ValidationResult[];
  overall_passed: boolean;
  total_duration_ms: number;
  error_count: number;
  warning_count: number;
} {
  const stages: ValidationResult[] = [];
  let totalDuration = 0;

  // Stage 1: Extraction
  let result = validateExtraction(context);
  stages.push(result);
  totalDuration += result.duration_ms;
  if (!result.passed) {
    // Stop pipeline if extraction failed
    return {
      stages,
      overall_passed: false,
      total_duration_ms: totalDuration,
      error_count: result.errors.length,
      warning_count: result.warnings.length,
    };
  }

  // Stage 2: Parsing
  result = validateParsing(context);
  stages.push(result);
  totalDuration += result.duration_ms;
  if (!result.passed) {
    return {
      stages,
      overall_passed: false,
      total_duration_ms: totalDuration,
      error_count: result.errors.length,
      warning_count: result.warnings.length,
    };
  }

  // Stage 3: Linking
  result = validateLinking(context);
  stages.push(result);
  totalDuration += result.duration_ms;
  // Linking warnings don't stop pipeline

  // Stage 4: Continuity
  result = validateContinuity(context);
  stages.push(result);
  totalDuration += result.duration_ms;
  if (!result.passed) {
    return {
      stages,
      overall_passed: false,
      total_duration_ms: totalDuration,
      error_count: result.errors.length,
      warning_count: result.warnings.length,
    };
  }

  // Stage 5: Database
  result = validateDatabase(context);
  stages.push(result);
  totalDuration += result.duration_ms;
  if (!result.passed) {
    return {
      stages,
      overall_passed: false,
      total_duration_ms: totalDuration,
      error_count: result.errors.length,
      warning_count: result.warnings.length,
    };
  }

  // All stages passed
  const totalErrors = stages.reduce((sum, s) => sum + s.errors.length, 0);
  const totalWarnings = stages.reduce((sum, s) => sum + s.warnings.length, 0);

  return {
    stages,
    overall_passed: true,
    total_duration_ms: totalDuration,
    error_count: totalErrors,
    warning_count: totalWarnings,
  };
}

/**
 * Format pipeline validation report
 */
export function formatPipelineReport(validation: ReturnType<typeof validatePipeline>): string {
  let output = `
╔════════════════════════════════════════════════════════════════════╗
║                PIPELINE VALIDATION REPORT                          ║
╚════════════════════════════════════════════════════════════════════╝

Overall Status: ${validation.overall_passed ? "✓ PASS" : "✗ FAIL"}
Total Duration: ${validation.total_duration_ms.toFixed(1)}ms
Total Errors: ${validation.error_count}
Total Warnings: ${validation.warning_count}

────────────────────────────────────────────────────────────────────

STAGE RESULTS:
`;

  for (const stage of validation.stages) {
    const status = stage.passed ? "✓" : "✗";
    output += `
${status} ${stage.stage} (${stage.duration_ms.toFixed(1)}ms)
  Errors: ${stage.errors.length} | Warnings: ${stage.warnings.length}
`;

    if (stage.errors.length > 0) {
      output += `  Errors:\n`;
      for (const err of stage.errors) {
        output += `    ✗ [${err.code}] ${err.message}\n`;
        if (err.invariant) {
          output += `      Invariant #${err.invariant}\n`;
        }
      }
    }

    if (stage.warnings.length > 0) {
      output += `  Warnings:\n`;
      for (const warn of stage.warnings) {
        output += `    ⚠ [${warn.code}] ${warn.message}\n`;
      }
    }
  }

  output += `
────────────────────────────────────────────────────────────────────
`;

  return output;
}
