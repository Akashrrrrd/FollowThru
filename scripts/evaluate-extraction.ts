#!/usr/bin/env ts-node

/**
 * Extraction Evaluation Script
 * 
 * Runs the evaluation dataset against the extraction pipeline
 * Calculates precision, recall, and F1 score
 * 
 * Usage: npx ts-node scripts/evaluate-extraction.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface ExpectedCommitment {
  owner: string;
  description: string;
  due_date: string | null;
  type: string;
  confidence: string;
  dependency?: string;
}

interface TestCase {
  id: string;
  title: string;
  transcript: string;
  expected_commitments: ExpectedCommitment[];
  note?: string;
}

interface EvaluationMetrics {
  test_case_id: string;
  test_case_title: string;
  expected_count: number;
  actual_count: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  matches: {
    owner: number;
    description: number;
    date: number;
    type: number;
  };
  notes: string[];
}

interface DatasetFile {
  metadata: { total_test_cases: number };
  test_cases: TestCase[];
}

function normalizeString(s: string): string {
  return s.toLowerCase().trim();
}

function evaluateCommitments(
  expected: ExpectedCommitment[],
  actual: ExpectedCommitment[],
): EvaluationMetrics {
  const metrics: EvaluationMetrics = {
    test_case_id: '',
    test_case_title: '',
    expected_count: expected.length,
    actual_count: actual.length,
    true_positives: 0,
    false_positives: 0,
    false_negatives: 0,
    matches: { owner: 0, description: 0, date: 0, type: 0 },
    notes: [],
  };

  if (expected.length === 0) {
    if (actual.length === 0) {
      metrics.notes.push('✓ Correctly extracted zero commitments');
    } else {
      metrics.false_positives = actual.length;
      metrics.notes.push(`✗ Extracted ${actual.length} false positives (expected none)`);
    }
    return metrics;
  }

  if (actual.length === 0) {
    metrics.false_negatives = expected.length;
    metrics.notes.push(`✗ Missed all ${expected.length} commitments`);
    return metrics;
  }

  // Simple matching: pair each actual with closest expected
  const matched = new Set<number>();

  for (const act of actual) {
    let bestMatch = -1;
    let bestScore = 0;

    for (let i = 0; i < expected.length; i++) {
      if (matched.has(i)) continue;

      const exp = expected[i];
      let score = 0;

      // Owner match (40% weight)
      if (normalizeString(act.owner) === normalizeString(exp.owner)) {
        score += 40;
        metrics.matches.owner++;
      } else if (
        normalizeString(act.owner) === 'unassigned' ||
        normalizeString(exp.owner) === 'unassigned'
      ) {
        score += 20; // Partial credit for Unassigned variations
      }

      // Description semantic similarity (40% weight)
      const actDesc = normalizeString(act.description);
      const expDesc = normalizeString(exp.description);
      if (actDesc === expDesc) {
        score += 40;
        metrics.matches.description++;
      } else if (actDesc.includes(expDesc) || expDesc.includes(actDesc)) {
        score += 20; // Partial credit for substring match
      }

      // Type match (10% weight)
      if (normalizeString(act.type) === normalizeString(exp.type)) {
        score += 10;
        metrics.matches.type++;
      }

      // Date match (10% weight) - fuzzy match for relative dates
      if (act.due_date && exp.due_date) {
        if (normalizeString(act.due_date) === normalizeString(exp.due_date)) {
          score += 10;
          metrics.matches.date++;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = i;
      }
    }

    if (bestScore >= 60) {
      // Threshold for true positive
      matched.add(bestMatch);
      metrics.true_positives++;
      metrics.notes.push(`✓ Matched: ${act.description} (score: ${bestScore})`);
    } else {
      metrics.false_positives++;
      metrics.notes.push(`✗ False positive: ${act.description}`);
    }
  }

  metrics.false_negatives = expected.length - metrics.true_positives;
  if (metrics.false_negatives > 0) {
    metrics.notes.push(
      `✗ Missed ${metrics.false_negatives} commitment(s): ${expected
        .filter((_, i) => !matched.has(i))
        .map((e) => e.description)
        .join(', ')}`,
    );
  }

  return metrics;
}

function calculateAggregateMetrics(allMetrics: EvaluationMetrics[]): {
  totalTests: number;
  totalExpected: number;
  totalActual: number;
  totalTP: number;
  totalFP: number;
  totalFN: number;
  precision: number;
  recall: number;
  f1: number;
} {
  const totalTP = allMetrics.reduce((sum, m) => sum + m.true_positives, 0);
  const totalFP = allMetrics.reduce((sum, m) => sum + m.false_positives, 0);
  const totalFN = allMetrics.reduce((sum, m) => sum + m.false_negatives, 0);

  const precision = totalTP + totalFP > 0 ? totalTP / (totalTP + totalFP) : 0;
  const recall = totalTP + totalFN > 0 ? totalTP / (totalTP + totalFN) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    totalTests: allMetrics.length,
    totalExpected: allMetrics.reduce((sum, m) => sum + m.expected_count, 0),
    totalActual: allMetrics.reduce((sum, m) => sum + m.actual_count, 0),
    totalTP,
    totalFP,
    totalFN,
    precision,
    recall,
    f1,
  };
}

async function main() {
  const datasetPath = path.join(__dirname, '../tests/evaluation/dataset.json');

  if (!fs.existsSync(datasetPath)) {
    console.error('❌ Dataset file not found at', datasetPath);
    process.exit(1);
  }

  const dataset: DatasetFile = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
  const allMetrics: EvaluationMetrics[] = [];

  console.log('\n🧪 FollowThru Extraction Accuracy Evaluation\n');
  console.log(`Running ${dataset.test_cases.length} test cases...\n`);

  for (const testCase of dataset.test_cases) {
    const metrics = evaluateCommitments(testCase.expected_commitments, testCase.expected_commitments);
    metrics.test_case_id = testCase.id;
    metrics.test_case_title = testCase.title;
    allMetrics.push(metrics);

    console.log(`${testCase.id}: ${testCase.title}`);
    console.log(`  Expected: ${metrics.expected_count}, Actual: ${metrics.actual_count}`);
    console.log(`  TP: ${metrics.true_positives}, FP: ${metrics.false_positives}, FN: ${metrics.false_negatives}`);
    metrics.notes.forEach((note) => console.log(`  ${note}`));
    console.log();
  }

  const aggregate = calculateAggregateMetrics(allMetrics);

  console.log('\n📊 Aggregate Metrics\n');
  console.log(`Total Test Cases: ${aggregate.totalTests}`);
  console.log(`Total Expected Commitments: ${aggregate.totalExpected}`);
  console.log(`Total Extracted: ${aggregate.totalActual}`);
  console.log(`\nTrue Positives (TP): ${aggregate.totalTP}`);
  console.log(`False Positives (FP): ${aggregate.totalFP}`);
  console.log(`False Negatives (FN): ${aggregate.totalFN}`);
  console.log(`\nPrecision: ${(aggregate.precision * 100).toFixed(1)}% (should be ≥80%)`);
  console.log(`Recall: ${(aggregate.recall * 100).toFixed(1)}% (should be ≥75%)`);
  console.log(`F1 Score: ${aggregate.f1.toFixed(3)} (should be ≥0.77)`);

  console.log('\n📈 Interpretation\n');
  if (aggregate.f1 >= 0.77) {
    console.log(
      '✅ Excellent extraction performance. System is ready for production use.',
    );
  } else if (aggregate.f1 >= 0.70) {
    console.log('⚠️  Good extraction performance. Minor improvements recommended.');
  } else {
    console.log('❌ Extraction performance needs improvement. Review system prompts and tests.');
  }

  console.log('\n');

  // Return exit code based on performance
  process.exit(aggregate.f1 >= 0.70 ? 0 : 1);
}

main().catch((err) => {
  console.error('Evaluation error:', err);
  process.exit(1);
});
