/**
 * Property-based tests for the issue template structural validator.
 *
 * Encodes **Property 6: Issue Template Structural Validity** from the design
 * document:
 *
 *   *For any* issue template in the `.github/ISSUE_TEMPLATE/` directory, the
 *   template SHALL have a unique name (no two templates share the same name), a
 *   non-empty description field, and at least one Form_Element in its body. If
 *   any of these conditions are violated, the validator SHALL produce a
 *   descriptive error.
 *
 * **Validates: Requirements 6.1, 6.2, 6.3**
 *
 * The tests generate arbitrary issue templates with fast-check, serialize them
 * to YAML with js-yaml, and feed the result to {@link validateIssueTemplate}.
 * Two directions are exercised:
 *
 *   1. Well-formed templates (valid name, description within the
 *      1-200 character bounds, body with >=1 element each declaring a valid
 *      Form_Element type and the attributes that type requires) MUST be
 *      reported as `valid === true`.
 *   2. Templates seeded with a single structural violation (missing name,
 *      missing/out-of-bounds description, missing/empty body, an element with an
 *      invalid type, or an element missing its required attributes) MUST be
 *      reported as `valid === false` with at least one corresponding error.
 *
 * Run with: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import * as fc from "fast-check";
import * as yaml from "js-yaml";

import {
  validateIssueTemplate,
  VALID_ELEMENT_TYPES,
  MIN_DESCRIPTION_LENGTH,
  MAX_DESCRIPTION_LENGTH,
} from "../validate-templates";

/** Number of generated cases per property. */
const NUM_RUNS = 500;

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** A non-empty, YAML-safe name that survives `.trim()` intact. */
const nameArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 40 })
  .map((s) => s.replace(/[^A-Za-z0-9 _-]/g, "_"))
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

/**
 * A description whose trimmed length lands within the inclusive
 * [MIN_DESCRIPTION_LENGTH, MAX_DESCRIPTION_LENGTH] bounds. Built from a safe,
 * non-whitespace-edged charset so `.trim()` does not shrink it below the bound.
 */
const validDescriptionArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789 ._-".split("")), {
    minLength: MIN_DESCRIPTION_LENGTH,
    maxLength: MAX_DESCRIPTION_LENGTH,
  })
  .map((chars) => chars.join(""))
  // Guarantee a non-space first and last character so trimming is a no-op and
  // the length stays within bounds.
  .map((s) => `d${s}d`.slice(0, MAX_DESCRIPTION_LENGTH))
  .filter((s) => {
    const len = s.trim().length;
    return len >= MIN_DESCRIPTION_LENGTH && len <= MAX_DESCRIPTION_LENGTH;
  });

/** A non-empty attribute string (label / value / option text). */
const attrTextArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 30 })
  .map((s) => s.replace(/[^A-Za-z0-9 _.-]/g, "_").trim())
  .filter((s) => s.length > 0);

/** A single well-formed body element whose `type` is drawn from the valid set. */
const wellFormedElementArb: fc.Arbitrary<Record<string, unknown>> = fc
  .constantFrom(...VALID_ELEMENT_TYPES)
  .chain((type): fc.Arbitrary<Record<string, unknown>> => {
    if (type === "markdown") {
      return attrTextArb.map((value) => ({
        type,
        attributes: { value },
      }));
    }

    if (type === "dropdown" || type === "checkboxes") {
      return fc
        .tuple(
          attrTextArb,
          fc.array(attrTextArb, { minLength: 1, maxLength: 5 }),
        )
        .map(([label, options]) => ({
          type,
          attributes: { label, options },
        }));
    }

    // input, textarea
    return attrTextArb.map((label) => ({
      type,
      attributes: { label },
    }));
  });

/** A well-formed issue template: valid name, in-bounds description, body >= 1. */
const wellFormedTemplateArb: fc.Arbitrary<Record<string, unknown>> = fc
  .tuple(
    nameArb,
    validDescriptionArb,
    fc.array(wellFormedElementArb, { minLength: 1, maxLength: 6 }),
  )
  .map(([name, description, body]) => ({ name, description, body }));

/** Serialize a template object to the YAML the validator expects. */
function toYaml(template: unknown): string {
  return yaml.dump(template);
}

// ---------------------------------------------------------------------------
// Property 6 — positive direction: well-formed templates validate.
// ---------------------------------------------------------------------------

test("Property 6: well-formed issue templates validate as valid", () => {
  fc.assert(
    fc.property(wellFormedTemplateArb, (template) => {
      const result = validateIssueTemplate(toYaml(template), "template.yml");
      assert.equal(
        result.valid,
        true,
        `Expected valid=true but got errors: ${JSON.stringify(result.errors)}`,
      );
      assert.equal(result.errors.length, 0);
      // A valid template exposes a lowercased/trimmed name for duplicate
      // detection (Requirement 6.1).
      assert.equal(
        result.templateName,
        (template.name as string).trim().toLowerCase(),
      );
    }),
    { numRuns: NUM_RUNS },
  );
});

// ---------------------------------------------------------------------------
// Property 6 — negative direction: a missing `name` is rejected (6.1).
// ---------------------------------------------------------------------------

test("Property 6: a template missing its name is rejected", () => {
  fc.assert(
    fc.property(wellFormedTemplateArb, (template) => {
      const { name: _omitted, ...withoutName } = template;
      const result = validateIssueTemplate(toYaml(withoutName), "template.yml");
      assert.equal(result.valid, false, "Expected valid=false for missing name");
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("name")),
        `Expected a name error, got: ${JSON.stringify(result.errors)}`,
      );
    }),
    { numRuns: NUM_RUNS },
  );
});

// ---------------------------------------------------------------------------
// Property 6 — negative direction: a missing/out-of-bounds description is
// rejected (6.2).
// ---------------------------------------------------------------------------

test("Property 6: a template with an invalid description is rejected", () => {
  // A description whose trimmed length is 0 (missing/empty) or exceeds the max.
  const invalidDescriptionArb: fc.Arbitrary<string> = fc.oneof(
    // Empty or whitespace-only -> trimmed length below MIN.
    fc.constantFrom("", "   ", "\t\n"),
    // Too long -> trimmed length above MAX.
    fc
      .array(fc.constantFrom(..."abcdefghij".split("")), {
        minLength: MAX_DESCRIPTION_LENGTH + 1,
        maxLength: MAX_DESCRIPTION_LENGTH + 50,
      })
      .map((chars) => chars.join("")),
  );

  fc.assert(
    fc.property(
      wellFormedTemplateArb,
      invalidDescriptionArb,
      (template, badDescription) => {
        const corrupted = { ...template, description: badDescription };
        const result = validateIssueTemplate(toYaml(corrupted), "template.yml");
        assert.equal(
          result.valid,
          false,
          `Expected valid=false for description of trimmed length ${badDescription.trim().length}`,
        );
        assert.ok(
          result.errors.some((e) => e.toLowerCase().includes("description")),
          `Expected a description error, got: ${JSON.stringify(result.errors)}`,
        );
      },
    ),
    { numRuns: NUM_RUNS },
  );
});

// ---------------------------------------------------------------------------
// Property 6 — negative direction: a missing or empty body is rejected (6.3).
// ---------------------------------------------------------------------------

test("Property 6: a template with a missing or empty body is rejected", () => {
  fc.assert(
    fc.property(wellFormedTemplateArb, fc.boolean(), (template, emptyList) => {
      // Either drop the body entirely or supply an empty list.
      let corrupted: Record<string, unknown>;
      if (emptyList) {
        corrupted = { ...template, body: [] };
      } else {
        const { body: _omitted, ...withoutBody } = template;
        corrupted = withoutBody;
      }

      const result = validateIssueTemplate(toYaml(corrupted), "template.yml");
      assert.equal(result.valid, false, "Expected valid=false for absent body");
      assert.ok(
        result.errors.some((e) => e.toLowerCase().includes("body")),
        `Expected a body error, got: ${JSON.stringify(result.errors)}`,
      );
    }),
    { numRuns: NUM_RUNS },
  );
});

// ---------------------------------------------------------------------------
// Property 6 — negative direction: a body element with an invalid Form_Element
// type is rejected (6.3).
// ---------------------------------------------------------------------------

test("Property 6: a body element with an invalid type is rejected", () => {
  // A non-empty type string that is NOT one of the valid Form_Element types.
  const invalidTypeArb: fc.Arbitrary<string> = fc
    .string({ minLength: 1, maxLength: 15 })
    .map((s) => s.replace(/[^A-Za-z0-9_-]/g, "_").trim())
    .filter(
      (s) =>
        s.length > 0 &&
        !(VALID_ELEMENT_TYPES as readonly string[]).includes(s.toLowerCase()),
    );

  fc.assert(
    fc.property(
      wellFormedTemplateArb,
      invalidTypeArb,
      fc.nat(),
      (template, badType, pick) => {
        const body = template.body as Record<string, unknown>[];
        const index = pick % body.length;
        const corruptedBody = body.map((el, i) =>
          i === index ? { ...el, type: badType } : el,
        );
        const corrupted = { ...template, body: corruptedBody };

        const result = validateIssueTemplate(toYaml(corrupted), "template.yml");
        assert.equal(
          result.valid,
          false,
          `Expected valid=false for invalid element type "${badType}"`,
        );
        assert.ok(
          result.errors.some((e) => e.toLowerCase().includes("type")),
          `Expected a type error, got: ${JSON.stringify(result.errors)}`,
        );
      },
    ),
    { numRuns: NUM_RUNS },
  );
});

// ---------------------------------------------------------------------------
// Property 6 — negative direction: a body element missing its required
// attributes is rejected (6.3).
// ---------------------------------------------------------------------------

test("Property 6: a body element missing required attributes is rejected", () => {
  fc.assert(
    fc.property(
      wellFormedTemplateArb,
      fc.nat(),
      (template, pick) => {
        const body = template.body as Record<string, unknown>[];
        const index = pick % body.length;
        // Strip the `attributes` mapping from one element so its type's
        // required attributes are absent.
        const corruptedBody = body.map((el, i) => {
          if (i !== index) return el;
          const { attributes: _omitted, ...withoutAttrs } = el;
          return withoutAttrs;
        });
        const corrupted = { ...template, body: corruptedBody };

        const result = validateIssueTemplate(toYaml(corrupted), "template.yml");
        assert.equal(
          result.valid,
          false,
          "Expected valid=false for element missing attributes",
        );
        assert.ok(
          result.errors.some((e) => e.toLowerCase().includes("attributes")),
          `Expected an attributes error, got: ${JSON.stringify(result.errors)}`,
        );
      },
    ),
    { numRuns: NUM_RUNS },
  );
});
