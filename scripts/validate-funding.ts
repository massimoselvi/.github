/**
 * Funding configuration validator.
 *
 * Validates `FUNDING.yml` (at the repository root) against the rules defined in
 * the design and requirements documents:
 *
 *   - The file must be valid YAML and parse to a mapping of platform -> value
 *     (Requirement 4.5). A parse failure or a non-mapping top-level document is
 *     a hard error.
 *   - At least one recognized funding platform must be specified
 *     (Requirements 4.1, 4.5).
 *   - Every URL (notably the entries under `custom`) must use the HTTPS
 *     protocol (Requirement 4.2).
 *   - Platform values must have the correct shape: `github` and `custom` accept
 *     either a single string or a list of strings; all other recognized
 *     platforms accept a single string (Requirement 4.4).
 *   - GitHub Sponsors usernames are limited to a maximum of 4 (Requirement 4.3)
 *     and `custom` URL platforms are limited to a maximum of 4 (Requirement
 *     4.4).
 *
 * Each invalid entry is reported independently and processing continues so that
 * a single bad platform does not mask problems in the others.
 *
 * The module exports {@link validateFunding} (operating on raw YAML text) and
 * {@link validateFundingFile} (reading from disk) so that it can be reused by
 * `scripts/validate-all.ts` and exercised by the property test. When executed
 * directly via ts-node it validates `FUNDING.yml` and exits with a non-zero
 * status code if validation fails.
 */

import * as fs from "fs";
import * as yaml from "js-yaml";

import {
  FundingConfig,
  ValidationResult,
  emptyValidationResult,
  isRecord,
  isNonEmptyString,
} from "./types";

/** Default location of the funding configuration file. */
export const DEFAULT_FUNDING_PATH = "FUNDING.yml";

/** Maximum number of GitHub Sponsors usernames permitted (Requirement 4.3). */
export const MAX_GITHUB_USERNAMES = 4;

/** Maximum number of custom URL platforms permitted (Requirement 4.4). */
export const MAX_CUSTOM_URLS = 4;

/**
 * Platforms that accept a single string value OR a list of strings.
 * GitHub supports multiple usernames for `github` and multiple URLs for
 * `custom`.
 */
const LIST_OR_STRING_PLATFORMS = new Set<string>(["github", "custom"]);

/**
 * Recognized GitHub funding platform keys. Every entry except those in
 * {@link LIST_OR_STRING_PLATFORMS} accepts a single string value.
 *
 * See: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/displaying-a-sponsor-button-in-your-repository
 */
const RECOGNIZED_PLATFORMS = new Set<string>([
  "github",
  "patreon",
  "open_collective",
  "ko_fi",
  "tidelift",
  "community_bridge",
  "liberapay",
  "issuehunt",
  "lfx_crowdfunding",
  "polar",
  "buy_me_a_coffee",
  "thanks_dev",
  "otechie",
  "custom",
]);

/**
 * Validate a funding configuration supplied as raw YAML text.
 *
 * Parsing failures and a missing platform set are reported as errors
 * (Requirements 4.1, 4.5). URL, shape, and count problems are reported per
 * platform while processing continues (Requirements 4.2, 4.3, 4.4).
 *
 * @param source     Raw YAML content of a FUNDING.yml file.
 * @param sourceName Label used in error messages (e.g. the file path).
 * @returns A {@link ValidationResult} describing all problems found.
 */
export function validateFunding(
  source: string,
  sourceName = "FUNDING.yml",
): ValidationResult {
  const result = emptyValidationResult();

  // Step 1: Parse YAML (Requirement 4.5).
  let parsed: unknown;
  try {
    parsed = yaml.load(source);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(`${sourceName}: invalid YAML syntax: ${message}`);
    result.valid = false;
    return result;
  }

  // An empty document (null/undefined) means no platforms were provided.
  if (parsed === null || parsed === undefined) {
    result.errors.push(
      `${sourceName}: no funding platforms specified (file is empty).`,
    );
    result.valid = false;
    return result;
  }

  if (!isRecord(parsed)) {
    result.errors.push(
      `${sourceName}: expected a mapping of platform to value at the top level, ` +
        `got ${describeType(parsed)}.`,
    );
    result.valid = false;
    return result;
  }

  const config = parsed as FundingConfig;
  const platformKeys = Object.keys(config);

  // Step 2: Require at least one recognized platform (Requirements 4.1, 4.5).
  // Unrecognized keys are reported as warnings and do not count toward the
  // "at least one platform" requirement.
  let recognizedCount = 0;

  // Step 3: Validate each platform entry independently so one bad entry does
  // not mask problems in the others.
  for (const platform of platformKeys) {
    const value = config[platform];

    if (!RECOGNIZED_PLATFORMS.has(platform)) {
      result.warnings.push(
        `${sourceName}: unrecognized funding platform "${platform}" ` +
          `(ignored; not a known GitHub funding key).`,
      );
      continue;
    }

    // A recognized platform with an empty/undefined value provides no actual
    // funding option, so it does not count and is reported as an error.
    if (value === undefined || value === null) {
      result.errors.push(
        `${sourceName} (platform "${platform}"): value must not be empty.`,
      );
      result.valid = false;
      continue;
    }

    recognizedCount++;

    if (LIST_OR_STRING_PLATFORMS.has(platform)) {
      validateListOrStringPlatform(platform, value, sourceName, result);
    } else {
      validateStringPlatform(platform, value, sourceName, result);
    }
  }

  if (recognizedCount === 0) {
    result.errors.push(
      `${sourceName}: no funding platforms specified ` +
        `(at least one of ${Array.from(RECOGNIZED_PLATFORMS).join(", ")} is required).`,
    );
    result.valid = false;
  }

  return result;
}

/**
 * Read a funding configuration file from disk and validate it.
 *
 * A missing or unreadable file is reported as an error (treated as a parsing
 * failure under Requirement 4.5).
 *
 * @param filePath Path to the FUNDING.yml file.
 * @returns A {@link ValidationResult} describing all problems found.
 */
export function validateFundingFile(
  filePath: string = DEFAULT_FUNDING_PATH,
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
  return validateFunding(source, filePath);
}

/**
 * Validate a platform whose value must be a single non-empty string
 * (e.g. `open_collective`, `ko_fi`, `patreon`). String values that look like
 * URLs are additionally required to use HTTPS (Requirement 4.2).
 */
function validateStringPlatform(
  platform: string,
  value: unknown,
  sourceName: string,
  result: ValidationResult,
): void {
  if (!isNonEmptyString(value)) {
    result.errors.push(
      `${sourceName} (platform "${platform}"): expected a non-empty string, ` +
        `got ${describeType(value)}.`,
    );
    result.valid = false;
    return;
  }
  checkHttpsIfUrl(platform, value.trim(), sourceName, result);
}

/**
 * Validate a platform whose value may be a single string or a list of strings
 * (`github` or `custom`). Enforces per-platform count limits (Requirements 4.3,
 * 4.4) and the HTTPS requirement for any URL values (Requirement 4.2).
 */
function validateListOrStringPlatform(
  platform: string,
  value: unknown,
  sourceName: string,
  result: ValidationResult,
): void {
  const items: unknown[] = Array.isArray(value) ? value : [value];

  // Enforce count limits (Requirements 4.3, 4.4).
  if (platform === "github" && items.length > MAX_GITHUB_USERNAMES) {
    result.errors.push(
      `${sourceName} (platform "github"): ${items.length} usernames specified, ` +
        `exceeding the maximum of ${MAX_GITHUB_USERNAMES}.`,
    );
    result.valid = false;
  }
  if (platform === "custom" && items.length > MAX_CUSTOM_URLS) {
    result.errors.push(
      `${sourceName} (platform "custom"): ${items.length} URLs specified, ` +
        `exceeding the maximum of ${MAX_CUSTOM_URLS}.`,
    );
    result.valid = false;
  }

  items.forEach((item, index) => {
    if (!isNonEmptyString(item)) {
      result.errors.push(
        `${sourceName} (platform "${platform}", entry #${index + 1}): ` +
          `expected a non-empty string, got ${describeType(item)}.`,
      );
      result.valid = false;
      return;
    }
    checkHttpsIfUrl(platform, item.trim(), sourceName, result);
  });
}

/**
 * Enforce the HTTPS requirement (Requirement 4.2) for a string value.
 *
 * `custom` entries are always treated as URLs and must parse as an HTTPS URL.
 * For other platforms, a value is only checked when it looks like a URL (it
 * contains a `://` scheme separator); plain usernames/slugs are left untouched.
 */
function checkHttpsIfUrl(
  platform: string,
  value: string,
  sourceName: string,
  result: ValidationResult,
): void {
  const looksLikeUrl = platform === "custom" || value.includes("://");
  if (!looksLikeUrl) {
    return;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(value);
  } catch {
    result.errors.push(
      `${sourceName} (platform "${platform}"): "${value}" is not a valid URL.`,
    );
    result.valid = false;
    return;
  }

  if (parsedUrl.protocol !== "https:") {
    result.errors.push(
      `${sourceName} (platform "${platform}"): URL "${value}" must use the ` +
        `HTTPS protocol (found "${parsedUrl.protocol.replace(/:$/, "")}").`,
    );
    result.valid = false;
  }
}

/** Describe the runtime type of a value for use in error messages. */
function describeType(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
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

// When run directly (ts-node scripts/validate-funding.ts [path]), validate the
// funding file and exit with a non-zero status on failure.
if (require.main === module) {
  const target = process.argv[2] ?? DEFAULT_FUNDING_PATH;
  const result = validateFundingFile(target);
  // eslint-disable-next-line no-console
  console.log(formatResult(result, target));
  process.exit(result.valid ? 0 : 1);
}

// Re-export the shared type for convenient importing by consumers.
export type { FundingConfig };
