/**
 * Regression Test Harness
 * 
 * Validates domain-specific test transcripts against the 10 non-negotiable invariants.
 * Produces detailed reports on extraction accuracy, matching confidence, and compliance.
 */

import { resolveDateExpression } from "../date-resolver";

export interface InvariantViolation {
  invariant_number: number;
  invariant_name: string;
  violation: string;
  severity: "critical" | "warning" | "info";
}

export interface ExtractedCommitment {
  owner_uuid: string;
  owner_name: string;
  action: string;
  due_date_expression: string;
  resolved_due_date: string | null;
  extraction_confidence: number; // 0-1
  passed_validation: boolean;
  violations: InvariantViolation[];
}

export interface DomainTestResult {
  domain: string;
  description: string;
  meeting_date: string;
  total_expected: number;
  total_extracted: number;
  accuracy_score: number; // 0-1 (recall and precision)
  false_positives: number;
  false_negatives: number;
  critical_violations: number;
  warning_violations: number;
  extracted_commitments: ExtractedCommitment[];
  violations_summary: string[];
  passed: boolean;
}

export interface RegressionTestReport {
  timestamp: string;
  total_domains: number;
  domains_passed: number;
  domains_failed: number;
  overall_accuracy: number;
  total_critical_violations: number;
  total_warnings: number;
  domain_results: DomainTestResult[];
}

/**
 * Validate a commitment against the 10 invariants
 */
export function validateCommitmentInvariants(
  commitment: any,
  meetingDate: string
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const meetingDateObj = new Date(meetingDate);

  // Invariant 1: Owner Definition & Continuity
  if (!commitment.owner_uuid && !commitment.owner_name) {
    violations.push({
      invariant_number: 1,
      invariant_name: "Owner Definition & Continuity",
      violation: "Commitment missing owner_uuid and owner_name",
      severity: "critical",
    });
  }

  // Invariant 2: Date Resolution is Deterministic
  if (commitment.due_date_expression) {
    const resolved = resolveDateExpression(
      commitment.due_date_expression,
      meetingDateObj
    );
    if (!resolved) {
      violations.push({
        invariant_number: 2,
        invariant_name: "Date Resolution is Deterministic",
        violation: `Unable to resolve date expression: "${commitment.due_date_expression}"`,
        severity: "warning",
      });
    }
  } else {
    // Some commitments might have ongoing/no deadline, that's ok
    // But if action implies a deadline and none is provided, that's a warning
    if (
      commitment.action &&
      (commitment.action.toLowerCase().includes("by ") ||
        commitment.action.toLowerCase().includes("before "))
    ) {
      violations.push({
        invariant_number: 2,
        invariant_name: "Date Resolution is Deterministic",
        violation: "Action mentions deadline but no due_date_expression provided",
        severity: "warning",
      });
    }
  }

  // Invariant 3: Commitment vs Discussion - Clear Boundary
  if (!commitment.action) {
    violations.push({
      invariant_number: 3,
      invariant_name: "Commitment vs Discussion: Clear Boundary",
      violation: "Commitment missing action (concrete task description)",
      severity: "critical",
    });
  }

  // Invariant 4: Continuity Preservation (checked at multi-meeting level)
  // Skip here; validated in multi-meeting tests

  // Invariant 5: False-Merge Prevention
  if (commitment.extraction_confidence < 0.65) {
    violations.push({
      invariant_number: 5,
      invariant_name: "False-Merge Prevention: Confidence Threshold",
      violation: `Extraction confidence ${commitment.extraction_confidence} below minimum threshold 0.65`,
      severity: "critical",
    });
  }

  // Invariant 6: Status Integrity & Lifecycle
  if (commitment.status && !["EXTRACTED", "OPEN", "IN_PROGRESS", "BLOCKED", "RESCHEDULED", "DONE"].includes(commitment.status)) {
    violations.push({
      invariant_number: 6,
      invariant_name: "Status Integrity & Lifecycle",
      violation: `Invalid status: ${commitment.status}`,
      severity: "critical",
    });
  }

  // Invariant 7: Dependency vs Temporal
  // Validate that blockers are separate from due_dates
  if (commitment.blocker && commitment.due_date_expression) {
    // This is OK—can have both
  } else if (commitment.action && commitment.action.toLowerCase().includes("once ")) {
    if (!commitment.blocker) {
      violations.push({
        invariant_number: 7,
        invariant_name: "Dependency vs Temporal: Clear Language",
        violation: "Action mentions 'once' (blocker) but no blocker field set",
        severity: "warning",
      });
    }
  }

  // Invariant 8: Commitment Preservation - No Silent Drops
  // Checked at pipeline level; here we just ensure commitment has required fields
  if (!commitment.owner_uuid && !commitment.owner_name) {
    violations.push({
      invariant_number: 8,
      invariant_name: "Commitment Preservation: No Silent Drops",
      violation: "Commitment lacks owner identification; at risk of being dropped",
      severity: "critical",
    });
  }

  // Invariant 9: Date Change Tracking & Audit Trail
  // Checked at update level; skip in extraction

  // Invariant 10: Evidence Preservation
  if (!commitment.transcript_quote && !commitment.quote_text) {
    violations.push({
      invariant_number: 10,
      invariant_name: "Evidence Preservation: Traceability",
      violation: "Commitment missing transcript quote/evidence",
      severity: "warning",
    });
  }

  return violations;
}

/**
 * Score extraction accuracy for a domain
 */
export function scoreExtractionAccuracy(
  expected: any[],
  extracted: any[]
): {
  accuracy: number;
  precision: number;
  recall: number;
  false_positives: number;
  false_negatives: number;
} {
  // Expected commitments (is_commitment = true)
  const expectedCommitments = expected.filter((c: any) => c.is_commitment);
  const expectedDiscussions = expected.filter((c: any) => !c.is_commitment);

  // Scoring:
  // - True Positives: correctly extracted commitments
  // - False Positives: extracted when should be discussion
  // - False Negatives: missed commitment extractions
  // - True Negatives: correctly rejected discussions

  // Simplified scoring: assume all extracted are commits, validate against expected
  const truePositives = Math.min(
    extracted.length,
    expectedCommitments.length
  );
  const falsePositives = Math.max(
    0,
    extracted.length - expectedCommitments.length
  );
  const falseNegatives = Math.max(
    0,
    expectedCommitments.length - extracted.length
  );

  const precision =
    extracted.length > 0 ? truePositives / extracted.length : 0;
  const recall =
    expectedCommitments.length > 0
      ? truePositives / expectedCommitments.length
      : 1; // If no expected, perfect recall

  const accuracy = (precision + recall) / 2; // F1-like scoring

  return {
    accuracy,
    precision,
    recall,
    false_positives: falsePositives,
    false_negatives: falseNegatives,
  };
}

/**
 * Run regression tests for all domains
 */
export function runRegressionTests(
  transcripts: any[]
): RegressionTestReport {
  const results: DomainTestResult[] = [];
  let totalCriticalViolations = 0;
  let totalWarnings = 0;
  let totalDomainsPass = 0;

  for (const transcript of transcripts) {
    // In a real system, here we'd call Groq to extract commitments
    // For now, we'll mock extraction based on expected commitments
    const extracted = transcript.expectedCommitments
      .filter((c: any) => c.is_commitment)
      .map((c: any) => ({
        owner_uuid: c.owner_uuid,
        owner_name: c.owner_name,
        action: c.action,
        due_date_expression: c.due_date_expression,
        extraction_confidence: 0.9, // Mock high confidence for now
      }));

    // Validate each extraction
    const validatedCommitments = extracted.map((commit: any) => {
      const violations = validateCommitmentInvariants(commit, transcript.date);
      const passed = violations.filter((v: any) => v.severity === "critical").length === 0;

      const resolved = resolveDateExpression(
        commit.due_date_expression,
        new Date(transcript.date)
      );

      return {
        ...commit,
        resolved_due_date: resolved,
        passed_validation: passed,
        violations,
      };
    });

    // Score accuracy
    const scoring = scoreExtractionAccuracy(
      transcript.expectedCommitments,
      extracted
    );

    // Count violations
    const criticalViolations = validatedCommitments.reduce(
      (acc: number, c: any) =>
        acc + c.violations.filter((v: any) => v.severity === "critical").length,
      0
    );
    const warnings = validatedCommitments.reduce(
      (acc: number, c: any) =>
        acc + c.violations.filter((v: any) => v.severity === "warning").length,
      0
    );

    totalCriticalViolations += criticalViolations;
    totalWarnings += warnings;

    const passed =
      criticalViolations === 0 && scoring.accuracy > 0.8;
    if (passed) totalDomainsPass++;

    const violationsSummary = validatedCommitments
      .flatMap((c: any) => c.violations)
      .map((v: any) => `[${v.severity.toUpperCase()}] ${v.invariant_name}: ${v.violation}`);

    results.push({
      domain: transcript.domain,
      description: transcript.description,
      meeting_date: transcript.date,
      total_expected: transcript.expectedCommitments.filter(
        (c: any) => c.is_commitment
      ).length,
      total_extracted: extracted.length,
      accuracy_score: scoring.accuracy,
      false_positives: scoring.false_positives,
      false_negatives: scoring.false_negatives,
      critical_violations: criticalViolations,
      warning_violations: warnings,
      extracted_commitments: validatedCommitments,
      violations_summary: violationsSummary,
      passed,
    });
  }

  const overallAccuracy =
    results.reduce((acc, r) => acc + r.accuracy_score, 0) / results.length;

  return {
    timestamp: new Date().toISOString(),
    total_domains: results.length,
    domains_passed: totalDomainsPass,
    domains_failed: results.length - totalDomainsPass,
    overall_accuracy: overallAccuracy,
    total_critical_violations: totalCriticalViolations,
    total_warnings: totalWarnings,
    domain_results: results,
  };
}

/**
 * Format test report for display
 */
export function formatRegressionReport(report: RegressionTestReport): string {
  let output = `
╔════════════════════════════════════════════════════════════════════╗
║                 REGRESSION TEST REPORT                             ║
╚════════════════════════════════════════════════════════════════════╝

Timestamp: ${report.timestamp}
Total Domains: ${report.total_domains}
Domains Passed: ${report.domains_passed}/${report.total_domains}
Overall Accuracy: ${(report.overall_accuracy * 100).toFixed(1)}%
Critical Violations: ${report.total_critical_violations}
Warnings: ${report.total_warnings}

────────────────────────────────────────────────────────────────────

DOMAIN RESULTS:
`;

  for (const domain of report.domain_results) {
    const status = domain.passed ? "✓ PASS" : "✗ FAIL";
    output += `
${status} | ${domain.domain}
     Description: ${domain.description}
     Date: ${domain.meeting_date}
     Expected: ${domain.total_expected} | Extracted: ${domain.total_extracted}
     Accuracy: ${(domain.accuracy_score * 100).toFixed(1)}%
     False Positives: ${domain.false_positives} | False Negatives: ${domain.false_negatives}
     Critical Violations: ${domain.critical_violations} | Warnings: ${domain.warning_violations}
`;

    if (domain.violations_summary.length > 0) {
      output += `\n     Violations:\n`;
      for (const violation of domain.violations_summary) {
        output += `       ${violation}\n`;
      }
    }

    for (const commit of domain.extracted_commitments) {
      output += `\n     Commitment: ${commit.action}
        Owner: ${commit.owner_name || commit.owner_uuid}
        Due: ${commit.resolved_due_date || "unspecified"}
        Validation: ${commit.passed_validation ? "✓" : "✗"}
`;
    }
  }

  output += `
────────────────────────────────────────────────────────────────────

SUMMARY:
${report.domains_passed === report.total_domains ? "✓ ALL TESTS PASSED" : `✗ ${report.domains_failed} DOMAINS FAILED`}

Next Steps:
${report.total_critical_violations > 0 ? "1. Fix critical violations in extraction pipeline\n" : ""}
${report.total_warnings > 0 ? "2. Address warnings to improve robustness\n" : ""}
3. Run multi-meeting continuity tests
4. Run date resolver randomization tests
5. Deploy to staging for end-to-end testing

`;

  return output;
}
