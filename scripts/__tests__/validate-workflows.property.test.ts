/**
 * Property-based tests for the workflow template validator.
 *
 * Encodes **Property 2: Workflow Template Consistency** from the design
 * document:
 *
 *   *For any* workflow template file (*.yml) in the `workflow-templates/`
 *   directory, there SHALL exist a corresponding properties file
 *   (*.properties.json) whose `name` field matches the workflow template
 *   filename (without extension), and the properties file SHALL contain valid
 *   values for the required fields.
 *
 * **Validates: Requirements 10.1, 10.2, 10.7**
 *
 * The tests generate arbitrary workflow filenames, valid workflow YAML bodies,
 * and properties JSON objects with fast-check, then feed them to the in-memory
 * {@link validateWorkflowTemplate} entry point (no temp directories needed).
 * Two directions are exercised:
 *
 *   1. A consistent pair (valid workflow YAML; properties JSON carrying all
 *      required fields `name`/`description`/`iconName`/`categories`; and the
 *      properties `name` equal to the workflow filename without extension) MUST
 *      be reported as `valid === true` with no errors.
 *   2. An inconsistent pair — a missing properties file, a missing workflow
 *      file, a name mismatch, a missing/empty required properties field, or
 *      invalid workflow YAML / properties JSON — MUST be reported as
 *      `valid === false` with at least one corresponding error.
 *
 * Secret scanning is Property 3 (task 11.3) and lives in a separate test file;
 * every workflow body generated here is deliberately secret-free so it does not
 * interfere with the consistency property under test.
 *
 * Run with: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import * as fc from "fast-check";
import * as yaml from "js-yaml";

import {
  validateWorkflowTemplate,
  PROPERTIES_SUFFIX,
} from "../validate-workflows";
import { WorkflowProperties } from "../types";

/** Number of generated cases per property. */
const NUM_RUNS = 500;

/** Required fields every properties file must carry (Requirement 10.7). */
const REQUIRED_FIELDS = [
  "name",
  "description",
  "iconName",
  "categories",
] as const;

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * A non-empty base name (the workflow filename without extension). Constrained
 * to a friendly, whitespace-free charset so that the validator's `.trim()` and
 * the exact `name === baseName` comparison reason about the same string.
 */
const baseNameArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 24 })
  .map((s) => s.replace(/[^A-Za-z0-9._-]/g, "_"))
  .filter((s) => s.length > 0 && s.trim() === s && !s.includes(".."));

/** A workflow filename with a `.yml` or `.yaml` extension. */
const workflowNameArb: fc.Arbitrary<{ name: string; base: string }> = fc
  .tuple(baseNameArb, fc.constantFrom(".yml", ".yaml"))
  .map(([base, ext]) => ({ name: `${base}${ext}`, base }));

/** A non-empty, secret-free descriptive string. */
const safeStringArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 40 })
  .map((s) => s.replace(/[^A-Za-z0-9 _.-]/g, "_").trim())
  .filter((s) => s.length > 0);

/** A non-empty list of non-empty category strings. */
const categoriesArb: fc.Arbitrary<string[]> = fc.array(safeStringArb, {
  minLength: 1,
  maxLength: 5,
});

/**
 * A syntactically valid workflow YAML body with no hardcoded secrets. Secret
 * references, when present, use the `${{ secrets.* }}` form exclusively so the
 * secret scanner (Property 3) never trips this consistency property.
 */
const workflowYamlArb: fc.Arbitrary<string> = fc
  .record({
    name: safeStringArb,
    on: fc.constantFrom("push", "pull_request", "workflow_dispatch"),
    jobStep: safeStringArb,
    useSecret: fc.boolean(),
  })
  .map(({ name, on, jobStep, useSecret }) => {
    const workflow: Record<string, unknown> = {
      name,
      on,
      jobs: {
        build: {
          "runs-on": "ubuntu-latest",
          steps: [
            {
              name: jobStep,
              run: useSecret
                ? "echo \"${{ secrets.EXAMPLE_TOKEN }}\""
                : "echo hello",
            },
          ],
        },
      },
    };
    return yaml.dump(workflow);
  });

/**
 * Build a well-formed properties JSON string for a given base name. Every
 * required field is present with a usable value and `name` matches `base`.
 */
function toPropertiesJson(
  base: string,
  overrides: Partial<Record<string, unknown>> = {},
): string {
  const properties: WorkflowProperties & Record<string, unknown> = {
    name: base,
    description: "An example workflow template.",
    iconName: "workflow",
    categories: ["Continuous integration"],
    ...overrides,
  };
  return JSON.stringify(properties);
}

// ---------------------------------------------------------------------------
// Property 2 — the positive direction: a consistent pair validates as valid.
// ---------------------------------------------------------------------------

test("Property 2: a consistent workflow + properties pair validates as valid", () => {
  fc.assert(
    fc.property(
      workflowNameArb,
      workflowYamlArb,
      safeStringArb,
      safeStringArb,
      categoriesArb,
      ({ name, base }, workflowYaml, description, iconName, categories) => {
        const propertiesSource = toPropertiesJson(base, {
          description,
          iconName,
          categories,
        });

        const result = validateWorkflowTemplate(
          name,
          workflowYaml,
          propertiesSource,
        );

        assert.equal(
          result.valid,
          true,
          `Expected valid=true but got errors: ${JSON.stringify(result.errors)}`,
        );
        assert.equal(result.errors.length, 0);
      },
    ),
    { numRuns: NUM_RUNS },
  );
});

// ---------------------------------------------------------------------------
// Property 2 — negative: a missing properties file is rejected (Req 10.1).
// ---------------------------------------------------------------------------

test("Property 2: a workflow with no properties file is rejected", () => {
  fc.assert(
    fc.property(workflowNameArb, workflowYamlArb, ({ name }, workflowYaml) => {
      const result = validateWorkflowTemplate(name, workflowYaml, null);
      assert.equal(result.valid, false);
      assert.ok(
        result.errors.some((e) => e.includes("properties file")),
        `Expected a missing-properties error, got: ${JSON.stringify(result.errors)}`,
      );
    }),
    { numRuns: NUM_RUNS },
  );
});

// ---------------------------------------------------------------------------
// Property 2 — negative: a missing workflow file is rejected (Req 10.1).
// ---------------------------------------------------------------------------

test("Property 2: a properties file with no workflow template is rejected", () => {
  fc.assert(
    fc.property(workflowNameArb, ({ name, base }) => {
      const propertiesSource = toPropertiesJson(base);
      const result = validateWorkflowTemplate(name, null, propertiesSource);
      assert.equal(result.valid, false);
      assert.ok(
        result.errors.some((e) => e.includes("no matching workflow template")),
        `Expected a missing-workflow error, got: ${JSON.stringify(result.errors)}`,
      );
    }),
    { numRuns: NUM_RUNS },
  );
});

// ---------------------------------------------------------------------------
// Property 2 — negative: a properties `name` mismatch is rejected (Req 10.2).
// ---------------------------------------------------------------------------

test("Property 2: a properties name not matching the filename is rejected", () => {
  fc.assert(
    fc.property(
      workflowNameArb,
      workflowYamlArb,
      safeStringArb,
      ({ name, base }, workflowYaml, otherName) => {
        // Ensure the injected name genuinely differs from the base name.
        fc.pre(otherName !== base);

        const propertiesSource = toPropertiesJson(base, { name: otherName });
        const result = validateWorkflowTemplate(
          name,
          workflowYaml,
          propertiesSource,
        );

        assert.equal(result.valid, false);
        assert.ok(
          result.errors.some((e) => e.toLowerCase().includes("name")),
          `Expected a name-mismatch error, got: ${JSON.stringify(result.errors)}`,
        );
      },
    ),
    { numRuns: NUM_RUNS },
  );
});

// ---------------------------------------------------------------------------
// Property 2 — negative: a missing required properties field is rejected
// (Req 10.7).
// ---------------------------------------------------------------------------

test("Property 2: a properties file missing a required field is rejected", () => {
  fc.assert(
    fc.property(
      workflowNameArb,
      workflowYamlArb,
      fc.constantFrom(...REQUIRED_FIELDS),
      ({ name, base }, workflowYaml, fieldToDrop) => {
        // Build a well-formed object, then delete exactly one required field.
        const complete: Record<string, unknown> = {
          name: base,
          description: "An example workflow template.",
          iconName: "workflow",
          categories: ["Continuous integration"],
        };
        delete complete[fieldToDrop];
        const propertiesSource = JSON.stringify(complete);

        const result = validateWorkflowTemplate(
          name,
          workflowYaml,
          propertiesSource,
        );

        assert.equal(
          result.valid,
          false,
          `Expected valid=false after dropping "${fieldToDrop}"`,
        );
        assert.ok(
          result.errors.length > 0,
          `Expected at least one error, got: ${JSON.stringify(result.errors)}`,
        );
      },
    ),
    { numRuns: NUM_RUNS },
  );
});

// ---------------------------------------------------------------------------
// Property 2 — negative: invalid workflow YAML is rejected (Req 10.7).
// ---------------------------------------------------------------------------

test("Property 2: a workflow with invalid YAML syntax is rejected", () => {
  // A YAML document that cannot parse: an unterminated flow mapping.
  const brokenYaml = "name: broken\non: push\njobs: { build: [";

  fc.assert(
    fc.property(workflowNameArb, ({ name, base }) => {
      const propertiesSource = toPropertiesJson(base);
      const result = validateWorkflowTemplate(
        name,
        brokenYaml,
        propertiesSource,
      );

      assert.equal(result.valid, false);
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("yaml")),
        `Expected a YAML syntax error, got: ${JSON.stringify(result.errors)}`,
      );
    }),
    { numRuns: NUM_RUNS },
  );
});

// ---------------------------------------------------------------------------
// Property 2 — negative: invalid properties JSON is rejected (Req 10.7).
// ---------------------------------------------------------------------------

test("Property 2: a properties file with invalid JSON is rejected", () => {
  fc.assert(
    fc.property(
      workflowNameArb,
      workflowYamlArb,
      ({ name }, workflowYaml) => {
        // Not valid JSON: a trailing comma and an unquoted key.
        const brokenJson = "{ name: ,";
        const result = validateWorkflowTemplate(
          name,
          workflowYaml,
          brokenJson,
        );

        assert.equal(result.valid, false);
        assert.ok(
          result.errors.some((e) => e.toLowerCase().includes("json")),
          `Expected a JSON parse error, got: ${JSON.stringify(result.errors)}`,
        );
      },
    ),
    { numRuns: NUM_RUNS },
  );
});

// Reference PROPERTIES_SUFFIX so the import is exercised and the expected
// properties filename convention stays pinned by the test suite.
test("Property 2: the properties suffix convention is stable", () => {
  assert.equal(PROPERTIES_SUFFIX, ".properties.json");
});
