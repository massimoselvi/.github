/**
 * Issue template and template-chooser configuration validator.
 *
 * Validates the GitHub Issue Forms templates stored under
 * `.github/ISSUE_TEMPLATE/*.yml` and the template chooser configuration file
 * `.github/ISSUE_TEMPLATE/config.yml` against the rules defined in the design
 * and requirements documents:
 *
 *   - Each template file must contain valid YAML syntax and must define the
 *     required top-level fields `name`, `description`, and `body`. YAML
 *     validity and required fields are checked independently so that all
 *     applicable errors are reported together (Requirement 6.4).
 *   - Each template `name` must be unique across all templates in the
 *     directory, compared case-insensitively (Requirement 6.1).
 *   - Each template `description` must be a non-empty string of 1-200
 *     characters (Requirement 6.2).
 *   - Each template `body` must contain at least one form element, and every
 *     element must declare a valid Form_Element `type` (Input, Textarea,
 *     Dropdown, Checkboxes, or Markdown) with the attributes that type
 *     requires (Requirement 6.3).
 *   - The chooser config (`config.yml`) is validated for `blank_issues_enabled`
 *     (a boolean when present) and `contact_links`. Each contact link must
 *     provide a non-empty `name` (max 100 chars), a valid HTTPS `url`, and a
 *     non-empty `about` description (max 200 chars). Invalid entries are
 *     reported individually (Requirements 7.5, 7.6).
 *
 * Errors are reported per invalid entry and processing continues so a single
 * bad file or entry does not mask problems elsewhere (Requirement 6.4).
 *
 * The module exports {@link validateIssueTemplate} and
 * {@link validateChooserConfig} (operating on raw YAML text),
 * {@link validateTemplatesDir} (reading an entire ISSUE_TEMPLATE directory from
 * disk), and the shared {@link formatResult} helper so that it can be reused by
 * `scripts/validate-all.ts` and exercised by the property test. When executed
 * directly via ts-node it validates `.github/ISSUE_TEMPLATE/` and exits with a
 * non-zero status code if validation fails.
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

import {
  ValidationResult,
  emptyValidationResult,
  isRecord,
  isNonEmptyString,
} from "./types";

/** Default location of the issue template directory. */
export const DEFAULT_TEMPLATE_DIR = path.join(".github", "ISSUE_TEMPLATE");

/** Filename of the template chooser configuration within the directory. */
export const CONFIG_FILENAME = "config.yml";

/** Minimum length of a template `description` (Requirement 6.2). */
export const MIN_DESCRIPTION_LENGTH = 1;

/** Maximum length of a template `description` (Requirement 6.2). */
export const MAX_DESCRIPTION_LENGTH = 200;

/** Maximum length of a contact link `name` (Requirement 7.5). */
export const MAX_CONTACT_NAME_LENGTH = 100;

/** Maximum length of a contact link `about` description (Requirement 7.5). */
export const MAX_CONTACT_ABOUT_LENGTH = 200;

/**
 * Valid Form_Element types for an issue template body element
 * (Requirement 6.3). Compared case-insensitively against the element `type`.
 */
export const VALID_ELEMENT_TYPES = [
  "input",
  "textarea",
  "dropdown",
  "checkboxes",
  "markdown",
] as const;

type ElementType = (typeof VALID_ELEMENT_TYPES)[number];

/**
 * Validate a single issue template supplied as raw YAML text.
 *
 * Parsing failures and missing/invalid required fields are reported as errors;
 * the two kinds of problem are checked independently so all applicable errors
 * surface together (Requirement 6.4). The returned result does NOT perform
 * cross-template name-uniqueness checks — that is handled by
 * {@link validateTemplatesDir} once every template name is known
 * (Requirement 6.1).
 *
 * @param source     Raw YAML content of an issue template file.
 * @param sourceName Label used in error messages (e.g. the file path).
 * @returns A {@link ValidationResult} and the parsed template `name` (lowercased
 *          and trimmed) when one could be extracted, for duplicate detection.
 */
export function validateIssueTemplate(
  source: string,
  sourceName = "template.yml",
): ValidationResult & { templateName?: string } {
  const result: ValidationResult & { templateName?: string } =
    emptyValidationResult();

  // Step 1: Parse YAML (Requirement 6.4).
  let parsed: unknown;
  try {
    parsed = yaml.load(source);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(`${sourceName}: invalid YAML syntax: ${message}`);
    result.valid = false;
    return result;
  }

  if (parsed === null || parsed === undefined) {
    result.errors.push(`${sourceName}: template is empty.`);
    result.valid = false;
    return result;
  }

  if (!isRecord(parsed)) {
    result.errors.push(
      `${sourceName}: expected a mapping with name/description/body at the top ` +
        `level, got ${describeType(parsed)}.`,
    );
    result.valid = false;
    return result;
  }

  // Step 2: Validate required field `name` (Requirements 6.1, 6.4).
  if (!isNonEmptyString(parsed.name)) {
    result.errors.push(
      `${sourceName}: missing or empty required field "name".`,
    );
    result.valid = false;
  } else {
    result.templateName = (parsed.name as string).trim().toLowerCase();
  }

  // Step 3: Validate required field `description` (Requirements 6.2, 6.4).
  if (!isNonEmptyString(parsed.description)) {
    result.errors.push(
      `${sourceName}: missing or empty required field "description" ` +
        `(must be ${MIN_DESCRIPTION_LENGTH}-${MAX_DESCRIPTION_LENGTH} characters).`,
    );
    result.valid = false;
  } else {
    const length = (parsed.description as string).trim().length;
    if (length < MIN_DESCRIPTION_LENGTH || length > MAX_DESCRIPTION_LENGTH) {
      result.errors.push(
        `${sourceName}: "description" must be between ${MIN_DESCRIPTION_LENGTH} ` +
          `and ${MAX_DESCRIPTION_LENGTH} characters, got ${length}.`,
      );
      result.valid = false;
    }
  }

  // Step 4: Validate required field `body` (Requirements 6.3, 6.4).
  validateBody(parsed.body, sourceName, result);

  return result;
}

/**
 * Validate the `body` field of an issue template: it must be a non-empty list
 * of form elements, and each element must declare a valid Form_Element `type`
 * with the attributes that type requires (Requirement 6.3).
 */
function validateBody(
  body: unknown,
  sourceName: string,
  result: ValidationResult,
): void {
  if (body === undefined || body === null) {
    result.errors.push(`${sourceName}: missing required field "body".`);
    result.valid = false;
    return;
  }

  if (!Array.isArray(body)) {
    result.errors.push(
      `${sourceName}: "body" must be a list of form elements, ` +
        `got ${describeType(body)}.`,
    );
    result.valid = false;
    return;
  }

  if (body.length === 0) {
    result.errors.push(
      `${sourceName}: "body" must contain at least one form element.`,
    );
    result.valid = false;
    return;
  }

  body.forEach((element, index) => {
    const elementLabel = `body element #${index + 1}`;

    if (!isRecord(element)) {
      result.errors.push(
        `${sourceName}: ${elementLabel} must be a mapping with a "type" field, ` +
          `got ${describeType(element)}.`,
      );
      result.valid = false;
      return;
    }

    if (!isNonEmptyString(element.type)) {
      result.errors.push(
        `${sourceName}: ${elementLabel} is missing a "type" field.`,
      );
      result.valid = false;
      return;
    }

    const type = (element.type as string).trim().toLowerCase();
    if (!isValidElementType(type)) {
      result.errors.push(
        `${sourceName}: ${elementLabel} has invalid type "${element.type}" ` +
          `(must be one of: ${VALID_ELEMENT_TYPES.join(", ")}).`,
      );
      result.valid = false;
      return;
    }

    validateElementAttributes(type, element, sourceName, elementLabel, result);
  });
}

/**
 * Validate the `attributes` of a single body element against the requirements
 * of its type (Requirement 6.3).
 *
 *   - markdown   requires attributes.value (the rendered content)
 *   - input/textarea requires attributes.label
 *   - dropdown/checkboxes requires attributes.label and a non-empty
 *     attributes.options list
 */
function validateElementAttributes(
  type: ElementType,
  element: Record<string, unknown>,
  sourceName: string,
  elementLabel: string,
  result: ValidationResult,
): void {
  const attributes = element.attributes;

  if (!isRecord(attributes)) {
    result.errors.push(
      `${sourceName}: ${elementLabel} (type "${type}") is missing an ` +
        `"attributes" mapping.`,
    );
    result.valid = false;
    return;
  }

  if (type === "markdown") {
    if (!isNonEmptyString(attributes.value)) {
      result.errors.push(
        `${sourceName}: ${elementLabel} (type "markdown") requires a non-empty ` +
          `"value" attribute.`,
      );
      result.valid = false;
    }
    return;
  }

  // input, textarea, dropdown, checkboxes all require a label.
  if (!isNonEmptyString(attributes.label)) {
    result.errors.push(
      `${sourceName}: ${elementLabel} (type "${type}") requires a non-empty ` +
        `"label" attribute.`,
    );
    result.valid = false;
  }

  // dropdown and checkboxes additionally require a non-empty options list.
  if (type === "dropdown" || type === "checkboxes") {
    const options = attributes.options;
    if (!Array.isArray(options) || options.length === 0) {
      result.errors.push(
        `${sourceName}: ${elementLabel} (type "${type}") requires a non-empty ` +
          `"options" list.`,
      );
      result.valid = false;
    }
  }
}

/**
 * Validate the template chooser configuration supplied as raw YAML text.
 *
 * Checks `blank_issues_enabled` (a boolean when present) and each entry in
 * `contact_links` for a non-empty `name` (max 100 chars), a valid HTTPS `url`,
 * and a non-empty `about` description (max 200 chars). Invalid entries are
 * reported individually and processing continues (Requirements 7.5, 7.6).
 *
 * @param source     Raw YAML content of a `config.yml` file.
 * @param sourceName Label used in error messages (e.g. the file path).
 * @returns A {@link ValidationResult} describing all problems found.
 */
export function validateChooserConfig(
  source: string,
  sourceName = "config.yml",
): ValidationResult {
  const result = emptyValidationResult();

  let parsed: unknown;
  try {
    parsed = yaml.load(source);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(`${sourceName}: invalid YAML syntax: ${message}`);
    result.valid = false;
    return result;
  }

  // An empty config file is valid: GitHub defaults apply (Requirement 7.3).
  if (parsed === null || parsed === undefined) {
    return result;
  }

  if (!isRecord(parsed)) {
    result.errors.push(
      `${sourceName}: expected a mapping at the top level, ` +
        `got ${describeType(parsed)}.`,
    );
    result.valid = false;
    return result;
  }

  // blank_issues_enabled must be a boolean when present.
  if (
    parsed.blank_issues_enabled !== undefined &&
    typeof parsed.blank_issues_enabled !== "boolean"
  ) {
    result.errors.push(
      `${sourceName}: "blank_issues_enabled" must be a boolean, ` +
        `got ${describeType(parsed.blank_issues_enabled)}.`,
    );
    result.valid = false;
  }

  // contact_links is optional; when present it must be a list of valid entries.
  const contactLinks = parsed.contact_links;
  if (contactLinks === undefined || contactLinks === null) {
    return result;
  }

  if (!Array.isArray(contactLinks)) {
    result.errors.push(
      `${sourceName}: "contact_links" must be a list, ` +
        `got ${describeType(contactLinks)}.`,
    );
    result.valid = false;
    return result;
  }

  contactLinks.forEach((link, index) => {
    validateContactLink(link, index, sourceName, result);
  });

  return result;
}

/**
 * Validate a single contact link entry (Requirements 7.5, 7.6). Each problem is
 * reported individually so one bad entry does not mask others.
 */
function validateContactLink(
  link: unknown,
  index: number,
  sourceName: string,
  result: ValidationResult,
): void {
  const entryLabel = `contact_links[${index}]`;

  if (!isRecord(link)) {
    result.errors.push(
      `${sourceName} ${entryLabel}: expected a mapping with name/url/about, ` +
        `got ${describeType(link)}.`,
    );
    result.valid = false;
    return;
  }

  // name: non-empty, max 100 chars.
  if (!isNonEmptyString(link.name)) {
    result.errors.push(
      `${sourceName} ${entryLabel}: missing or empty required field "name".`,
    );
    result.valid = false;
  } else if ((link.name as string).trim().length > MAX_CONTACT_NAME_LENGTH) {
    result.errors.push(
      `${sourceName} ${entryLabel}: "name" exceeds the maximum of ` +
        `${MAX_CONTACT_NAME_LENGTH} characters.`,
    );
    result.valid = false;
  }

  // url: non-empty, valid HTTPS URL.
  if (!isNonEmptyString(link.url)) {
    result.errors.push(
      `${sourceName} ${entryLabel}: missing or empty required field "url".`,
    );
    result.valid = false;
  } else if (!isHttpsUrl((link.url as string).trim())) {
    result.errors.push(
      `${sourceName} ${entryLabel}: "url" must be a valid HTTPS URL, ` +
        `got "${(link.url as string).trim()}".`,
    );
    result.valid = false;
  }

  // about: non-empty, max 200 chars.
  if (!isNonEmptyString(link.about)) {
    result.errors.push(
      `${sourceName} ${entryLabel}: missing or empty required field "about".`,
    );
    result.valid = false;
  } else if ((link.about as string).trim().length > MAX_CONTACT_ABOUT_LENGTH) {
    result.errors.push(
      `${sourceName} ${entryLabel}: "about" exceeds the maximum of ` +
        `${MAX_CONTACT_ABOUT_LENGTH} characters.`,
    );
    result.valid = false;
  }
}

/**
 * Read an ISSUE_TEMPLATE directory from disk and validate every template file
 * (`*.yml`/`*.yaml` excluding `config.yml`) plus the chooser config.
 *
 * Cross-template name uniqueness is enforced here, case-insensitively
 * (Requirement 6.1). A missing or unreadable directory is reported as an error.
 *
 * @param dirPath Path to the ISSUE_TEMPLATE directory.
 * @returns A {@link ValidationResult} aggregating every problem found.
 */
export function validateTemplatesDir(
  dirPath: string = DEFAULT_TEMPLATE_DIR,
): ValidationResult {
  const result = emptyValidationResult();

  let entries: string[];
  try {
    entries = fs.readdirSync(dirPath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(`${dirPath}: unable to read directory: ${message}`);
    result.valid = false;
    return result;
  }

  // Separate the chooser config from the template files.
  const templateFiles = entries
    .filter((name) => name.toLowerCase() !== CONFIG_FILENAME)
    .filter((name) => /\.ya?ml$/i.test(name))
    .sort();

  if (templateFiles.length === 0) {
    result.errors.push(
      `${dirPath}: no issue template files (*.yml) found.`,
    );
    result.valid = false;
  }

  // Validate each template and collect names for duplicate detection.
  // Maps lowercase name -> first file that declared it.
  const seenNames = new Map<string, string>();

  for (const fileName of templateFiles) {
    const filePath = path.join(dirPath, fileName);
    let source: string;
    try {
      source = fs.readFileSync(filePath, "utf8");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`${filePath}: unable to read file: ${message}`);
      result.valid = false;
      continue;
    }

    const templateResult = validateIssueTemplate(source, filePath);
    mergeResult(result, templateResult);

    // Name-uniqueness check across templates (Requirement 6.1).
    if (templateResult.templateName !== undefined) {
      const existing = seenNames.get(templateResult.templateName);
      if (existing !== undefined) {
        result.errors.push(
          `${filePath}: duplicate template name "${templateResult.templateName}" ` +
            `(case-insensitive) — already declared by ${existing}.`,
        );
        result.valid = false;
      } else {
        seenNames.set(templateResult.templateName, filePath);
      }
    }
  }

  // Validate the chooser config if present.
  const configPath = path.join(dirPath, CONFIG_FILENAME);
  if (fs.existsSync(configPath)) {
    let configSource: string;
    try {
      configSource = fs.readFileSync(configPath, "utf8");
      mergeResult(result, validateChooserConfig(configSource, configPath));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`${configPath}: unable to read file: ${message}`);
      result.valid = false;
    }
  }

  return result;
}

/** Merge the errors/warnings of `source` into `target`, updating validity. */
function mergeResult(target: ValidationResult, source: ValidationResult): void {
  target.errors.push(...source.errors);
  target.warnings.push(...source.warnings);
  if (!source.valid) {
    target.valid = false;
  }
}

/** Type guard: is the given lowercased string a known Form_Element type. */
function isValidElementType(type: string): type is ElementType {
  return (VALID_ELEMENT_TYPES as readonly string[]).includes(type);
}

/** Return true only for a well-formed URL using the HTTPS protocol. */
function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
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
    lines.push(`\u2713 ${label}: valid.`);
  } else {
    lines.push(`\u2717 ${label}: ${result.errors.length} error(s).`);
  }
  for (const error of result.errors) {
    lines.push(`  error: ${error}`);
  }
  for (const warning of result.warnings) {
    lines.push(`  warning: ${warning}`);
  }
  return lines.join("\n");
}

// When run directly (ts-node scripts/validate-templates.ts [dir]), validate the
// issue template directory and exit with a non-zero status on failure.
if (require.main === module) {
  const target = process.argv[2] ?? DEFAULT_TEMPLATE_DIR;
  const result = validateTemplatesDir(target);
  // eslint-disable-next-line no-console
  console.log(formatResult(result, target));
  process.exit(result.valid ? 0 : 1);
}
