/**
 * Unified validation runner.
 *
 * Runs every configuration validator in this repository in a single pass and
 * produces one consolidated report:
 *
 *   - Label definitions   (`.github/labels.yml`)           — Requirements 11.4
 *   - Issue templates      (`.github/ISSUE_TEMPLATE/`)      — Requirement 6.4
 *   - Funding config       (`FUNDING.yml`)                  — Requirement 4.5
 *   - Workflow templates   (`workflow-templates/`)          — Requirement 10.7
 *   - Label definitions file parse/shape                    — Requirement 13.6
 *
 * Each validator reuses the exported, file-reading entry point from its own
 * module so this runner applies the exact same rules as the standalone
 * validators. Every validator runs regardless of whether an earlier one failed,
 * so a single bad file never masks problems elsewhere; the individual
 * {@link ValidationResult}s are then aggregated into a consolidated report.
 *
 * The module exports {@link validateAll} (returning the structured results) and
 * {@link formatConsolidatedReport} so it can be reused and tested. When executed
 * directly via ts-node it validates the repository's configuration files and
 * exits with a non-zero status code if ANY validator fails.
 */

import { ValidationResult } from "./types";
import { validateLabelsFile, DEFAULT_LABELS_PATH } from "./validate-labels";
import {
  validateTemplatesDir,
  DEFAULT_TEMPLATE_DIR,
} from "./validate-templates";
import { validateFundingFile, DEFAULT_FUNDING_PATH } from "./validate-funding";
import {
  validateWorkflowsDir,
  DEFAULT_WORKFLOW_TEMPLATES_DIR,
} from "./validate-workflows";

/** A single named validator's outcome within the consolidated run. */
export interface NamedValidationResult {
  /** Human-readable name of the validator (e.g. "Label definitions"). */
  name: string;
  /** The file or directory that was validated. */
  target: string;
  /** The result produced by the validator. */
  result: ValidationResult;
}

/** The consolidated outcome of running every validator. */
export interface ConsolidatedReport {
  /** Per-validator results in the order they were run. */
  results: NamedValidationResult[];
  /** True only when every validator passed (no errors anywhere). */
  valid: boolean;
  /** Total number of errors across all validators. */
  errorCount: number;
  /** Total number of warnings across all validators. */
  warningCount: number;
}

/** Optional overrides for the paths each validator inspects (used by tests). */
export interface ValidateAllOptions {
  labelsPath?: string;
  templatesDir?: string;
  fundingPath?: string;
  workflowTemplatesDir?: string;
}

/**
 * Run every configuration validator and collect the results.
 *
 * Each validator is invoked independently; a failure in one does not prevent
 * the others from running, so the consolidated report always reflects the full
 * state of the repository's configuration.
 *
 * @param options Optional path overrides (defaults match the standalone
 *                validators' defaults).
 * @returns The {@link ConsolidatedReport} aggregating every validator's result.
 */
export function validateAll(options: ValidateAllOptions = {}): ConsolidatedReport {
  const labelsPath = options.labelsPath ?? DEFAULT_LABELS_PATH;
  const templatesDir = options.templatesDir ?? DEFAULT_TEMPLATE_DIR;
  const fundingPath = options.fundingPath ?? DEFAULT_FUNDING_PATH;
  const workflowTemplatesDir =
    options.workflowTemplatesDir ?? DEFAULT_WORKFLOW_TEMPLATES_DIR;

  const results: NamedValidationResult[] = [
    {
      name: "Label definitions",
      target: labelsPath,
      result: validateLabelsFile(labelsPath),
    },
    {
      name: "Issue templates",
      target: templatesDir,
      result: validateTemplatesDir(templatesDir),
    },
    {
      name: "Funding configuration",
      target: fundingPath,
      result: validateFundingFile(fundingPath),
    },
    {
      name: "Workflow templates",
      target: workflowTemplatesDir,
      result: validateWorkflowsDir(workflowTemplatesDir),
    },
  ];

  let errorCount = 0;
  let warningCount = 0;
  for (const { result } of results) {
    errorCount += result.errors.length;
    warningCount += result.warnings.length;
  }

  return {
    results,
    valid: results.every(({ result }) => result.valid),
    errorCount,
    warningCount,
  };
}

/**
 * Format a {@link ConsolidatedReport} into a human-readable, multi-line report.
 *
 * Lists each validator's status followed by its individual errors and warnings,
 * and finishes with an overall summary line.
 */
export function formatConsolidatedReport(report: ConsolidatedReport): string {
  const lines: string[] = [];
  lines.push("Consolidated validation report");
  lines.push("==============================");

  for (const { name, target, result } of report.results) {
    if (result.valid) {
      lines.push(`\u2713 ${name} (${target}): valid.`);
    } else {
      lines.push(
        `\u2717 ${name} (${target}): ${result.errors.length} error(s).`,
      );
    }
    for (const error of result.errors) {
      lines.push(`    error: ${error}`);
    }
    for (const warning of result.warnings) {
      lines.push(`    warning: ${warning}`);
    }
  }

  lines.push("");
  if (report.valid) {
    lines.push(
      `\u2713 All validators passed` +
        (report.warningCount > 0
          ? ` (${report.warningCount} warning(s)).`
          : "."),
    );
  } else {
    lines.push(
      `\u2717 Validation failed: ${report.errorCount} error(s), ` +
        `${report.warningCount} warning(s) across ` +
        `${report.results.length} validator(s).`,
    );
  }

  return lines.join("\n");
}

// When run directly (ts-node scripts/validate-all.ts), validate every
// configuration file and exit with a non-zero status if ANY validator fails.
if (require.main === module) {
  const report = validateAll();
  // eslint-disable-next-line no-console
  console.log(formatConsolidatedReport(report));
  process.exit(report.valid ? 0 : 1);
}
