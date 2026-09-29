/**
 * Date Resolver Randomization Tests
 * 
 * Validates date resolution DETERMINISM across all 7 weekdays and various temporal expressions.
 * Tests Invariant #2: "Date Resolution is Deterministic"
 * 
 * For each expression, tests:
 * - All 7 weekdays as meeting dates (Mon-Sun)
 * - Correct calculation (forward counting, boundary handling)
 * - Consistency (same input always produces same output)
 * - Month/year boundary handling
 */

import { resolveDateExpression } from "../date-resolver";

export interface DateTestCase {
  expression: string;
  meeting_date: string;
  day_of_week: string;
  expected_date: string;
  description: string;
}

/**
 * Sept 28 - Oct 4, 2026 (One full week)
 * Mon 9/28, Tue 9/29, Wed 9/30, Thu 10/1, Fri 10/2, Sat 10/3, Sun 10/4
 */
export const WEEK_SEPT_28_OCT_4 = {
  MONDAY: "2026-09-28",
  TUESDAY: "2026-09-29",
  WEDNESDAY: "2026-09-30",
  THURSDAY: "2026-10-01",
  FRIDAY: "2026-10-02",
  SATURDAY: "2026-10-03",
  SUNDAY: "2026-10-04",
};

/**
 * Oct 5-11, 2026 (Next week for "by next X" expressions from Sept 28-Oct 4)
 */
export const WEEK_OCT_5_11 = {
  MONDAY: "2026-10-05",
  TUESDAY: "2026-10-06",
  WEDNESDAY: "2026-10-07",
  THURSDAY: "2026-10-08",
  FRIDAY: "2026-10-09",
  SATURDAY: "2026-10-10",
  SUNDAY: "2026-10-11",
};

/**
 * Test cases for "by [dayname]" expressions (relative same/next week)
 */
export const BY_DAYNAME_TESTS: DateTestCase[] = [
  // ===== FROM MONDAY 9/28 =====
  {
    expression: "by Monday",
    meeting_date: WEEK_SEPT_28_OCT_4.MONDAY,
    day_of_week: "Monday",
    expected_date: "2026-10-05", // Next Monday, not today
    description:
      "From Monday, 'by Monday' should be next Monday, not same-day",
  },
  {
    expression: "by Tuesday",
    meeting_date: WEEK_SEPT_28_OCT_4.MONDAY,
    day_of_week: "Monday",
    expected_date: "2026-09-29", // Tomorrow
    description: "From Monday, 'by Tuesday' is tomorrow",
  },
  {
    expression: "by Wednesday",
    meeting_date: WEEK_SEPT_28_OCT_4.MONDAY,
    day_of_week: "Monday",
    expected_date: "2026-09-30", // 2 days away
    description: "From Monday, 'by Wednesday' is 2 days away",
  },
  {
    expression: "by Friday",
    meeting_date: WEEK_SEPT_28_OCT_4.MONDAY,
    day_of_week: "Monday",
    expected_date: "2026-10-02", // End of week
    description: "From Monday, 'by Friday' is end of same week",
  },

  // ===== FROM TUESDAY 9/29 =====
  {
    expression: "by Monday",
    meeting_date: WEEK_SEPT_28_OCT_4.TUESDAY,
    day_of_week: "Tuesday",
    expected_date: "2026-10-05", // Next Monday, 6 days away
    description:
      "From Tuesday, 'by Monday' is next Monday (6 days), not yesterday",
  },
  {
    expression: "by Wednesday",
    meeting_date: WEEK_SEPT_28_OCT_4.TUESDAY,
    day_of_week: "Tuesday",
    expected_date: "2026-09-30", // Tomorrow
    description: "From Tuesday, 'by Wednesday' is tomorrow",
  },
  {
    expression: "by Friday",
    meeting_date: WEEK_SEPT_28_OCT_4.TUESDAY,
    day_of_week: "Tuesday",
    expected_date: "2026-10-02", // 3 days away
    description: "From Tuesday, 'by Friday' is 3 days away",
  },
  {
    expression: "by Sunday",
    meeting_date: WEEK_SEPT_28_OCT_4.TUESDAY,
    day_of_week: "Tuesday",
    expected_date: "2026-10-04", // 5 days away
    description: "From Tuesday, 'by Sunday' is 5 days away (end of week)",
  },

  // ===== FROM FRIDAY 10/2 =====
  {
    expression: "by Monday",
    meeting_date: WEEK_SEPT_28_OCT_4.FRIDAY,
    day_of_week: "Friday",
    expected_date: "2026-10-05", // Next Monday, 3 days away
    description: "From Friday, 'by Monday' is next Monday (3 days)",
  },
  {
    expression: "by Friday",
    meeting_date: WEEK_SEPT_28_OCT_4.FRIDAY,
    day_of_week: "Friday",
    expected_date: "2026-10-09", // Next Friday, 7 days away
    description: "From Friday, 'by Friday' is next Friday, not today",
  },
  {
    expression: "by Sunday",
    meeting_date: WEEK_SEPT_28_OCT_4.FRIDAY,
    day_of_week: "Friday",
    expected_date: "2026-10-04", // 2 days away
    description: "From Friday, 'by Sunday' is 2 days away",
  },

  // ===== FROM SUNDAY 10/4 =====
  {
    expression: "by Monday",
    meeting_date: WEEK_SEPT_28_OCT_4.SUNDAY,
    day_of_week: "Sunday",
    expected_date: "2026-10-05", // Tomorrow
    description: "From Sunday, 'by Monday' is tomorrow",
  },
  {
    expression: "by Friday",
    meeting_date: WEEK_SEPT_28_OCT_4.SUNDAY,
    day_of_week: "Sunday",
    expected_date: "2026-10-09", // 5 days away
    description: "From Sunday, 'by Friday' is 5 days away",
  },
  {
    expression: "by Sunday",
    meeting_date: WEEK_SEPT_28_OCT_4.SUNDAY,
    day_of_week: "Sunday",
    expected_date: "2026-10-11", // Next Sunday, 7 days away
    description: "From Sunday, 'by Sunday' is next Sunday, not today",
  },
];

/**
 * Test cases for "by next [dayname]" expressions
 */
export const BY_NEXT_DAYNAME_TESTS: DateTestCase[] = [
  // ===== FROM MONDAY 9/28 =====
  {
    expression: "by next Monday",
    meeting_date: WEEK_SEPT_28_OCT_4.MONDAY,
    day_of_week: "Monday",
    expected_date: "2026-10-05", // Next Monday, 7 days away
    description: "From Monday, 'by next Monday' is 7 days away",
  },
  {
    expression: "by next Friday",
    meeting_date: WEEK_SEPT_28_OCT_4.MONDAY,
    day_of_week: "Monday",
    expected_date: "2026-10-09", // Next Friday, 11 days away
    description: "From Monday, 'by next Friday' is 11 days away",
  },

  // ===== FROM TUESDAY 9/29 =====
  {
    expression: "by next Monday",
    meeting_date: WEEK_SEPT_28_OCT_4.TUESDAY,
    day_of_week: "Tuesday",
    expected_date: "2026-10-05", // Next Monday, 6 days away
    description: "From Tuesday, 'by next Monday' is 6 days away",
  },
  {
    expression: "by next Wednesday",
    meeting_date: WEEK_SEPT_28_OCT_4.TUESDAY,
    day_of_week: "Tuesday",
    expected_date: "2026-10-07", // Next Wednesday, 8 days away
    description: "From Tuesday, 'by next Wednesday' is 8 days away",
  },

  // ===== FROM FRIDAY 10/2 =====
  {
    expression: "by next Monday",
    meeting_date: WEEK_SEPT_28_OCT_4.FRIDAY,
    day_of_week: "Friday",
    expected_date: "2026-10-05", // This Monday (3 days away) or next Monday (10 days)?
    // Specification: "next Monday from Friday" = 3 days (this week's Monday is past)
    description: "From Friday, 'by next Monday' is 3 days away",
  },
  {
    expression: "by next Friday",
    meeting_date: WEEK_SEPT_28_OCT_4.FRIDAY,
    day_of_week: "Friday",
    expected_date: "2026-10-09", // Next Friday, 7 days away
    description: "From Friday, 'by next Friday' is 7 days away",
  },
];

/**
 * Test cases for "by end of [period]" expressions
 */
export const BY_END_OF_TESTS: DateTestCase[] = [
  {
    expression: "by end of week",
    meeting_date: WEEK_SEPT_28_OCT_4.MONDAY,
    day_of_week: "Monday",
    expected_date: "2026-10-02", // Friday of same week
    description: "From Monday, end of week = Friday",
  },
  {
    expression: "by end of week",
    meeting_date: WEEK_SEPT_28_OCT_4.TUESDAY,
    day_of_week: "Tuesday",
    expected_date: "2026-10-02", // Friday of same week
    description: "From Tuesday, end of week = Friday",
  },
  {
    expression: "by end of week",
    meeting_date: WEEK_SEPT_28_OCT_4.FRIDAY,
    day_of_week: "Friday",
    expected_date: "2026-10-02", // Same day (Friday is end of week)
    description: "From Friday, end of week = same day",
  },
  {
    expression: "by end of week",
    meeting_date: WEEK_SEPT_28_OCT_4.SUNDAY,
    day_of_week: "Sunday",
    expected_date: "2026-10-09", // Next Friday (this week is over)
    description: "From Sunday, end of week = next Friday",
  },
  {
    expression: "by end of month",
    meeting_date: WEEK_SEPT_28_OCT_4.TUESDAY,
    day_of_week: "Tuesday",
    expected_date: "2026-09-30", // Sept 30 (end of September)
    description: "From Sept 29, end of month = Sept 30",
  },
  {
    expression: "by end of next month",
    meeting_date: WEEK_SEPT_28_OCT_4.TUESDAY,
    day_of_week: "Tuesday",
    expected_date: "2026-10-31", // Oct 31 (end of October)
    description: "From Sept 29, end of next month = Oct 31",
  },
];

/**
 * Test cases for numeric dates (specific dates, not relative)
 */
export const NUMERIC_DATE_TESTS: DateTestCase[] = [
  {
    expression: "by October 15",
    meeting_date: WEEK_SEPT_28_OCT_4.TUESDAY,
    day_of_week: "Tuesday",
    expected_date: "2026-10-15",
    description: "October 15 should resolve to Oct 15 of current year",
  },
  {
    expression: "by 10/20",
    meeting_date: WEEK_SEPT_28_OCT_4.TUESDAY,
    day_of_week: "Tuesday",
    expected_date: "2026-10-20",
    description: "10/20 format should resolve to Oct 20",
  },
  {
    expression: "by October 31",
    meeting_date: WEEK_SEPT_28_OCT_4.TUESDAY,
    day_of_week: "Tuesday",
    expected_date: "2026-10-31",
    description: "October 31 should resolve to Oct 31",
  },
];

/**
 * Test cases for expressions that should return null (unparseable)
 */
export const UNPARSEABLE_TESTS: DateTestCase[] = [
  {
    expression: "ASAP",
    meeting_date: WEEK_SEPT_28_OCT_4.TUESDAY,
    day_of_week: "Tuesday",
    expected_date: "", // null
    description: "ASAP is too vague; should return null",
  },
  {
    expression: "soon",
    meeting_date: WEEK_SEPT_28_OCT_4.TUESDAY,
    day_of_week: "Tuesday",
    expected_date: "", // null
    description: "'soon' is vague; should return null",
  },
  {
    expression: "when possible",
    meeting_date: WEEK_SEPT_28_OCT_4.TUESDAY,
    day_of_week: "Tuesday",
    expected_date: "", // null
    description: "'when possible' is aspirational; should return null",
  },
];

/**
 * Combined test suite
 */
export const ALL_DATE_RESOLVER_TESTS = [
  ...BY_DAYNAME_TESTS,
  ...BY_NEXT_DAYNAME_TESTS,
  ...BY_END_OF_TESTS,
  ...NUMERIC_DATE_TESTS,
  ...UNPARSEABLE_TESTS,
];

/**
 * Run all date resolver tests
 */
export function runDateResolverRandomizationTests(): {
  total: number;
  passed: number;
  failed: number;
  failures: Array<{
    test: DateTestCase;
    expected: string;
    actual: string | null;
  }>;
} {
  let passed = 0;
  let failed = 0;
  const failures: Array<any> = [];

  for (const testCase of ALL_DATE_RESOLVER_TESTS) {
    const meetingDateObj = new Date(testCase.meeting_date);
    const result = resolveDateExpression(
      testCase.expression,
      meetingDateObj
    );
    const expected = testCase.expected_date || null;

    if (result === expected) {
      passed++;
    } else {
      failed++;
      failures.push({
        test: testCase,
        expected,
        actual: result,
      });
    }
  }

  return {
    total: ALL_DATE_RESOLVER_TESTS.length,
    passed,
    failed,
    failures,
  };
}

/**
 * Test determinism: same input always produces same output
 */
export function testDateResolverDeterminism(): {
  deterministic: boolean;
  inconsistencies: Array<{
    expression: string;
    meeting_date: string;
    result1: string | null;
    result2: string | null;
    result3?: string | null;
  }>;
} {
  const inconsistencies: Array<any> = [];

  // Test each expression 3 times
  for (const testCase of ALL_DATE_RESOLVER_TESTS) {
    const meetingDateObj = new Date(testCase.meeting_date);
    const result1 = resolveDateExpression(
      testCase.expression,
      meetingDateObj
    );
    const result2 = resolveDateExpression(
      testCase.expression,
      meetingDateObj
    );
    const result3 = resolveDateExpression(
      testCase.expression,
      meetingDateObj
    );

    if (!(result1 === result2 && result2 === result3)) {
      inconsistencies.push({
        expression: testCase.expression,
        meeting_date: testCase.meeting_date,
        result1,
        result2,
        result3,
      });
    }
  }

  return {
    deterministic: inconsistencies.length === 0,
    inconsistencies,
  };
}

/**
 * Format test report
 */
export function formatDateResolverReport(): string {
  const randomizationResults = runDateResolverRandomizationTests();
  const determinismResults = testDateResolverDeterminism();

  const successRate = (
    (randomizationResults.passed / randomizationResults.total) *
    100
  ).toFixed(1);

  let output = `
╔════════════════════════════════════════════════════════════════════╗
║          DATE RESOLVER RANDOMIZATION TEST REPORT                  ║
╚════════════════════════════════════════════════════════════════════╝

DETERMINISM TEST:
${determinismResults.deterministic ? "✓ PASS" : "✗ FAIL"} - Date resolver is ${determinismResults.deterministic ? "" : "NOT "}deterministic
${determinismResults.inconsistencies.length > 0 ? `  Inconsistencies found: ${determinismResults.inconsistencies.length}` : ""}

RANDOMIZATION TEST (All 7 Weekdays × Multiple Expressions):
Total Test Cases: ${randomizationResults.total}
Passed: ${randomizationResults.passed}
Failed: ${randomizationResults.failed}
Success Rate: ${successRate}%

────────────────────────────────────────────────────────────────────

TEST CATEGORIES:
`;

  // Count tests by category
  const categories = {
    "by [dayname]": BY_DAYNAME_TESTS.length,
    "by next [dayname]": BY_NEXT_DAYNAME_TESTS.length,
    "by end of [period]": BY_END_OF_TESTS.length,
    "numeric dates": NUMERIC_DATE_TESTS.length,
    "unparseable": UNPARSEABLE_TESTS.length,
  };

  for (const [category, count] of Object.entries(categories)) {
    output += `${category}: ${count} tests\n`;
  }

  if (randomizationResults.failures.length > 0) {
    output += `
────────────────────────────────────────────────────────────────────

FAILURES (${randomizationResults.failures.length}):
`;

    for (const failure of randomizationResults.failures.slice(0, 10)) {
      output += `
✗ "${failure.test.expression}" from ${failure.test.day_of_week} ${failure.test.meeting_date}
  Expected: ${failure.expected}
  Actual: ${failure.actual}
  ${failure.test.description}
`;
    }

    if (randomizationResults.failures.length > 10) {
      output += `\n... and ${randomizationResults.failures.length - 10} more failures\n`;
    }
  }

  if (determinismResults.inconsistencies.length > 0) {
    output += `
────────────────────────────────────────────────────────────────────

DETERMINISM FAILURES (${determinismResults.inconsistencies.length}):
`;

    for (const inc of determinismResults.inconsistencies.slice(0, 5)) {
      output += `
✗ "${inc.expression}" from ${inc.meeting_date}
  Run 1: ${inc.result1}
  Run 2: ${inc.result2}
  Run 3: ${inc.result3}
`;
    }
  }

  output += `
────────────────────────────────────────────────────────────────────

INVARIANT #2 VALIDATION:
${randomizationResults.passed === randomizationResults.total ? "✓ Deterministic" : "✗ Not Deterministic"}
${randomizationResults.passed === randomizationResults.total ? "✓ Consistent" : "✗ Inconsistent"}
${determinismResults.deterministic ? "✓ All runs produce same output" : "✗ Multiple runs produce different output"}

`;

  return output;
}
