/**
 * Workflow template validator.
 *
 * Validates the organization workflow templates stored under
 * `workflow-templates/` against the rules defined in the design and
 * requirements documents:
 *
 *   - Every workflow template (`*.yml` / `*.yaml`, excluding `*.properties.json`)
 *     must have a corresponding `{workflow}.properties.json` metadata file, and
 *     every `*.properties.json` file must have a matching workflow template
 *     (pairing consistency, Requirement 10.1).
 *   - The workflow `.yml` file must contain valid YAML syntax (Requirement 10.7
 *     treats an unparseable/invalid template as not displayable).
 *   - The properties JSON must parse and contain the required fields `name`,
 *     `description`, `iconName`, and `categories` with usable values
 *     (Requirements 10.4, 10.7). `categories` must be a non-empty list of
 *     non-empty strings.
 *   - The properties `name` must match the workflow template filename without
 *     its extension (Requirement 10.2).
 *   - No workflow template may contain a hardcoded secret value (literal token,
 *     password, API key, or private key). Secret references must use the
 *     `${{ secrets.* }}` syntax exclusively; a hardcoded secret rejects the
 *     template even when valid `${{ secrets.* }}` references are also present
 *     (Requirement 15.2).
 *
 * Each invalid entry is reported independently and processing continues so a
 * single bad template does not mask problems in the others (Requirement 10.7).
 *
 * The module exports {@link validateWorkflowTemplate} (operating on a single
 * workflow + properties pair in memory) and {@link validateWorkflowsDir}
 * (scanning a directory on disk) so it can be reused by
 * `scripts/validate-all.ts` and exercised by the property tests. When executed
 * directly via ts-node it validates the `workflow-templates/` directory and
 * exits with a non-zero status code if validation fails.
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

import {
  WorkflowProperties,
  ValidationResult,
  emptyValidationResult,
  isRecord,
  isNonEmptyString,
} from "./types";

/** Default location of the organization workflow templates directory. */
export const DEFAULT_WORKFLOW_TEMPLATES_DIR = "workflow-templates";

/** Suffix identifying a workflow properties metadata file. */
export const PROPERTIES_SUFFIX = ".properties.json";

/** Required scalar/list fields on every properties file (Requirement 10.7). */
const REQUIRED_PROPERTIES_FIELDS = [
  "name",
  "description",
  "iconName",
  "categories",
] as const;

/**
 * Patterns that indicate a hardcoded secret in a workflow template
 * (Requirement 15.2). Each entry pairs a human-readable description with a
 * regular expression. The patterns intentionally ignore values that are
 * supplied through the `${{ secrets.* }}` context, empty strings, or GitHub
 * Actions expression placeholders.
 */
const HARDCODED_SECRET_PATTERNS: ReadonlyArray<{
  description: string;
  pattern: RegExp;
}> = [
  {
    description: "PEM private key block",
    pattern: /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----/,
  },
  {
    description: "GitHub personal access / app token",
    pattern: /\b(?:gh[pousr]|github_pat)_[A-Za-z0-9_]{20,}\b/,
  },
  {
    description: "AWS access key id",
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/,
  },
  {
    description: "Slack token",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  },
  {
    description: "assigned token/password/apikey/secret literal",
    // e.g. `token: "abc123..."` or `API_KEY=supersecretvalue`.
    // Only flags inline literals; `${{ ... }}` expressions and empty values
    // are excluded by the negative lookahead on the value.
    pattern:
      /\b(?:token|password|passwd|secret|api[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret)\b\s*[:=]\s*(?!['"]?\s*\$\{\{)(?!['"]{2})(?!\s)['"]?[A-Za-z0-9/+._=-]{8,}['"]?/i,
  },
];

/**
 * Validate a single workflow template and its accompanying properties file,
 * supplied in memory.
 *
 * @param workflowName    The workflow template filename (e.g. `ci-pipeline.yml`).
 * @param workflowSource  Raw YAML content of the workflow template, or `null`
 *                        when the workflow file is missing (orphaned
 *                        properties file).
 * @param propertiesSource Raw JSON content of the properties file, or `null`
 *                        when the properties file is missing (orphaned
 *                        workflow template).
 * @param sourceLabel     Label used in error messages (defaults to the
 *                        workflow filename).
 * @returns A {@link ValidationResult} describing all problems found.
 */
export function validateWorkflowTemplate(
  workflowName: string,
  workflowSource: string | null,
  propertiesSource: string | null,
  sourceLabel: string = workflowName,
): ValidationResult {
  const result = emptyValidationResult();
  const baseName = stripWorkflowExtension(workflowName);
  const expectedPropertiesName = `${baseName}${PROPERTIES_SUFFIX}`;

  // Pairing consistency (Requirement 10.1): a workflow must have a matching
  // properties file and vice versa.
  if (workflowSource === null) {
    result.errors.push(
      `${sourceLabel}: properties file has no matching workflow template ` +
        `"${workflowName}".`,
    );
    result.valid = false;
    return result;
  }

  if (propertiesSource === null) {
    result.errors.push(
      `${sourceLabel}: workflow template has no matching properties file ` +
        `"${expectedPropertiesName}" (Requirement 10.1).`,
    );
    result.valid = false;
    // No properties to validate, but still scan the workflow for secrets.
    scanForHardcodedSecrets(workflowSource, sourceLabel, result);
    return result;
  }

  // Validate workflow YAML syntax (Requirement 10.7).
  try {
    yaml.load(workflowSource);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(
      `${sourceLabel}: invalid YAML syntax in workflow template: ${message}`,
    );
    result.valid = false;
  }

  // Validate the properties JSON (Requirements 10.2, 10.7).
  validateProperties(propertiesSource, baseName, expectedPropertiesName, result);

  // Reject hardcoded secrets (Requirement 15.2).
  scanForHardcodedSecrets(workflowSource, sourceLabel, result);

  return result;
}

/**
 * Scan and validate every workflow template in a directory on disk.
 *
 * Builds the set of workflow/properties pairs from the directory listing,
 * reports any orphaned file on either side (Requirement 10.1), and validates
 * each pair independently so one bad template does not stop the others
 * (Requirement 10.7).
 *
 * @param dir Directory containing the workflow templates.
 * @returns A {@link ValidationResult} aggregating all problems found.
 */
export function validateWorkflowsDir(
  dir: string = DEFAULT_WORKFLOW_TEMPLATES_DIR,
): ValidationResult {
  const result = emptyValidationResult();

  let entries: string[];
  try {
    entries = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(`${dir}: unable to read directory: ${message}`);
    result.valid = false;
    return result;
  }

  const workflowFiles = entries.filter(isWorkflowFile).sort();
  const propertiesFiles = entries.filter((name) =>
    name.endsWith(PROPERTIES_SUFFIX),
  );
  const propertiesByBase = new Map<string, string>();
  for (const propFile of propertiesFiles) {
    propertiesByBase.set(
      propFile.slice(0, -PROPERTIES_SUFFIX.length),
      propFile,
    );
  }

  if (workflowFiles.length === 0) {
    result.warnings.push(`${dir}: no workflow templates found.`);
  }

  // Validate each workflow template against its (expected) properties file.
  const matchedProperties = new Set<string>();
  for (const workflowName of workflowFiles) {
    const baseName = stripWorkflowExtension(workflowName);
    const propFile = propertiesByBase.get(baseName);
    const workflowPath = path.join(dir, workflowName);

    const workflowSource = readFileOrError(workflowPath, result);

    let propertiesSource: string | null = null;
    if (propFile !== undefined) {
      matchedProperties.add(propFile);
      propertiesSource = readFileOrError(path.join(dir, propFile), result);
    }

    // If the workflow file could not be read, surface it and move on.
    if (workflowSource === null) {
      result.valid = false;
      continue;
    }

    mergeResult(
      result,
      validateWorkflowTemplate(
        workflowName,
        workflowSource,
        propertiesSource,
        workflowPath,
      ),
    );
  }

  // Report orphaned properties files that never matched a workflow template.
  for (const propFile of propertiesFiles) {
    if (matchedProperties.has(propFile)) {
      continue;
    }
    const base = propFile.slice(0, -PROPERTIES_SUFFIX.length);
    result.errors.push(
      `${path.join(dir, propFile)}: properties file has no matching workflow ` +
        `template (expected "${base}.yml" or "${base}.yaml") (Requirement 10.1).`,
    );
    result.valid = false;
  }

  return result;
}

/**
 * Parse and validate a properties JSON document for a workflow template.
 */
function validateProperties(
  propertiesSource: string,
  baseName: string,
  propertiesLabel: string,
  result: ValidationResult,
): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(propertiesSource);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(
      `${propertiesLabel}: invalid JSON in properties file: ${message}`,
    );
    result.valid = false;
    return;
  }

  if (!isRecord(parsed)) {
    result.errors.push(
      `${propertiesLabel}: expected a JSON object, got ${describeType(parsed)}.`,
    );
    result.valid = false;
    return;
  }

  // Required scalar string fields: name, description, iconName
  // (Requirement 10.7).
  const missing: string[] = [];
  for (const field of REQUIRED_PROPERTIES_FIELDS) {
    if (field === "categories") {
      continue; // validated separately below
    }
    if (!isNonEmptyString(parsed[field])) {
      missing.push(field);
    }
  }

  // Required list field: categories must be a non-empty list of non-empty
  // strings (Requirement 10.7, with Requirement 10.5 shape).
  const categories = parsed.categories;
  if (!Array.isArray(categories) || categories.length === 0) {
    missing.push("categories");
  } else {
    const badIndexes = categories
      .map((value, index) => (isNonEmptyString(value) ? -1 : index))
      .filter((index) => index >= 0);
    if (badIndexes.length > 0) {
      result.errors.push(
        `${propertiesLabel}: "categories" entries must be non-empty strings ` +
          `(invalid at index ${badIndexes.join(", ")}).`,
      );
      result.valid = false;
    }
  }

  if (missing.length > 0) {
    result.errors.push(
      `${propertiesLabel}: missing or empty required field(s): ` +
        `${missing.join(", ")} (Requirement 10.7).`,
    );
    result.valid = false;
  }

  // name must match the workflow filename without extension (Requirement 10.2).
  if (isNonEmptyString(parsed.name)) {
    const name = (parsed.name as string).trim();
    if (name !== baseName) {
      result.errors.push(
        `${propertiesLabel}: "name" is "${name}" but must match the workflow ` +
          `filename without extension ("${baseName}") (Requirement 10.2).`,
      );
      result.valid = false;
    }
  }
}

/**
 * Scan raw workflow text for hardcoded secret values (Requirement 15.2).
 *
 * Reports every distinct secret pattern that matches. A match rejects the
 * template regardless of whether valid `${{ secrets.* }}` references are also
 * present in the same file.
 */
function scanForHardcodedSecrets(
  workflowSource: string,
  sourceLabel: string,
  result: ValidationResult,
): void {
  for (const { description, pattern } of HARDCODED_SECRET_PATTERNS) {
    if (pattern.test(workflowSource)) {
      result.errors.push(
        `${sourceLabel}: possible hardcoded secret detected (${description}). ` +
          `Reference secrets exclusively via \${{ secrets.* }} (Requirement 15.2).`,
      );
      result.valid = false;
    }
  }
}

/**
 * Read a file from disk, pushing a read error onto the result and returning
 * `null` on failure.
 */
function readFileOrError(
  filePath: string,
  result: ValidationResult,
): string | null {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(`${filePath}: unable to read file: ${message}`);
    result.valid = false;
    return null;
  }
}

/** Merge errors/warnings from `source` into `target`, propagating validity. */
function mergeResult(target: ValidationResult, source: ValidationResult): void {
  target.errors.push(...source.errors);
  target.warnings.push(...source.warnings);
  if (!source.valid) {
    target.valid = false;
  }
}

/** True when a filename is a workflow template (`.yml`/`.yaml`, not properties). */
function isWorkflowFile(name: string): boolean {
  if (name.endsWith(PROPERTIES_SUFFIX)) {
    return false;
  }
  return name.endsWith(".yml") || name.endsWith(".yaml");
}

/** Strip the `.yml`/`.yaml` extension from a workflow filename. */
function stripWorkflowExtension(name: string): string {
  return name.replace(/\.(ya?ml)$/i, "");
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

// When run directly (ts-node scripts/validate-workflows.ts [dir]), validate the
// workflow templates directory and exit with a non-zero status on failure.
if (require.main === module) {
  const target = process.argv[2] ?? DEFAULT_WORKFLOW_TEMPLATES_DIR;
  const result = validateWorkflowsDir(target);
  // eslint-disable-next-line no-console
  console.log(formatResult(result, target));
  process.exit(result.valid ? 0 : 1);
}

// Re-export the shared type for convenient importing by consumers.
export type { WorkflowProperties };
