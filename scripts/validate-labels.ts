/**
 * Label definitions validator.
 *
 * Validates `.github/labels.yml` against the rules defined in the design and
 * requirements documents:
 *
 *   - The file must be valid YAML and parse to a list of label entries
 *     (Requirement 13.6).
 *   - Each entry must provide the required fields `name`, `color`, and
 *     `description` (Requirements 11.1, 13.6).
 *   - `color` must match `^[0-9a-fA-F]{6}$` (Requirement 11.3). An entry that
 *     fails color validation is skipped with a reported error while remaining
 *     entries continue to be processed (Requirement 11.4).
 *   - No two definitions may share the same canonical name or alias
 *     (case-insensitive). Any such collision rejects the whole file
 *     (Requirement 12.4).
 *   - A definition may declare at most 10 aliases (Requirement 12.6).
 *
 * The module exports {@link validateLabels} (operating on raw YAML text) and
 * {@link validateLabelsFile} (reading from disk) so that it can be reused by
 * `scripts/validate-all.ts` and exercised by the property test. When executed
 * directly via ts-node it validates `.github/labels.yml` and exits with a
 * non-zero status code if validation fails.
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

import {
  LabelDefinition,
  ValidationResult,
  emptyValidationResult,
  isRecord,
  isNonEmptyString,
} from "./types";

/** Default location of the canonical label definitions file. */
export const DEFAULT_LABELS_PATH = path.join(".github", "labels.yml");

/** Hex color pattern required by Requirement 11.3. */
export const HEX_COLOR_PATTERN = /^[0-9a-fA-F]{6}$/;

/** Maximum number of aliases permitted per label (Requirement 12.6). */
export const MAX_ALIASES = 10;

/** Required scalar string fields on every label entry. */
const REQUIRED_FIELDS = ["name", "color", "description"] as const;

/**
 * Validate label definitions supplied as raw YAML text.
 *
 * Parsing failures and missing required fields are reported as errors
 * (Requirement 13.6). Color-validation failures skip the offending entry but
 * do not stop processing (Requirement 11.4). Duplicate names or aliases
 * (case-insensitive) invalidate the entire file (Requirement 12.4).
 *
 * @param source     Raw YAML content of a labels definition file.
 * @param sourceName Label used in error messages (e.g. the file path).
 * @returns A {@link ValidationResult} describing all problems found.
 */
export function validateLabels(
  source: string,
  sourceName = "labels.yml",
): ValidationResult {
  const result = emptyValidationResult();

  // Step 1: Parse YAML (Requirement 13.6).
  let parsed: unknown;
  try {
    parsed = yaml.load(source);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(`${sourceName}: invalid YAML syntax: ${message}`);
    result.valid = false;
    return result;
  }

  // An empty document (null/undefined) means no definitions were provided.
  if (parsed === null || parsed === undefined) {
    result.errors.push(`${sourceName}: no label definitions found (file is empty).`);
    result.valid = false;
    return result;
  }

  if (!Array.isArray(parsed)) {
    result.errors.push(
      `${sourceName}: expected a list of label definitions at the top level, ` +
        `got ${describeType(parsed)}.`,
    );
    result.valid = false;
    return result;
  }

  if (parsed.length === 0) {
    result.errors.push(`${sourceName}: no label definitions found (empty list).`);
    result.valid = false;
    return result;
  }

  // Track canonical identifiers (names + aliases) for duplicate detection.
  // Maps lowercase identifier -> human-readable description of first owner.
  const seenIdentifiers = new Map<string, string>();

  // Step 2: Validate each entry independently so one bad entry does not mask
  // problems in the others.
  parsed.forEach((entry, index) => {
    const entryLabel = labelForIndex(entry, index);

    if (!isRecord(entry)) {
      result.errors.push(
        `${sourceName} ${entryLabel}: expected a mapping with name/color/description, ` +
          `got ${describeType(entry)}. Skipping entry.`,
      );
      result.valid = false;
      return;
    }

    // Required fields (Requirements 11.1, 13.6).
    const missing: string[] = [];
    for (const field of REQUIRED_FIELDS) {
      if (!isNonEmptyString(entry[field])) {
        missing.push(field);
      }
    }
    if (missing.length > 0) {
      result.errors.push(
        `${sourceName} ${entryLabel}: missing or empty required field(s): ` +
          `${missing.join(", ")}. Skipping entry.`,
      );
      result.valid = false;
      // Without a usable name we cannot register the entry for duplicate
      // detection, so stop processing this entry.
      if (!isNonEmptyString(entry.name)) {
        return;
      }
    }

    const name = (entry.name as string).trim();

    // Color validation (Requirements 11.3, 11.4): report and skip the entry,
    // but keep processing the remaining definitions.
    if (isNonEmptyString(entry.color)) {
      const color = (entry.color as string).trim();
      if (!HEX_COLOR_PATTERN.test(color)) {
        result.errors.push(
          `${sourceName} (label "${name}"): invalid color "${color}" ` +
            `(must match ^[0-9a-fA-F]{6}$ with no leading '#'). Skipping entry.`,
        );
        result.valid = false;
      }
    }

    // Alias validation (Requirement 12.6: max 10 aliases).
    const aliases = normalizeAliases(entry.aliases, name, sourceName, result);

    // Duplicate detection across names and aliases, case-insensitive
    // (Requirement 12.4). A collision invalidates the whole file.
    registerIdentifier(
      seenIdentifiers,
      name,
      `name of label "${name}"`,
      sourceName,
      result,
    );
    for (const alias of aliases) {
      registerIdentifier(
        seenIdentifiers,
        alias,
        `alias "${alias}" of label "${name}"`,
        sourceName,
        result,
      );
    }
  });

  return result;
}

/**
 * Read a labels definition file from disk and validate it.
 *
 * A missing or unreadable file is reported as an error (treated as a parsing
 * failure under Requirement 13.6).
 *
 * @param filePath Path to the labels YAML file.
 * @returns A {@link ValidationResult} describing all problems found.
 */
export function validateLabelsFile(
  filePath: string = DEFAULT_LABELS_PATH,
): ValidationResult {
  let source: string;
  try {
    source = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      errors: [`${filePath}: unable to read file: ${message}`],
      warnings: [],
    };
  }
  return validateLabels(source, filePath);
}

/**
 * Normalize and validate the optional `aliases` field for a single entry.
 *
 * Non-list alias values and non-string alias items are reported as errors.
 * Enforces the max-alias limit (Requirement 12.6). Returns the list of
 * trimmed, non-empty alias strings for duplicate detection.
 */
function normalizeAliases(
  raw: unknown,
  name: string,
  sourceName: string,
  result: ValidationResult,
): string[] {
  if (raw === undefined || raw === null) {
    return [];
  }

  if (!Array.isArray(raw)) {
    result.errors.push(
      `${sourceName} (label "${name}"): "aliases" must be a list, ` +
        `got ${describeType(raw)}.`,
    );
    result.valid = false;
    return [];
  }

  if (raw.length > MAX_ALIASES) {
    result.errors.push(
      `${sourceName} (label "${name}"): declares ${raw.length} aliases, ` +
        `exceeding the maximum of ${MAX_ALIASES}.`,
    );
    result.valid = false;
  }

  const aliases: string[] = [];
  raw.forEach((alias, aliasIndex) => {
    if (!isNonEmptyString(alias)) {
      result.errors.push(
        `${sourceName} (label "${name}"): alias at index ${aliasIndex} ` +
          `must be a non-empty string, got ${describeType(alias)}.`,
      );
      result.valid = false;
      return;
    }
    aliases.push(alias.trim());
  });

  return aliases;
}

/**
 * Register an identifier (name or alias) and flag a case-insensitive collision
 * against any previously registered identifier (Requirement 12.4).
 */
function registerIdentifier(
  seen: Map<string, string>,
  identifier: string,
  owner: string,
  sourceName: string,
  result: ValidationResult,
): void {
  const key = identifier.toLowerCase();
  const existing = seen.get(key);
  if (existing !== undefined) {
    result.errors.push(
      `${sourceName}: conflicting entries — ${owner} collides with ${existing} ` +
        `(case-insensitive match on "${identifier}").`,
    );
    result.valid = false;
    return;
  }
  seen.set(key, owner);
}

/** Build a stable, human-readable label for an entry at a given index. */
function labelForIndex(entry: unknown, index: number): string {
  if (isRecord(entry) && isNonEmptyString(entry.name)) {
    return `(label "${(entry.name as string).trim()}", entry #${index + 1})`;
  }
  return `(entry #${index + 1})`;
}

/** Describe the runtime type of a value for use in error messages. */
function describeType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "list";
  return typeof value;
}

/**
 * Format a {@link ValidationResult} into a human-readable, multi-line report.
 */
export function formatResult(result: ValidationResult, label: string): string {
  const lines: string[] = [];
  if (result.valid) {
    lines.push(`✓ ${label}: valid.`);
  } else {
    lines.push(`✗ ${label}: ${result.errors.length} error(s).`);
  }
  for (const error of result.errors) {
    lines.push(`  error: ${error}`);
  }
  for (const warning of result.warnings) {
    lines.push(`  warning: ${warning}`);
  }
  return lines.join("\n");
}

// When run directly (ts-node scripts/validate-labels.ts [path]), validate the
// labels file and exit with a non-zero status on failure.
if (require.main === module) {
  const target = process.argv[2] ?? DEFAULT_LABELS_PATH;
  const result = validateLabelsFile(target);
  // eslint-disable-next-line no-console
  console.log(formatResult(result, target));
  process.exit(result.valid ? 0 : 1);
}

// Re-export the shared type for convenient importing by consumers.
export type { LabelDefinition };
