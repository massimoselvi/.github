/**
 * Shared TypeScript types, interfaces, type guards, and utility types for the
 * organization `.github` repository tooling (validation + label sync scripts).
 *
 * YAML and JSON configuration files are parsed into `unknown` values at runtime
 * (e.g. via `js-yaml` or `JSON.parse`). The type guards in this module narrow
 * those `unknown` values into the structured interfaces below so downstream
 * validators and the label-sync logic can work against typed data.
 *
 * NOTE ON CONSTRAINTS: Several constraints (maximum counts, maximum string
 * lengths, HTTPS-only URLs, Octicon-name validity) cannot be expressed in the
 * TypeScript type system. They are documented as comments on the relevant
 * fields and MUST be enforced at runtime by the validators that will be built
 * in later tasks. The guards here perform *structural* narrowing only (shape
 * and primitive types), not full business-rule validation, except where a
 * constraint is cheap and central (e.g. `isValidHexColor`).
 *
 * _Requirements: 5.3, 10.1, 11.1, 12.6_
 */

// ---------------------------------------------------------------------------
// Utility types for parsed YAML / JSON content
// ---------------------------------------------------------------------------

/**
 * Any value produced by `JSON.parse` or a YAML parser configured for the JSON
 * schema. Parsed configuration content should be typed as `JsonValue` (or the
 * broader `unknown`) before being narrowed by a type guard.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** A JSON object: a string-keyed map of {@link JsonValue}s. */
export type JsonObject = { [key: string]: JsonValue };

/**
 * The result of parsing a YAML document. YAML's default schema can produce
 * values JSON cannot (e.g. `undefined` for empty documents), so this is modeled
 * as `unknown` to force callers through a type guard before use.
 */
export type ParsedYaml = unknown;

/**
 * A branded string representing a 6-character hexadecimal color (no leading
 * `#`). Only values matching `^[0-9a-fA-F]{6}$` are valid. Use
 * {@link isValidHexColor} to narrow a `string` to this type.
 */
export type HexColor = string & { readonly __brand: 'HexColor' };

/** Makes the listed keys `K` of `T` required (non-optional) while keeping the rest. */
export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

/** Recursively marks every property of `T` as optional. Useful for partial parsed input. */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? DeepPartial<U>[]
    : T[P] extends object
      ? DeepPartial<T[P]>
      : T[P];
};

// ---------------------------------------------------------------------------
// Label definitions (labels.yml) — Requirements 11.1, 12.6
// ---------------------------------------------------------------------------

/**
 * A single canonical label definition from `.github/labels.yml`.
 *
 * _Requirements: 11.1, 12.6_
 */
export interface LabelDefinition {
  /** Required, non-empty label name. Must be unique case-insensitively across the set. */
  name: string;
  /** Required 6-character hex color (no `#`), matching `^[0-9a-fA-F]{6}$`. */
  color: HexColor;
  /** Required label description. */
  description: string;
  /**
   * Optional list of previous label names to rename from (case-insensitive match).
   * CONSTRAINT: a maximum of 10 aliases per definition (requirement 12.6) —
   * enforced at runtime by the label validator, not by the type system.
   */
  aliases?: string[];
}

// ---------------------------------------------------------------------------
// Issue templates (.github/ISSUE_TEMPLATE/*.yml) — Requirement 5.3
// ---------------------------------------------------------------------------

/** Discriminant tag for the GitHub Issue Forms element variants. */
export type FormElementType =
  | 'input'
  | 'textarea'
  | 'dropdown'
  | 'checkboxes'
  | 'markdown';

/**
 * Attributes shared by every interactive form element (all variants except
 * Markdown). The `required` attribute is configurable and defaults to `false`
 * when omitted (requirement 5.3).
 */
export interface FormElementCommon {
  /** Human-readable field label shown in the rendered form. */
  label: string;
  /** Optional helper text describing the field. */
  description?: string;
  /** Whether the field must be filled in. Defaults to `false` when omitted. */
  required?: boolean;
}

/** A single-line text field. */
export interface InputFormElement extends FormElementCommon {
  type: 'input';
  /** Optional placeholder text shown in the empty field. */
  placeholder?: string;
}

/** A multi-line text field. */
export interface TextareaFormElement extends FormElementCommon {
  type: 'textarea';
  /** Optional placeholder text shown in the empty field. */
  placeholder?: string;
}

/** A single-select dropdown. */
export interface DropdownFormElement extends FormElementCommon {
  type: 'dropdown';
  /** The selectable options. */
  options: string[];
}

/** A set of checkboxes. */
export interface CheckboxesFormElement extends FormElementCommon {
  type: 'checkboxes';
  /** The checkbox options. */
  options: string[];
}

/**
 * Static rendered Markdown content. Unlike the other variants this carries no
 * `label`/`required` attributes — it is display-only and never submitted.
 */
export interface MarkdownFormElement {
  type: 'markdown';
  /** The Markdown content rendered in the form. */
  content: string;
}

/**
 * Discriminated union of all issue-form element variants, discriminated on the
 * `type` field (requirement 5.3).
 */
export type FormElement =
  | InputFormElement
  | TextareaFormElement
  | DropdownFormElement
  | CheckboxesFormElement
  | MarkdownFormElement;

/**
 * A GitHub Issue Forms template (`.github/ISSUE_TEMPLATE/*.yml`).
 *
 * _Requirements: 5.3_
 */
export interface IssueTemplate {
  /** Template name. Must be unique (case-insensitive) within the directory. */
  name: string;
  /** Short description shown in the template chooser (1-200 chars, enforced at runtime). */
  description: string;
  /** Prefix prepended to the contributor-supplied issue title (e.g. `[Bug]: `). */
  title_prefix: string;
  /** Labels auto-applied to issues created from this template. */
  labels: string[];
  /** Users auto-assigned to issues created from this template. */
  assignees: string[];
  /** Ordered list of form elements. Must contain at least one element (enforced at runtime). */
  body: FormElement[];
}

// ---------------------------------------------------------------------------
// Issue template chooser config (.github/ISSUE_TEMPLATE/config.yml) — Req 7
// ---------------------------------------------------------------------------

/**
 * An external contact link shown in the issue template chooser.
 *
 * CONSTRAINTS (enforced at runtime): `name` max 100 chars, `about` max 200
 * chars, and `url` must be a valid HTTPS URL (requirement 7.5).
 */
export interface ContactLink {
  /** Non-empty display name. Max 100 characters. */
  name: string;
  /** HTTPS URL the link points to. */
  url: string;
  /** Non-empty description of the link's purpose. Max 200 characters. */
  about: string;
}

/** The parsed `.github/ISSUE_TEMPLATE/config.yml` structure. */
export interface IssueTemplateConfig {
  /** When `false`, blank issues are disabled. Defaults to allowing blanks when absent. */
  blank_issues_enabled?: boolean;
  /** External contact links shown alongside templates. */
  contact_links?: ContactLink[];
}

// ---------------------------------------------------------------------------
// Workflow template properties (workflow-templates/*.properties.json) — Req 10.1
// ---------------------------------------------------------------------------

/**
 * Metadata for a workflow template, stored in a `*.properties.json` file
 * alongside the workflow YAML.
 *
 * _Requirements: 10.1_
 */
export interface WorkflowProperties {
  /** Display name. Must match the workflow template filename without extension. */
  name: string;
  /** Non-empty description. CONSTRAINT: max 200 characters (enforced at runtime). */
  description: string;
  /** A valid GitHub Octicon name (validity enforced at runtime). */
  iconName: string;
  /** GitHub-recognized categories. CONSTRAINT: at least 1 entry (enforced at runtime). */
  categories: string[];
  /** Optional glob patterns controlling which repos the template is suggested for. */
  filePatterns?: string[];
}

// ---------------------------------------------------------------------------
// Funding configuration (FUNDING.yml) — Requirement 11.1 (funding)
// ---------------------------------------------------------------------------

/**
 * The parsed `FUNDING.yml` configuration. At least one platform must be
 * specified; this is enforced at runtime by the funding validator.
 *
 * _Requirements: 11.1_
 */
export interface FundingConfig {
  /**
   * GitHub Sponsors usernames.
   * CONSTRAINT: a maximum of 4 usernames (enforced at runtime).
   */
  github?: string[];
  /** Open Collective slug. */
  open_collective?: string;
  /** Ko-fi username. */
  ko_fi?: string;
  /**
   * Custom funding URLs.
   * CONSTRAINT: up to 4 entries, each a valid HTTPS URL (enforced at runtime).
   */
  custom?: string[];
}

// ---------------------------------------------------------------------------
// Validation results
// ---------------------------------------------------------------------------

/**
 * A single validation failure. Validators accumulate these so that all
 * applicable errors can be reported at once (rather than failing fast).
 */
export interface ValidationError {
  /** Human-readable description of the failure. */
  message: string;
  /** The file the error relates to, when applicable (e.g. `labels.yml`). */
  file?: string;
  /** A location hint within the file (e.g. a key path, index, or line). */
  location?: string;
  /** A specific, machine-usable failure detail/code (e.g. `invalid-hex-color`). */
  detail?: string;
}

/**
 * The outcome of a validation pass. `valid` is `true` only when `errors` is
 * empty.
 */
export interface ValidationResult {
  /** Whether validation succeeded with no errors. */
  valid: boolean;
  /** All accumulated validation errors (empty when `valid` is `true`). */
  errors: ValidationError[];
}

/** Builds a successful {@link ValidationResult}. */
export function validResult(): ValidationResult {
  return { valid: true, errors: [] };
}

/** Builds a failing {@link ValidationResult} from one or more errors. */
export function invalidResult(errors: ValidationError[]): ValidationResult {
  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Low-level narrowing helpers
// ---------------------------------------------------------------------------

/** True when `value` is a non-null, non-array object. */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True when `value` is an array whose every element satisfies `itemGuard`. */
export function isArrayOf<T>(
  value: unknown,
  itemGuard: (item: unknown) => item is T,
): value is T[] {
  return Array.isArray(value) && value.every(itemGuard);
}

/** True when `value` is a `string`. */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/** True when `value` is a `string[]`. */
export function isStringArray(value: unknown): value is string[] {
  return isArrayOf(value, isString);
}

/** True when `value` is `undefined` or satisfies `guard`. */
export function isOptional<T>(
  value: unknown,
  guard: (v: unknown) => v is T,
): value is T | undefined {
  return value === undefined || guard(value);
}

// ---------------------------------------------------------------------------
// Domain type guards (narrow from `unknown`)
// ---------------------------------------------------------------------------

/** Matches a 6-character hexadecimal color with no leading `#`. */
const HEX_COLOR_PATTERN = /^[0-9a-fA-F]{6}$/;

/**
 * Narrows a value to {@link HexColor}: a string matching `^[0-9a-fA-F]{6}$`.
 */
export function isValidHexColor(value: unknown): value is HexColor {
  return typeof value === 'string' && HEX_COLOR_PATTERN.test(value);
}

/**
 * Narrows unknown parsed content to a {@link LabelDefinition}. Checks structure
 * and the hex-color format; does NOT enforce the 10-alias maximum (that is a
 * runtime business rule).
 */
export function isLabelDefinition(value: unknown): value is LabelDefinition {
  if (!isObject(value)) {
    return false;
  }
  return (
    isString(value.name) &&
    isValidHexColor(value.color) &&
    isString(value.description) &&
    isOptional(value.aliases, isStringArray)
  );
}

/** Narrows unknown parsed content to a {@link ContactLink} (structure only). */
export function isContactLink(value: unknown): value is ContactLink {
  if (!isObject(value)) {
    return false;
  }
  return (
    isString(value.name) && isString(value.url) && isString(value.about)
  );
}

/**
 * Narrows unknown parsed content to an {@link IssueTemplateConfig}. Structure
 * only; does not enforce contact-link length/HTTPS constraints.
 */
export function isIssueTemplateConfig(
  value: unknown,
): value is IssueTemplateConfig {
  if (!isObject(value)) {
    return false;
  }
  const blankOk =
    value.blank_issues_enabled === undefined ||
    typeof value.blank_issues_enabled === 'boolean';
  const linksOk =
    value.contact_links === undefined ||
    isArrayOf(value.contact_links, isContactLink);
  return blankOk && linksOk;
}

/**
 * Narrows unknown parsed content to a {@link FundingConfig}. Structure only;
 * does not enforce max-count, HTTPS, or "at least one platform" rules.
 */
export function isFundingConfig(value: unknown): value is FundingConfig {
  if (!isObject(value)) {
    return false;
  }
  return (
    isOptional(value.github, isStringArray) &&
    isOptional(value.open_collective, isString) &&
    isOptional(value.ko_fi, isString) &&
    isOptional(value.custom, isStringArray)
  );
}

/**
 * Narrows unknown parsed content to {@link WorkflowProperties}. Structure only;
 * does not enforce description length, Octicon validity, or `categories`
 * minimum count.
 */
export function isWorkflowProperties(
  value: unknown,
): value is WorkflowProperties {
  if (!isObject(value)) {
    return false;
  }
  return (
    isString(value.name) &&
    isString(value.description) &&
    isString(value.iconName) &&
    isStringArray(value.categories) &&
    isOptional(value.filePatterns, isStringArray)
  );
}

/** True when `value` is a valid {@link FormElementType} discriminant string. */
export function isFormElementType(value: unknown): value is FormElementType {
  return (
    value === 'input' ||
    value === 'textarea' ||
    value === 'dropdown' ||
    value === 'checkboxes' ||
    value === 'markdown'
  );
}

/**
 * Narrows unknown parsed content to a {@link FormElement}, dispatching on the
 * `type` discriminant. Structure only.
 */
export function isFormElement(value: unknown): value is FormElement {
  if (!isObject(value) || !isFormElementType(value.type)) {
    return false;
  }

  if (value.type === 'markdown') {
    return isString(value.content);
  }

  // Shared interactive-element attributes.
  const commonOk =
    isString(value.label) &&
    isOptional(value.description, isString) &&
    (value.required === undefined || typeof value.required === 'boolean');
  if (!commonOk) {
    return false;
  }

  switch (value.type) {
    case 'input':
    case 'textarea':
      return isOptional(value.placeholder, isString);
    case 'dropdown':
    case 'checkboxes':
      return isStringArray(value.options);
    default:
      return false;
  }
}

/**
 * Narrows unknown parsed content to an {@link IssueTemplate}. Structure only;
 * does not enforce description length or the non-empty-body rule.
 */
export function isIssueTemplate(value: unknown): value is IssueTemplate {
  if (!isObject(value)) {
    return false;
  }
  return (
    isString(value.name) &&
    isString(value.description) &&
    isString(value.title_prefix) &&
    isStringArray(value.labels) &&
    isStringArray(value.assignees) &&
    isArrayOf(value.body, isFormElement)
  );
}
