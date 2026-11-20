/**
 * Property-based tests for the "no hardcoded secrets" rule in the workflow
 * template validator.
 *
 * Encodes **Property 3: No Hardcoded Secrets in Workflow Templates** from the
 * design document:
 *
 *   *For any* workflow template file in the `workflow-templates/` directory,
 *   the file SHALL NOT contain hardcoded secret values. All secret references
 *   SHALL use the `${{ secrets.* }}` syntax exclusively.
 *
 * **Validates: Requirements 15.2**
 *
 * The tests generate arbitrary workflow template bodies with fast-check and
 * feed them to {@link validateWorkflowTemplate} together with a VALID, matching
 * properties JSON document. Pairing every workflow with a well-formed
 * properties file means the ONLY possible cause of a validation failure is the
 * secret content of the workflow body — this isolates the property under test.
 *
 * Two directions are exercised:
 *
 *   1. Workflow bodies whose secret references use ONLY the
 *      `${{ secrets.NAME }}` syntax (and contain no hardcoded literals) MUST be
 *      reported as `valid === true` with no secret error.
 *   2. Workflow bodies seeded with at least one hardcoded secret literal (fake
 *      PEM block, ghp_/github_pat_ token, AKIA/ASIA key, xox token, or an
 *      inline `token:/password:/api_key:` assignment) MUST be reported as
 *      `valid === false` with a secret-related error.
 *
 * All generated secret values are clearly FAKE/synthetic (random alphanumerics
 * appended to a recognizable prefix); no real credentials are used.
 *
 * Run with: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import * as fc from "fast-check";

import {
  validateWorkflowTemplate,
  PROPERTIES_SUFFIX,
} from "../validate-workflows";

/** Number of generated cases per property. */
const NUM_RUNS = 500;

/** The workflow filename every generated template is validated against. */
const WORKFLOW_NAME = "ci-pipeline.yml";
/** Base name (without extension) the properties `name` field must match. */
const WORKFLOW_BASE = "ci-pipeline";

/**
 * Build a VALID properties JSON document whose `name` matches the workflow
 * filename without extension. Supplying this alongside every workflow body
 * guarantees the properties side never contributes an error, so any failure is
 * attributable solely to the workflow's secret content.
 */
function validPropertiesSource(): string {
  return JSON.stringify({
    name: WORKFLOW_BASE,
    description: "Standard organization CI pipeline.",
    iconName: "rocket",
    categories: ["Continuous integration"],
  });
}

// Sanity check that the suffix import is wired correctly / documents intent.
assert.equal(`${WORKFLOW_BASE}${PROPERTIES_SUFFIX}`, "ci-pipeline.properties.json");

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Random lowercase alphanumeric run of a given length (for fake secrets). */
function randomAlnumArb(minLength: number, maxLength: number): fc.Arbitrary<string> {
  return fc
    .array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789".split("")), {
      minLength,
      maxLength,
    })
    .map((chars) => chars.join(""));
}

/** An uppercase SCREAMING_SNAKE_CASE identifier for a secret name. */
const secretNameArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZ_".split("")), {
    minLength: 2,
    maxLength: 20,
  })
  .map((chars) => chars.join(""))
  // Must start with a letter and be non-empty under GitHub's secret naming.
  .map((s) => (/^[A-Z]/.test(s) ? s : `S${s}`));

/** A short YAML-safe step name token (no secret-triggering keywords). */
const tokenArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789-".split("")), {
    minLength: 1,
    maxLength: 12,
  })
  .map((chars) => chars.join(""))
  .map((s) => (/^[a-z]/.test(s) ? s : `s${s}`));

/**
 * A clean workflow body that references secrets EXCLUSIVELY through the
 * `${{ secrets.NAME }}` context. No hardcoded literals, no secret-triggering
 * assignment keywords with inline values.
 */
const cleanWorkflowArb: fc.Arbitrary<string> = fc
  .record({
    workflowName: tokenArb,
    jobName: tokenArb,
    stepName: tokenArb,
    envName: secretNameArb,
    secretRefs: fc.uniqueArray(secretNameArb, { minLength: 1, maxLength: 4 }),
  })
  .map(({ workflowName, jobName, stepName, envName, secretRefs }) => {
    const envLines = secretRefs
      .map(
        (name, i) =>
          `      ${envName}_${i}: \${{ secrets.${name} }}`,
      )
      .join("\n");
    return [
      `name: ${workflowName}`,
      "on: [push]",
      "jobs:",
      `  ${jobName}:`,
      "    runs-on: ubuntu-latest",
      "    steps:",
      `      - name: ${stepName}`,
      "        run: echo running",
      "    env:",
      envLines,
      "",
    ].join("\n");
  });

/**
 * A single FAKE hardcoded secret literal, drawn from each category the
 * validator detects. Values are synthetic and recognizably non-real.
 */
const hardcodedSecretArb: fc.Arbitrary<string> = fc.oneof(
  // Fake PEM private key block.
  randomAlnumArb(20, 40).map(
    (body) =>
      `        key: "-----BEGIN PRIVATE KEY-----\\n${body}\\n-----END PRIVATE KEY-----"`,
  ),
  // Fake GitHub personal access token (ghp_).
  randomAlnumArb(30, 36).map((body) => `        run: echo ghp_${body}`),
  // Fake GitHub fine-grained PAT (github_pat_).
  randomAlnumArb(30, 40).map((body) => `        run: echo github_pat_${body}`),
  // Fake AWS access key id (AKIA/ASIA + 16 upper/digits).
  fc
    .tuple(
      fc.constantFrom("AKIA", "ASIA"),
      fc
        .array(fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("")), {
          minLength: 16,
          maxLength: 16,
        })
        .map((chars) => chars.join("")),
    )
    .map(([prefix, rest]) => `        run: echo ${prefix}${rest}`),
  // Fake Slack token (xox*-...).
  fc
    .tuple(fc.constantFrom("xoxb", "xoxp", "xoxa", "xoxr", "xoxs"), randomAlnumArb(12, 24))
    .map(([prefix, body]) => `        run: echo ${prefix}-${body}`),
  // Inline token/password/api_key literal assignment.
  fc
    .tuple(
      fc.constantFrom("token", "password", "api_key", "API_KEY", "client_secret"),
      randomAlnumArb(12, 24),
    )
    .map(([keyword, body]) => `        ${keyword}: "${body}"`),
);

/**
 * Inject a hardcoded secret line into an otherwise-clean workflow body. The
 * resulting body still references secrets via `${{ secrets.* }}` as well, so
 * this also confirms that a valid reference does NOT excuse a hardcoded literal.
 */
const workflowWithSecretArb: fc.Arbitrary<string> = fc
  .tuple(cleanWorkflowArb, hardcodedSecretArb)
  .map(([clean, secretLine]) => {
    const lines = clean.split("\n");
    // Insert the offending line right after the `run: echo running` step line.
    const insertAt = lines.findIndex((l) => l.includes("run: echo running"));
    const at = insertAt >= 0 ? insertAt + 1 : lines.length;
    lines.splice(at, 0, secretLine);
    return lines.join("\n");
  });

/** True when a result contains a secret-detection error. */
function hasSecretError(errors: string[]): boolean {
  return errors.some((e) => e.toLowerCase().includes("hardcoded secret"));
}

// ---------------------------------------------------------------------------
// Property 3 — positive direction: `${{ secrets.* }}`-only bodies are valid.
// ---------------------------------------------------------------------------

test("Property 3: workflow using only ${{ secrets.* }} references validates as valid", () => {
  fc.assert(
    fc.property(cleanWorkflowArb, (workflowSource) => {
      const result = validateWorkflowTemplate(
        WORKFLOW_NAME,
        workflowSource,
        validPropertiesSource(),
      );
      assert.equal(
        result.valid,
        true,
        `Expected valid=true but got errors: ${JSON.stringify(result.errors)}`,
      );
      assert.equal(
        hasSecretError(result.errors),
        false,
        `Expected no secret error, got: ${JSON.stringify(result.errors)}`,
      );
    }),
    { numRuns: NUM_RUNS },
  );
});

// ---------------------------------------------------------------------------
// Property 3 — negative direction: a hardcoded secret literal is rejected.
// ---------------------------------------------------------------------------

test("Property 3: workflow containing a hardcoded secret is rejected", () => {
  fc.assert(
    fc.property(workflowWithSecretArb, (workflowSource) => {
      const result = validateWorkflowTemplate(
        WORKFLOW_NAME,
        workflowSource,
        validPropertiesSource(),
      );
      assert.equal(
        result.valid,
        false,
        `Expected valid=false for body:\n${workflowSource}`,
      );
      assert.ok(
        hasSecretError(result.errors),
        `Expected a hardcoded-secret error, got: ${JSON.stringify(result.errors)}`,
      );
    }),
    { numRuns: NUM_RUNS },
  );
});
