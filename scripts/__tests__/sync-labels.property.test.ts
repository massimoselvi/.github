/**
 * Property-based tests for the label synchronization algorithm.
 *
 * Encodes **Property 4: Label Sync Convergence** from the design document:
 *
 *   *For any* set of label definitions and any target repository state, after
 *   the label sync executes successfully, the target repository SHALL contain
 *   labels matching all definitions exactly — missing labels are created,
 *   labels matching aliases are renamed to canonical names, and labels with
 *   divergent color or description are updated to match the definition.
 *
 * **Validates: Requirements 11.2, 11.5, 11.6**
 *
 * The tests generate arbitrary, well-formed label definitions (unique
 * case-insensitive names/aliases, valid 6-hex colors, descriptions, optional
 * aliases) together with an arbitrary initial repository label state. That
 * initial state mixes:
 *   - labels that already match a definition exactly (noop),
 *   - labels on the canonical name whose color/description diverge (update),
 *   - labels named after a definition alias (rename),
 *   - unrelated labels that no definition references (left untouched).
 *
 * Sync is driven through {@link syncRepoLabels} against an IN-MEMORY FAKE
 * {@link LabelsClient} that mutates an in-memory array — no network access.
 * After sync we assert convergence (every canonical definition present with its
 * exact color and description) and idempotence (a second sync plans and
 * performs no create/update/rename operations).
 *
 * Run with: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import * as fc from "fast-check";

import {
  syncRepoLabels,
  planLabelSync,
  LabelsClient,
  RepoRef,
} from "../sync-labels";
import { LabelDefinition, ExistingLabel } from "../types";

/** Number of generated cases per property. */
const NUM_RUNS = 400;

/** Case-insensitive key, matching the planner's own comparison. */
function key(name: string): string {
  return name.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// In-memory fake LabelsClient
// ---------------------------------------------------------------------------

/**
 * Build a fake {@link LabelsClient} backed by an in-memory array of
 * {@link ExistingLabel}. It faithfully mirrors how GitHub's issues API mutates
 * labels — `createLabel` appends, and `updateLabel` locates the label by its
 * current name (case-insensitively) and rewrites its name/color/description,
 * where `newName` may rename the label. The backing array is returned so the
 * test can inspect the converged state directly.
 */
function makeFakeClient(initial: ExistingLabel[]): {
  client: LabelsClient;
  labels: ExistingLabel[];
  callCount: () => { created: number; updated: number };
} {
  // Clone so generated inputs are never mutated across runs.
  const labels: ExistingLabel[] = initial.map((l) => ({ ...l }));
  let created = 0;
  let updated = 0;

  const client: LabelsClient = {
    async listLabels() {
      // Return copies so callers cannot mutate our backing store directly.
      return labels.map((l) => ({ ...l }));
    },
    async createLabel(_owner, _repo, name, color, description) {
      if (labels.some((l) => key(l.name) === key(name))) {
        throw new Error(`label "${name}" already exists`);
      }
      labels.push({ name, color, description });
      created += 1;
    },
    async updateLabel(_owner, _repo, currentName, newName, color, description) {
      const target = labels.find((l) => key(l.name) === key(currentName));
      if (!target) {
        throw new Error(`label "${currentName}" not found`);
      }
      // When renaming, the destination name must be free (unless it is the
      // same label, case-insensitively), mirroring GitHub's behavior.
      if (
        key(newName) !== key(currentName) &&
        labels.some((l) => key(l.name) === key(newName))
      ) {
        throw new Error(`label "${newName}" already exists`);
      }
      target.name = newName;
      target.color = color;
      target.description = description;
      updated += 1;
    },
  };

  return { client, labels, callCount: () => ({ created, updated }) };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** A non-empty identifier (name or alias) that survives `.trim()` intact. */
const identifierArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 20 })
  .map((s) => s.replace(/[^A-Za-z0-9 _-]/g, "_"))
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

/** A valid 6-character hex color (no leading '#'). */
const colorArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(..."0123456789abcdef".split("")), {
    minLength: 6,
    maxLength: 6,
  })
  .map((chars) => chars.join(""));

/** A description (possibly empty — GitHub permits empty descriptions). */
const descriptionArb: fc.Arbitrary<string> = fc
  .string({ minLength: 0, maxLength: 40 })
  .map((s) => s.replace(/[^A-Za-z0-9 _.-]/g, "_").trim());

const MAX_ALIASES = 10;

/**
 * Generate well-formed definitions plus an arbitrary initial repo state.
 *
 * A single shared pool of case-insensitively-unique identifiers is partitioned
 * into canonical names, alias names, and unrelated names so that:
 *   - no two definitions collide on name/alias (precondition for the planner),
 *   - aliases are distinct from every canonical name,
 *   - unrelated labels cannot accidentally match a canonical name or alias.
 */
const scenarioArb = fc
  .uniqueArray(identifierArb, {
    minLength: 2,
    maxLength: 40,
    selector: (s) => s.toLowerCase(),
  })
  .chain((pool) =>
    fc
      .integer({ min: 1, max: Math.min(pool.length - 1, 12) })
      .chain((labelCount) => {
        const names = pool.slice(0, labelCount);
        const rest = pool.slice(labelCount);

        return fc
          .tuple(
            fc.array(colorArb, { minLength: labelCount, maxLength: labelCount }),
            fc.array(descriptionArb, {
              minLength: labelCount,
              maxLength: labelCount,
            }),
            // Alias counts per label, drawn from the shared `rest` pool.
            fc.array(fc.integer({ min: 0, max: MAX_ALIASES }), {
              minLength: labelCount,
              maxLength: labelCount,
            }),
            // For each label choose an initial-state shape:
            //   0 = absent (expect create)
            //   1 = present on canonical name, matching exactly (expect noop)
            //   2 = present on canonical name, divergent (expect update)
            //   3 = present under one of its aliases (expect rename)
            fc.array(fc.integer({ min: 0, max: 3 }), {
              minLength: labelCount,
              maxLength: labelCount,
            }),
            // Colors/descriptions used to seed existing labels so they differ
            // from the definition for the "update"/"rename" shapes.
            fc.array(colorArb, { minLength: labelCount, maxLength: labelCount }),
            fc.array(descriptionArb, {
              minLength: labelCount,
              maxLength: labelCount,
            }),
          )
          .map(
            ([
              colors,
              descriptions,
              aliasCounts,
              shapes,
              seedColors,
              seedDescriptions,
            ]) => {
              const definitions: LabelDefinition[] = [];
              const existing: ExistingLabel[] = [];

              let cursor = 0;
              for (let i = 0; i < labelCount; i++) {
                const take = Math.min(aliasCounts[i], rest.length - cursor);
                const aliases = rest.slice(cursor, cursor + take);
                cursor += take;

                const def: LabelDefinition = {
                  name: names[i],
                  color: colors[i],
                  description: descriptions[i],
                };
                if (aliases.length > 0) {
                  def.aliases = aliases;
                }
                definitions.push(def);

                const shape = shapes[i];
                if (shape === 1) {
                  // Present and already matching exactly.
                  existing.push({
                    name: names[i],
                    color: colors[i],
                    description: descriptions[i],
                  });
                } else if (shape === 2) {
                  // Present on canonical name but divergent color/description.
                  existing.push({
                    name: names[i],
                    color: forceDifferent(seedColors[i], colors[i]),
                    description: `${seedDescriptions[i]} (divergent)`,
                  });
                } else if (shape === 3 && aliases.length > 0) {
                  // Present under the first alias (what the planner renames).
                  existing.push({
                    name: aliases[0],
                    color: forceDifferent(seedColors[i], colors[i]),
                    description: seedDescriptions[i],
                  });
                }
                // shape === 0 (or shape 3 with no aliases): absent -> create.
              }

              // Add some unrelated labels drawn from leftover identifiers so
              // the repo contains labels no definition references. These must
              // be left untouched by sync.
              const unrelated: ExistingLabel[] = [];
              for (let j = cursor; j < rest.length; j++) {
                unrelated.push({
                  name: rest[j],
                  color: seedColors[j % seedColors.length],
                  description: `unrelated-${j}`,
                });
              }

              return {
                definitions,
                existing: [...existing, ...unrelated],
                unrelated,
              };
            },
          );
      }),
  );

/** Produce a hex color guaranteed to differ from `target`. */
function forceDifferent(candidate: string, target: string): string {
  if (candidate.toLowerCase() !== target.toLowerCase()) {
    return candidate;
  }
  // Flip the first hex digit deterministically.
  const first = target[0] === "0" ? "1" : "0";
  return first + target.slice(1);
}

const ref: RepoRef = { owner: "acme", repo: "widgets" };

// ---------------------------------------------------------------------------
// Property 4 — convergence: after sync, every definition is matched exactly.
// ---------------------------------------------------------------------------

test("Property 4: sync converges the repo to the definitions exactly", async () => {
  await fc.assert(
    fc.asyncProperty(scenarioArb, async ({ definitions, existing }) => {
      const { client, labels } = makeFakeClient(existing);

      const result = await syncRepoLabels(client, ref, definitions);

      // Sync must not have skipped or errored on a reachable fake repo.
      assert.equal(result.skipped, false);
      assert.deepEqual(
        result.errors,
        [],
        `Unexpected sync errors: ${JSON.stringify(result.errors)}`,
      );

      // Every canonical definition is present with its EXACT color and
      // description (Requirements 11.5, 11.6).
      for (const def of definitions) {
        const match = labels.find((l) => key(l.name) === key(def.name));
        assert.ok(
          match,
          `Definition "${def.name}" missing after sync: ${JSON.stringify(labels)}`,
        );
        assert.equal(
          match!.color,
          def.color,
          `Color mismatch for "${def.name}"`,
        );
        assert.equal(
          match!.description,
          def.description,
          `Description mismatch for "${def.name}"`,
        );
      }
    }),
    { numRuns: NUM_RUNS },
  );
});

// ---------------------------------------------------------------------------
// Property 4 — idempotence: a converged repo requires no further operations.
// ---------------------------------------------------------------------------

test("Property 4: a second sync performs no create/update/rename operations", async () => {
  await fc.assert(
    fc.asyncProperty(scenarioArb, async ({ definitions, existing }) => {
      const { client, labels } = makeFakeClient(existing);

      // First sync converges the repo.
      await syncRepoLabels(client, ref, definitions);

      // The planner must now see nothing to do.
      const planned = planLabelSync(definitions, labels);
      const actionable = planned.filter(
        (op) => op.type === "create" || op.type === "update" || op.type === "rename",
      );
      assert.equal(
        actionable.length,
        0,
        `Expected no actionable ops on a converged repo, got: ${JSON.stringify(actionable)}`,
      );

      // A second end-to-end sync records zero create/update/rename results.
      const second = await syncRepoLabels(client, ref, definitions);
      assert.deepEqual(second.created, []);
      assert.deepEqual(second.updated, []);
      assert.deepEqual(second.renamed, []);
      assert.deepEqual(second.errors, []);
    }),
    { numRuns: NUM_RUNS },
  );
});

// ---------------------------------------------------------------------------
// Property 4 — unrelated labels are preserved (sync does not delete).
// ---------------------------------------------------------------------------

test("Property 4: unrelated labels are left untouched by sync", async () => {
  await fc.assert(
    fc.asyncProperty(scenarioArb, async ({ definitions, existing, unrelated }) => {
      const { client, labels } = makeFakeClient(existing);

      await syncRepoLabels(client, ref, definitions);

      for (const u of unrelated) {
        const match = labels.find((l) => key(l.name) === key(u.name));
        assert.ok(
          match,
          `Unrelated label "${u.name}" was removed by sync`,
        );
        assert.equal(match!.color, u.color, `Unrelated "${u.name}" color changed`);
        assert.equal(
          match!.description,
          u.description,
          `Unrelated "${u.name}" description changed`,
        );
      }
    }),
    { numRuns: NUM_RUNS },
  );
});
