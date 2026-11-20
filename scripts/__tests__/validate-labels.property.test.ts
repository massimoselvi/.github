/**
 * Property-based tests for the label definitions validator.
 *
 * Encodes **Property 7: Label Definition Validity** from the design document:
 *
 *   *For any* set of label definitions in `labels.yml`, no two labels SHALL
 *   share the same name when compared case-insensitively, and every label's
 *   color field SHALL match the hexadecimal pattern `^[0-9a-fA-F]{6}$`.
 *
 * **Validates: Requirements 11.3, 12.4**
 *
 * The tests generate arbitrary sets of label definitions with fast-check,
 * serialize them to YAML with js-yaml, and feed the result to
 * {@link validateLabels}. Two directions are exercised:
 *
 *   1. Well-formed inputs (valid 6-char hex colors, all names/aliases unique
 *      case-insensitively) MUST be reported as `valid === true`.
 *   2. Inputs seeded with at least one invalid color OR at least one
 *      case-insensitive duplicate name/alias MUST be reported as
 *      `valid === false` with at least one error.
 *
 * Run with: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import * as fc from "fast-check";
import * as yaml from "js-yaml";

import {
  validateLabels,
  HEX_COLOR_PATTERN,
  MAX_ALIASES,
} from "../validate-labels";
import { LabelDefinition } from "../types";

/** Number of generated cases per property. */
const NUM_RUNS = 500;

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** A non-empty identifier (name or alias) that survives `.trim()` intact. */
const identifierArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 20 })
  // Keep to a friendly, YAML-safe, non-whitespace-edged charset so that the
  // validator's `.trim()` does not alter the value we reason about.
  .map((s) => s.replace(/[^A-Za-z0-9 _-]/g, "_"))
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

/** A valid 6-character hex color (no leading '#'). */
const validColorArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(..."0123456789abcdefABCDEF".split("")), {
    minLength: 6,
    maxLength: 6,
  })
  .map((chars) => chars.join(""));

/**
 * A color that does NOT match `^[0-9a-fA-F]{6}$` while remaining a non-empty
 * string (so the validator reports a color error rather than a missing-field
 * error). Covers wrong length, a leading '#', and non-hex characters.
 */
const invalidColorArb: fc.Arbitrary<string> = fc
  .oneof(
    // Wrong length (too short / too long) of otherwise-hex characters.
    fc
      .array(fc.constantFrom(..."0123456789abcdef".split("")), {
        minLength: 1,
        maxLength: 10,
      })
      .map((chars) => chars.join(""))
      .filter((s) => s.length !== 6),
    // Leading '#' plus 6 hex digits — common mistake, still invalid.
    validColorArb.map((c) => `#${c}`),
    // Six characters but containing at least one non-hex letter.
    fc
      .tuple(
        validColorArb,
        fc.constantFrom(..."ghijklmnopqrstuvwxyz".split("")),
      )
      .map(([c, bad]) => bad + c.slice(1)),
  )
  .filter((s) => s.trim().length > 0 && !HEX_COLOR_PATTERN.test(s.trim()));

/** A non-empty description. */
const descriptionArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 40 })
  .map((s) => s.replace(/[^A-Za-z0-9 _.-]/g, "_").trim())
  .filter((s) => s.length > 0);

/**
 * Generate a set of well-formed label definitions whose names and aliases are
 * globally unique when compared case-insensitively. A shared pool of unique
 * identifiers is drawn from without replacement to guarantee no collisions.
 */
const wellFormedLabelsArb: fc.Arbitrary<LabelDefinition[]> = fc
  .uniqueArray(identifierArb, {
    minLength: 1,
    maxLength: 30,
    selector: (s) => s.toLowerCase(),
  })
  .chain((pool) =>
    fc
      .integer({ min: 1, max: pool.length })
      .chain((labelCount) => {
        // Assign identifiers to labels: the first `labelCount` entries are
        // canonical names; the rest are distributed as aliases.
        const names = pool.slice(0, labelCount);
        const aliasPool = pool.slice(labelCount);

        return fc
          .tuple(
            fc.array(validColorArb, {
              minLength: labelCount,
              maxLength: labelCount,
            }),
            fc.array(descriptionArb, {
              minLength: labelCount,
              maxLength: labelCount,
            }),
            // How many aliases each label takes from the shared alias pool.
            fc.array(fc.integer({ min: 0, max: MAX_ALIASES }), {
              minLength: labelCount,
              maxLength: labelCount,
            }),
          )
          .map(([colors, descriptions, aliasCounts]) => {
            const labels: LabelDefinition[] = [];
            let cursor = 0;
            for (let i = 0; i < labelCount; i++) {
              const take = Math.min(
                aliasCounts[i],
                aliasPool.length - cursor,
              );
              const aliases = aliasPool.slice(cursor, cursor + take);
              cursor += take;
              const label: LabelDefinition = {
                name: names[i],
                color: colors[i],
                description: descriptions[i],
              };
              if (aliases.length > 0) {
                label.aliases = aliases;
              }
              labels.push(label);
            }
            return labels;
          });
      }),
  );

/** Serialize label definitions to the YAML list format the validator expects. */
function toYaml(labels: LabelDefinition[]): string {
  return yaml.dump(labels);
}

// ---------------------------------------------------------------------------
// Property 7 — the positive direction.
// ---------------------------------------------------------------------------

test("Property 7: well-formed label sets validate as valid", () => {
  fc.assert(
    fc.property(wellFormedLabelsArb, (labels) => {
      const result = validateLabels(toYaml(labels), "labels.yml");
      assert.equal(
        result.valid,
        true,
        `Expected valid=true but got errors: ${JSON.stringify(result.errors)}`,
      );
      assert.equal(result.errors.length, 0);
    }),
    { numRuns: NUM_RUNS },
  );
});

// ---------------------------------------------------------------------------
// Property 7 — negative direction: an invalid color must be rejected.
// ---------------------------------------------------------------------------

test("Property 7: a label set containing an invalid color is rejected", () => {
  fc.assert(
    fc.property(
      wellFormedLabelsArb,
      invalidColorArb,
      fc.nat(),
      (labels, badColor, pick) => {
        // Corrupt exactly one label's color with a value that cannot match the
        // hex pattern. Every other property of the set stays well-formed.
        const index = pick % labels.length;
        const corrupted = labels.map((label, i) =>
          i === index ? { ...label, color: badColor } : label,
        );

        const result = validateLabels(toYaml(corrupted), "labels.yml");
        assert.equal(
          result.valid,
          false,
          `Expected valid=false for invalid color "${badColor}"`,
        );
        assert.ok(
          result.errors.some((e) => e.toLowerCase().includes("color")),
          `Expected a color error, got: ${JSON.stringify(result.errors)}`,
        );
      },
    ),
    { numRuns: NUM_RUNS },
  );
});

// ---------------------------------------------------------------------------
// Property 7 — negative direction: a case-insensitive duplicate name/alias
// must be rejected.
// ---------------------------------------------------------------------------

test("Property 7: a case-insensitive duplicate identifier is rejected", () => {
  fc.assert(
    fc.property(
      wellFormedLabelsArb,
      fc.nat(),
      fc.nat(),
      fc.boolean(),
      (labels, pickSource, pickTarget, asAlias) => {
        // Need at least two labels to introduce a cross-label collision.
        fc.pre(labels.length >= 2);

        const source = pickSource % labels.length;
        let target = pickTarget % labels.length;
        if (target === source) {
          target = (target + 1) % labels.length;
        }

        // Take the canonical name of the source label and re-case it so the
        // collision is only detectable case-insensitively.
        const collidingValue = swapCase(labels[source].name);

        const corrupted = labels.map((label, i) => {
          if (i !== target) return label;
          if (asAlias) {
            const aliases = [...(label.aliases ?? []), collidingValue];
            return { ...label, aliases };
          }
          return { ...label, name: collidingValue };
        });

        const result = validateLabels(toYaml(corrupted), "labels.yml");
        assert.equal(
          result.valid,
          false,
          `Expected valid=false for duplicate identifier "${collidingValue}"`,
        );
        assert.ok(
          result.errors.some((e) =>
            e.toLowerCase().includes("conflict"),
          ),
          `Expected a conflict error, got: ${JSON.stringify(result.errors)}`,
        );
      },
    ),
    { numRuns: NUM_RUNS },
  );
});

/**
 * Flip the case of each alphabetic character so the string differs in casing
 * but is identical under a case-insensitive comparison. Strings with no
 * alphabetic characters are returned unchanged (still a case-insensitive
 * match).
 */
function swapCase(value: string): string {
  return value
    .split("")
    .map((ch) => {
      if (ch >= "a" && ch <= "z") return ch.toUpperCase();
      if (ch >= "A" && ch <= "Z") return ch.toLowerCase();
      return ch;
    })
    .join("");
}
