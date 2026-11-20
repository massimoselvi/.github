/**
 * Integration tests for end-to-end label synchronization and sync-report
 * accuracy.
 *
 * Encodes **Property 5: Sync Report Accuracy** from the design document:
 *
 *   *For any* label sync execution, the generated report's counts of created,
 *   updated, and renamed labels SHALL equal the actual number of create,
 *   update, and rename operations performed during that execution.
 *
 * **Validates: Requirements 13.5**
 *
 * Unlike the convergence property test (which drives the sync through an
 * in-memory {@link LabelsClient} fake), these tests mock the GitHub API at the
 * Octokit boundary. A fake {@link Octokit} exposes the exact `issues`
 * namespace methods (`listLabelsForRepo`, `createLabel`, `updateLabel`) and the
 * `paginate` helper that {@link createLabelsClient} depends on, and it COUNTS
 * every create / update API call it actually performs. The real client wrapper
 * ({@link createLabelsClient}) and the real orchestration ({@link syncLabels} /
 * {@link syncRepoLabels}) run unchanged against this mock.
 *
 * Each test then asserts that the aggregate {@link LabelSyncReport} — and each
 * per-repo result — reports create/update/rename counts that are EQUAL to the
 * create/update API operations actually invoked on the mock. A rename and an
 * update both go through `issues.updateLabel`, so the test derives the expected
 * figures from the recorded API call log rather than trusting the report.
 *
 * Both a property-based test (arbitrary definitions + repo state across many
 * runs) and example-based unit tests (create / update / rename / conflict /
 * archived / access-denied) are provided.
 *
 * Run with: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import * as fc from "fast-check";

import {
  syncLabels,
  createLabelsClient,
  RepoRef,
} from "../sync-labels";
import { LabelDefinition, ExistingLabel } from "../types";

/** Number of generated cases for the property test. */
const NUM_RUNS = 300;

/** Case-insensitive key, matching the planner's own comparison. */
function key(name: string): string {
  return name.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Mock Octokit (GitHub API boundary)
// ---------------------------------------------------------------------------

/** A single recorded GitHub API mutation. */
interface ApiCall {
  kind: "create" | "update";
  owner: string;
  repo: string;
  /** For update calls: whether the name actually changed (a rename). */
  renamed?: boolean;
}

/**
 * A minimal stand-in for the subset of `@octokit/rest`'s surface that
 * {@link createLabelsClient} touches:
 *   - `octokit.issues.listLabelsForRepo` (consumed via `octokit.paginate`)
 *   - `octokit.issues.createLabel`
 *   - `octokit.issues.updateLabel`
 *   - `octokit.paginate(endpoint, params)`
 *
 * The mock keeps per-repo in-memory label stores so mutations are observable
 * end-to-end and mirrors GitHub's real behavior (create rejects duplicates;
 * update locates by current name and may rename when `new_name` differs and the
 * destination is free). Every create/update is recorded in {@link calls}.
 */
function makeMockOctokit(
  initialByRepo: Record<string, ExistingLabel[]>,
  denied: Set<string> = new Set(),
) {
  // Clone initial state so generated inputs are never mutated across runs.
  const stores: Record<string, ExistingLabel[]> = {};
  for (const [repo, labels] of Object.entries(initialByRepo)) {
    stores[repo] = labels.map((l) => ({ ...l }));
  }

  const calls: ApiCall[] = [];

  function storeFor(owner: string, repo: string): ExistingLabel[] {
    const slug = `${owner}/${repo}`;
    if (denied.has(slug)) {
      const err = new Error(`access denied to ${slug}`) as Error & {
        status?: number;
      };
      err.status = 403;
      throw err;
    }
    if (!stores[slug]) {
      stores[slug] = [];
    }
    return stores[slug];
  }

  // The `issues` endpoint methods. `listLabelsForRepo` is only ever invoked by
  // the mock `paginate` below, so we tag it for identity comparison.
  const listLabelsForRepo = Object.assign(
    async (params: { owner: string; repo: string }) => {
      const labels = storeFor(params.owner, params.repo);
      return { data: labels.map((l) => ({ ...l })) };
    },
    { __isListLabels: true as const },
  );

  const octokit = {
    issues: {
      listLabelsForRepo,
      async createLabel(params: {
        owner: string;
        repo: string;
        name: string;
        color: string;
        description: string;
      }) {
        const labels = storeFor(params.owner, params.repo);
        if (labels.some((l) => key(l.name) === key(params.name))) {
          throw new Error(`label "${params.name}" already exists`);
        }
        labels.push({
          name: params.name,
          color: params.color,
          description: params.description,
        });
        calls.push({ kind: "create", owner: params.owner, repo: params.repo });
      },
      async updateLabel(params: {
        owner: string;
        repo: string;
        name: string;
        new_name: string;
        color: string;
        description: string;
      }) {
        const labels = storeFor(params.owner, params.repo);
        const target = labels.find((l) => key(l.name) === key(params.name));
        if (!target) {
          throw new Error(`label "${params.name}" not found`);
        }
        const isRename = key(params.new_name) !== key(params.name);
        if (
          isRename &&
          labels.some((l) => key(l.name) === key(params.new_name))
        ) {
          throw new Error(`label "${params.new_name}" already exists`);
        }
        target.name = params.new_name;
        target.color = params.color;
        target.description = params.description;
        calls.push({
          kind: "update",
          owner: params.owner,
          repo: params.repo,
          renamed: isRename,
        });
      },
    },
    // `createLabelsClient` calls `octokit.paginate(octokit.issues.listLabelsForRepo, params)`.
    async paginate(
      endpoint: unknown,
      params: { owner: string; repo: string },
    ) {
      assert.ok(
        (endpoint as { __isListLabels?: boolean })?.__isListLabels,
        "paginate should only be used for listLabelsForRepo in sync",
      );
      const page = await listLabelsForRepo(params);
      return page.data;
    },
  };

  return {
    octokit,
    calls,
    stores,
    /** Counts derived strictly from the recorded API call log. */
    actualCounts() {
      let created = 0;
      let updated = 0;
      let renamed = 0;
      for (const c of calls) {
        if (c.kind === "create") {
          created += 1;
        } else if (c.renamed) {
          renamed += 1;
        } else {
          updated += 1;
        }
      }
      return { created, updated, renamed };
    },
  };
}

// ---------------------------------------------------------------------------
// Arbitraries (shared shape with the convergence test, adapted for API-level)
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
 * Generate well-formed definitions plus an arbitrary initial repo state that
 * exercises create / noop / update / rename paths, mirroring the convergence
 * test's partitioned-identifier approach so no name/alias collisions occur.
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
            fc.array(fc.integer({ min: 0, max: MAX_ALIASES }), {
              minLength: labelCount,
              maxLength: labelCount,
            }),
            // 0 = absent (create), 1 = present exact (noop),
            // 2 = present divergent (update), 3 = present under alias (rename).
            fc.array(fc.integer({ min: 0, max: 3 }), {
              minLength: labelCount,
              maxLength: labelCount,
            }),
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
                  existing.push({
                    name: names[i],
                    color: colors[i],
                    description: descriptions[i],
                  });
                } else if (shape === 2) {
                  existing.push({
                    name: names[i],
                    color: forceDifferent(seedColors[i], colors[i]),
                    description: `${seedDescriptions[i]} (divergent)`,
                  });
                } else if (shape === 3 && aliases.length > 0) {
                  existing.push({
                    name: aliases[0],
                    color: forceDifferent(seedColors[i], colors[i]),
                    description: seedDescriptions[i],
                  });
                }
              }

              // Unrelated labels drawn from leftover identifiers.
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
  const first = target[0] === "0" ? "1" : "0";
  return first + target.slice(1);
}

const OWNER = "acme";
const REPO = "widgets";
const ref: RepoRef = { owner: OWNER, repo: REPO };

// ---------------------------------------------------------------------------
// Property 5 — report counts equal the operations actually performed.
// ---------------------------------------------------------------------------

test("Property 5: report counts equal the API operations actually performed", async () => {
  await fc.assert(
    fc.asyncProperty(scenarioArb, async ({ definitions, existing }) => {
      const slug = `${OWNER}/${REPO}`;
      const mock = makeMockOctokit({ [slug]: existing });
      const client = createLabelsClient(mock.octokit as never);

      const report = await syncLabels(client, [ref], definitions);

      const actual = mock.actualCounts();

      // Aggregate report counts match the real create/update/rename API calls.
      assert.equal(
        report.createdCount,
        actual.created,
        `createdCount ${report.createdCount} != ${actual.created} create API calls`,
      );
      assert.equal(
        report.updatedCount,
        actual.updated,
        `updatedCount ${report.updatedCount} != ${actual.updated} update API calls`,
      );
      assert.equal(
        report.renamedCount,
        actual.renamed,
        `renamedCount ${report.renamedCount} != ${actual.renamed} rename API calls`,
      );

      // The single per-repo result must carry the same figures, and its listed
      // names must have the same cardinality as the counts (no double-count).
      assert.equal(report.repos.length, 1);
      const repoResult = report.repos[0];
      assert.equal(repoResult.created.length, actual.created);
      assert.equal(repoResult.updated.length, actual.updated);
      assert.equal(repoResult.renamed.length, actual.renamed);

      // Report counts are internally consistent with the enumerated names.
      assert.equal(report.createdCount, repoResult.created.length);
      assert.equal(report.updatedCount, repoResult.updated.length);
      assert.equal(report.renamedCount, repoResult.renamed.length);
    }),
    { numRuns: NUM_RUNS },
  );
});

// ---------------------------------------------------------------------------
// Property 5 — accuracy holds when aggregating across multiple repositories.
// ---------------------------------------------------------------------------

test("Property 5: aggregate counts across repos equal total API operations", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(scenarioArb, { minLength: 1, maxLength: 4 }),
      async (scenarios) => {
        const initialByRepo: Record<string, ExistingLabel[]> = {};
        const repos: RepoRef[] = [];
        scenarios.forEach((s, i) => {
          const repo = `repo-${i}`;
          initialByRepo[`${OWNER}/${repo}`] = s.existing;
          repos.push({ owner: OWNER, repo });
        });

        const mock = makeMockOctokit(initialByRepo);
        const client = createLabelsClient(mock.octokit as never);

        // Each repo syncs against its own definition set; we union them so the
        // orchestration applies the same definitions to every repo, which is
        // how the real CLI works. Use the first scenario's definitions for all
        // repos to keep the API-call accounting unambiguous.
        const definitions = scenarios[0].definitions;

        const report = await syncLabels(client, repos, definitions);
        const actual = mock.actualCounts();

        assert.equal(report.createdCount, actual.created);
        assert.equal(report.updatedCount, actual.updated);
        assert.equal(report.renamedCount, actual.renamed);

        // Sum of per-repo list lengths equals the aggregate counts.
        const summed = report.repos.reduce(
          (acc, r) => ({
            created: acc.created + r.created.length,
            updated: acc.updated + r.updated.length,
            renamed: acc.renamed + r.renamed.length,
          }),
          { created: 0, updated: 0, renamed: 0 },
        );
        assert.equal(summed.created, report.createdCount);
        assert.equal(summed.updated, report.updatedCount);
        assert.equal(summed.renamed, report.renamedCount);
      },
    ),
    { numRuns: NUM_RUNS },
  );
});

// ---------------------------------------------------------------------------
// Example-based integration tests (create / update / rename / conflict / skip)
// ---------------------------------------------------------------------------

test("create path: absent label is created once and reported as created", async () => {
  const slug = `${OWNER}/${REPO}`;
  const mock = makeMockOctokit({ [slug]: [] });
  const client = createLabelsClient(mock.octokit as never);

  const definitions: LabelDefinition[] = [
    { name: "bug", color: "d73a4a", description: "Something is broken" },
  ];

  const report = await syncLabels(client, [ref], definitions);
  const actual = mock.actualCounts();

  assert.deepEqual(actual, { created: 1, updated: 0, renamed: 0 });
  assert.equal(report.createdCount, 1);
  assert.equal(report.updatedCount, 0);
  assert.equal(report.renamedCount, 0);
  assert.deepEqual(report.repos[0].created, ["bug"]);
  // The label is actually present in the mock store.
  assert.ok(mock.stores[slug].some((l) => l.name === "bug"));
});

test("update path: divergent label is updated once and reported as updated", async () => {
  const slug = `${OWNER}/${REPO}`;
  const mock = makeMockOctokit({
    [slug]: [{ name: "bug", color: "000000", description: "old" }],
  });
  const client = createLabelsClient(mock.octokit as never);

  const definitions: LabelDefinition[] = [
    { name: "bug", color: "d73a4a", description: "Something is broken" },
  ];

  const report = await syncLabels(client, [ref], definitions);
  const actual = mock.actualCounts();

  assert.deepEqual(actual, { created: 0, updated: 1, renamed: 0 });
  assert.equal(report.updatedCount, 1);
  assert.deepEqual(report.repos[0].updated, ["bug"]);
  // The update is not miscounted as a rename.
  assert.equal(report.renamedCount, 0);
  const stored = mock.stores[slug].find((l) => l.name === "bug");
  assert.equal(stored?.color, "d73a4a");
  assert.equal(stored?.description, "Something is broken");
});

test("rename path: alias match is renamed once and reported as renamed", async () => {
  const slug = `${OWNER}/${REPO}`;
  const mock = makeMockOctokit({
    [slug]: [{ name: "defect", color: "000000", description: "legacy" }],
  });
  const client = createLabelsClient(mock.octokit as never);

  const definitions: LabelDefinition[] = [
    {
      name: "bug",
      color: "d73a4a",
      description: "Something is broken",
      aliases: ["defect"],
    },
  ];

  const report = await syncLabels(client, [ref], definitions);
  const actual = mock.actualCounts();

  // A rename is one updateLabel API call tagged as a rename.
  assert.deepEqual(actual, { created: 0, updated: 0, renamed: 1 });
  assert.equal(report.renamedCount, 1);
  assert.equal(report.updatedCount, 0);
  assert.equal(report.createdCount, 0);
  assert.deepEqual(report.repos[0].renamed, [{ from: "defect", to: "bug" }]);
  // The label now exists under the canonical name, not the alias.
  assert.ok(mock.stores[slug].some((l) => l.name === "bug"));
  assert.ok(!mock.stores[slug].some((l) => l.name === "defect"));
});

test("conflict path: alias rename skipped when canonical name already exists", async () => {
  const slug = `${OWNER}/${REPO}`;
  // Both the canonical name "bug" (exact match -> noop) and the alias "defect"
  // exist. The canonical label is handled first, so the alias is left as a
  // dangling unrelated label — no rename is performed and none is reported.
  const mock = makeMockOctokit({
    [slug]: [
      { name: "bug", color: "d73a4a", description: "Something is broken" },
      { name: "defect", color: "000000", description: "legacy" },
    ],
  });
  const client = createLabelsClient(mock.octokit as never);

  const definitions: LabelDefinition[] = [
    {
      name: "bug",
      color: "d73a4a",
      description: "Something is broken",
      aliases: ["defect"],
    },
  ];

  const report = await syncLabels(client, [ref], definitions);
  const actual = mock.actualCounts();

  // No API mutations at all: the canonical label already matches exactly.
  assert.deepEqual(actual, { created: 0, updated: 0, renamed: 0 });
  assert.equal(report.createdCount, 0);
  assert.equal(report.updatedCount, 0);
  assert.equal(report.renamedCount, 0);
  // The report must not invent a rename that never happened.
  assert.deepEqual(report.repos[0].renamed, []);
});

test("archived repos are skipped and contribute no operations to the report", async () => {
  const activeSlug = `${OWNER}/active`;
  const mock = makeMockOctokit({ [activeSlug]: [] });
  const client = createLabelsClient(mock.octokit as never);

  const definitions: LabelDefinition[] = [
    { name: "bug", color: "d73a4a", description: "Something is broken" },
  ];

  const repos: RepoRef[] = [
    { owner: OWNER, repo: "archived", archived: true },
    { owner: OWNER, repo: "active" },
  ];

  const report = await syncLabels(client, repos, definitions);
  const actual = mock.actualCounts();

  // Only the active repo triggers a create; the archived repo is untouched.
  assert.deepEqual(actual, { created: 1, updated: 0, renamed: 0 });
  assert.equal(report.createdCount, 1);
  assert.equal(report.repoCount, 2);
  const archived = report.repos.find((r) => r.repo === `${OWNER}/archived`);
  assert.ok(archived?.skipped);
  assert.deepEqual(archived?.created, []);
});

test("access-denied repo is recorded as an error without aborting others", async () => {
  const okSlug = `${OWNER}/ok`;
  const deniedSlug = `${OWNER}/denied`;
  const mock = makeMockOctokit(
    { [okSlug]: [], [deniedSlug]: [] },
    new Set([deniedSlug]),
  );
  const client = createLabelsClient(mock.octokit as never);

  const definitions: LabelDefinition[] = [
    { name: "bug", color: "d73a4a", description: "Something is broken" },
  ];

  const repos: RepoRef[] = [
    { owner: OWNER, repo: "denied" },
    { owner: OWNER, repo: "ok" },
  ];

  const report = await syncLabels(client, repos, definitions);
  const actual = mock.actualCounts();

  // The reachable repo still gets its create; the denied repo errors out.
  assert.deepEqual(actual, { created: 1, updated: 0, renamed: 0 });
  assert.equal(report.createdCount, 1);
  assert.ok(report.errorCount >= 1);
  const denied = report.repos.find((r) => r.repo === deniedSlug);
  assert.ok(denied?.skipped);
  assert.equal(denied?.created.length, 0);
});
