/**
 * Shared TypeScript types and interfaces for the .github repository
 * validation and sync scripts.
 *
 * These types describe the parsed shape of the various YAML/JSON configuration
 * files in this repository and the common result shape returned by validators.
 */

/**
 * A single canonical label definition as declared in `.github/labels.yml`.
 *
 * - `name`        canonical label name (required)
 * - `color`       6-character hex color WITHOUT a leading '#' (required),
 *                 must match `^[0-9a-fA-F]{6}$`
 * - `description` short human-readable description (required)
 * - `aliases`     previous names to rename from (optional, max 10 per label)
 */
export interface LabelDefinition {
  name: string;
  color: string;
  description: string;
  aliases?: string[];
}

/**
 * An external contact link entry in `.github/ISSUE_TEMPLATE/config.yml`.
 */
export interface ContactLink {
  name: string;
  url: string;
  about: string;
}

/**
 * A GitHub Issue Forms template (`.github/ISSUE_TEMPLATE/*.yml`).
 */
export interface IssueTemplate {
  name: string;
  description: string;
  title?: string;
  labels?: string[];
  assignees?: string[];
  body: unknown[];
}

/**
 * The metadata file accompanying a workflow template
 * (`workflow-templates/{name}.properties.json`).
 */
export interface WorkflowProperties {
  name: string;
  description: string;
  iconName: string;
  categories: string[];
  filePatterns?: string[];
}

/**
 * The funding configuration file (`FUNDING.yml`).
 */
export interface FundingConfig {
  github?: string | string[];
  open_collective?: string;
  ko_fi?: string;
  custom?: string | string[];
  [platform: string]: unknown;
}

/**
 * The common result shape returned by every validator in this repository.
 *
 * - `valid`    true only when there are no errors
 * - `errors`   human-readable error messages describing hard failures
 * - `warnings` non-fatal advisories that do not invalidate the file
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Create an empty, passing {@link ValidationResult}.
 */
export function emptyValidationResult(): ValidationResult {
  return { valid: true, errors: [], warnings: [] };
}

/**
 * Type guard: narrows an unknown value to a non-null plain object.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Type guard: narrows an unknown value to a non-empty string.
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/* -------------------------------------------------------------------------- */
/* Label synchronization types                                                */
/* -------------------------------------------------------------------------- */

/**
 * A label as it currently exists on a target repository.
 *
 * Mirrors the subset of GitHub's label representation that the sync algorithm
 * reasons about. `color` is the 6-character hex string WITHOUT a leading '#'
 * (matching {@link LabelDefinition.color}), and `description` is normalized to
 * a string (GitHub may return `null`, which callers should coerce to "").
 */
export interface ExistingLabel {
  name: string;
  color: string;
  description: string;
}

/**
 * The kind of synchronization operation planned for a single label definition
 * against a single target repository.
 *
 * - `create`   the canonical label is absent and has no alias match
 * - `update`   the canonical label exists but its color/description differ
 * - `rename`   an alias match is renamed to the canonical name (and its
 *              color/description updated to the definition)
 * - `conflict` an alias match exists but the canonical name is already taken
 *              by a different label, so the rename is skipped
 * - `noop`     the canonical label already matches the definition exactly
 */
export type LabelOperationType =
  | "create"
  | "update"
  | "rename"
  | "conflict"
  | "noop";

/**
 * A single planned operation produced by the pure sync planner. Performing all
 * non-`noop`, non-`conflict` operations converges the repository onto the
 * label definitions (Property 4: Label Sync Convergence).
 */
export interface LabelOperation {
  type: LabelOperationType;
  /** Canonical label name from the definition. */
  name: string;
  /** Target color (hex, no '#') from the definition. */
  color: string;
  /** Target description from the definition. */
  description: string;
  /** For `rename`/`conflict`: the existing label name matched via alias. */
  from?: string;
  /** Human-readable reason, primarily for `conflict` operations. */
  reason?: string;
}

/**
 * Per-repository synchronization outcome. Counts are derived from the operation
 * lists so that report counts always equal the operations performed
 * (Property 5: Sync Report Accuracy).
 */
export interface RepoSyncResult {
  repo: string;
  created: string[];
  updated: string[];
  /** Renamed labels as `{ from, to }` pairs. */
  renamed: Array<{ from: string; to: string }>;
  /** Alias matches skipped because the canonical name was already taken. */
  conflicts: Array<{ name: string; from: string; reason: string }>;
  /** Repositories or operations that failed with an error message. */
  errors: string[];
  /** True when the repository was skipped entirely (e.g. access denied). */
  skipped: boolean;
}

/**
 * Aggregate report across all synchronized repositories.
 */
export interface LabelSyncReport {
  repos: RepoSyncResult[];
  createdCount: number;
  updatedCount: number;
  renamedCount: number;
  conflictCount: number;
  errorCount: number;
  repoCount: number;
}
