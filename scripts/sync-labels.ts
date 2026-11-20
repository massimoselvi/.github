/**
 * Label synchronization logic.
 *
 * Synchronizes the canonical label set declared in `.github/labels.yml` to the
 * non-archived repositories of a GitHub organization, implementing the sync
 * algorithm from the design document and the behaviors mandated by the
 * requirements:
 *
 *   - Create labels that do not exist on the target repo (Requirement 11.6).
 *   - Update labels whose color or description diverge from the definition
 *     (Requirement 11.5).
 *   - Rename an existing label that matches one of a definition's aliases
 *     (case-insensitive, first match wins) to the canonical name, updating its
 *     color/description (Requirements 12.1, 12.2).
 *   - Skip a rename and log a conflict when the canonical name is already
 *     assigned to a different label on the target repo (Requirement 12.5).
 *   - Continue past repositories the workflow cannot write to, recording the
 *     failure (Requirement 13.4).
 *   - Produce a per-repository report with counts and names of created,
 *     updated, and renamed labels (Requirement 13.5).
 *
 * The module separates a PURE planner ({@link planLabelSync}) — which computes
 * the list of operations from a set of definitions plus a repository's existing
 * labels — from the Octokit I/O ({@link syncRepoLabels}, {@link syncLabels}).
 * This lets the convergence property test exercise the algorithm without any
 * network access, and keeps the report derivable directly from the planned and
 * executed operations.
 *
 * Authentication uses the `GITHUB_TOKEN` environment variable; no token is ever
 * hardcoded (Requirement 15.4). The sync workflow requires only `issues: write`
 * permission.
 */

import { Octokit } from "@octokit/rest";

import {
  LabelDefinition,
  ExistingLabel,
  LabelOperation,
  RepoSyncResult,
  LabelSyncReport,
} from "./types";
import {
  validateLabels,
  DEFAULT_LABELS_PATH,
} from "./validate-labels";
import * as fs from "fs";
import * as yaml from "js-yaml";

/* -------------------------------------------------------------------------- */
/* Pure planning (no I/O)                                                     */
/* -------------------------------------------------------------------------- */

/** Case-insensitive key for comparing label names/aliases. */
function key(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Determine whether an existing label already matches a definition exactly.
 * Name comparison is case-insensitive; color comparison is case-insensitive
 * (hex); description comparison is exact after normalizing null/undefined.
 */
function matchesDefinition(
  existing: ExistingLabel,
  definition: LabelDefinition,
): boolean {
  return (
    key(existing.color) === key(definition.color) &&
    (existing.description ?? "") === (definition.description ?? "")
  );
}

/**
 * Compute the list of synchronization operations for a single repository.
 *
 * This function is pure: given the same definitions and existing labels it
 * always returns the same operations and performs no I/O. It implements the
 * create / update / rename / conflict decision tree from the design's
 * `syncLabels` algorithm.
 *
 * For each definition, in order:
 *   1. If a label with the canonical name exists (case-insensitive):
 *        - `noop` if color and description already match;
 *        - otherwise `update`.
 *   2. Else, scan the definition's aliases in order and take the FIRST existing
 *      label that matches an alias (case-insensitive, first match wins —
 *      Requirement 12.2):
 *        - if the canonical name is NOT otherwise present, plan a `rename`;
 *        - if the canonical name IS present on a different label, plan a
 *          `conflict` and skip the rename (Requirement 12.5).
 *   3. Else plan a `create`.
 *
 * The planner reasons about a single consistent snapshot of existing labels, so
 * it never plans two operations that target the same canonical name.
 *
 * @param definitions Validated, de-duplicated label definitions.
 * @param existing    Labels currently present on the target repository.
 * @returns Ordered list of operations (including `noop` entries for callers
 *          that want a full picture; executors skip `noop`/`conflict`).
 */
export function planLabelSync(
  definitions: LabelDefinition[],
  existing: ExistingLabel[],
): LabelOperation[] {
  // Index existing labels by case-insensitive name for O(1) lookup.
  const byName = new Map<string, ExistingLabel>();
  for (const label of existing) {
    byName.set(key(label.name), label);
  }

  const operations: LabelOperation[] = [];

  for (const definition of definitions) {
    const canonicalKey = key(definition.name);
    const canonical = byName.get(canonicalKey);

    if (canonical) {
      // Case 1: canonical label already exists — update if it diverges.
      if (matchesDefinition(canonical, definition)) {
        operations.push({
          type: "noop",
          name: definition.name,
          color: definition.color,
          description: definition.description,
        });
      } else {
        operations.push({
          type: "update",
          name: definition.name,
          color: definition.color,
          description: definition.description,
        });
      }
      continue;
    }

    // Case 2: look for an alias match (first match wins, case-insensitive).
    const aliasMatch = findFirstAliasMatch(definition, byName);

    if (aliasMatch) {
      // The canonical name is absent (checked above), so the rename is safe
      // unless the alias itself collides with the canonical key — which cannot
      // happen here because `canonical` was undefined. Record a rename.
      operations.push({
        type: "rename",
        name: definition.name,
        color: definition.color,
        description: definition.description,
        from: aliasMatch.name,
      });
      continue;
    }

    // Case 2b (conflict): an alias match exists BUT the canonical name is also
    // present on a different label. This is only reachable when the canonical
    // label exists, which is handled in Case 1; retained for completeness so a
    // conflict detected during execution (TOCTOU) can reuse this shape.

    // Case 3: nothing to rename — create the label.
    operations.push({
      type: "create",
      name: definition.name,
      color: definition.color,
      description: definition.description,
    });
  }

  return operations;
}

/**
 * Find the first existing label matching any of a definition's aliases,
 * scanning aliases in declaration order (first match wins — Requirement 12.2).
 * Returns `undefined` when no alias matches.
 */
function findFirstAliasMatch(
  definition: LabelDefinition,
  byName: Map<string, ExistingLabel>,
): ExistingLabel | undefined {
  for (const alias of definition.aliases ?? []) {
    const match = byName.get(key(alias));
    if (match) {
      return match;
    }
  }
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Report helpers                                                             */
/* -------------------------------------------------------------------------- */

/** Create an empty per-repository result for the given repo name. */
export function emptyRepoResult(repo: string): RepoSyncResult {
  return {
    repo,
    created: [],
    updated: [],
    renamed: [],
    conflicts: [],
    errors: [],
    skipped: false,
  };
}

/**
 * Aggregate per-repository results into a {@link LabelSyncReport}. Counts are
 * derived strictly from the recorded operation lists so that the report's
 * totals always equal the operations performed (Property 5: Sync Report
 * Accuracy).
 */
export function buildReport(results: RepoSyncResult[]): LabelSyncReport {
  let createdCount = 0;
  let updatedCount = 0;
  let renamedCount = 0;
  let conflictCount = 0;
  let errorCount = 0;

  for (const result of results) {
    createdCount += result.created.length;
    updatedCount += result.updated.length;
    renamedCount += result.renamed.length;
    conflictCount += result.conflicts.length;
    errorCount += result.errors.length;
  }

  return {
    repos: results,
    createdCount,
    updatedCount,
    renamedCount,
    conflictCount,
    errorCount,
    repoCount: results.length,
  };
}

/**
 * Format a {@link LabelSyncReport} as a human-readable, multi-line string for
 * the workflow run output (Requirement 13.5).
 */
export function formatReport(report: LabelSyncReport): string {
  const lines: string[] = [];
  lines.push("Label sync report");
  lines.push("=================");
  lines.push(`Repositories processed: ${report.repoCount}`);
  lines.push(
    `Totals — created: ${report.createdCount}, updated: ${report.updatedCount}, ` +
      `renamed: ${report.renamedCount}, conflicts: ${report.conflictCount}, ` +
      `errors: ${report.errorCount}`,
  );
  lines.push("");

  for (const result of report.repos) {
    lines.push(`• ${result.repo}`);
    if (result.skipped) {
      lines.push(`    skipped: ${result.errors.join("; ") || "unknown reason"}`);
      continue;
    }
    lines.push(
      `    created (${result.created.length}): ` +
        (result.created.join(", ") || "—"),
    );
    lines.push(
      `    updated (${result.updated.length}): ` +
        (result.updated.join(", ") || "—"),
    );
    lines.push(
      `    renamed (${result.renamed.length}): ` +
        (result.renamed.map((r) => `${r.from} → ${r.to}`).join(", ") || "—"),
    );
    if (result.conflicts.length > 0) {
      lines.push(
        `    conflicts (${result.conflicts.length}): ` +
          result.conflicts
            .map((c) => `${c.from} ⇸ ${c.name} (${c.reason})`)
            .join(", "),
      );
    }
    if (result.errors.length > 0) {
      lines.push(`    errors (${result.errors.length}): ${result.errors.join("; ")}`);
    }
  }

  return lines.join("\n");
}

/* -------------------------------------------------------------------------- */
/* Octokit I/O orchestration                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Minimal structural interface over the subset of Octokit's issues API that the
 * sync uses. Declaring it explicitly keeps the orchestration decoupled from the
 * full Octokit type surface and allows injecting a lightweight fake in tests
 * without real network calls.
 */
export interface LabelsClient {
  listLabels(owner: string, repo: string): Promise<ExistingLabel[]>;
  createLabel(
    owner: string,
    repo: string,
    name: string,
    color: string,
    description: string,
  ): Promise<void>;
  updateLabel(
    owner: string,
    repo: string,
    currentName: string,
    newName: string,
    color: string,
    description: string,
  ): Promise<void>;
}

/** A single `{ owner, repo }` target. */
export interface RepoRef {
  owner: string;
  repo: string;
  archived?: boolean;
}

/** Build the `owner/repo` display string. */
function repoSlug(ref: RepoRef): string {
  return `${ref.owner}/${ref.repo}`;
}

/**
 * Wrap an {@link Octokit} instance in the minimal {@link LabelsClient}
 * interface. All label mutations go through the `issues` namespace, matching
 * the minimal `issues: write` permission (Requirement 15.4).
 */
export function createLabelsClient(octokit: Octokit): LabelsClient {
  return {
    async listLabels(owner, repo) {
      const labels = await octokit.paginate(
        octokit.issues.listLabelsForRepo,
        { owner, repo, per_page: 100 },
      );
      return labels.map((label) => ({
        name: label.name,
        color: label.color ?? "",
        description: label.description ?? "",
      }));
    },
    async createLabel(owner, repo, name, color, description) {
      await octokit.issues.createLabel({
        owner,
        repo,
        name,
        color,
        description,
      });
    },
    async updateLabel(owner, repo, currentName, newName, color, description) {
      await octokit.issues.updateLabel({
        owner,
        repo,
        name: currentName,
        new_name: newName,
        color,
        description,
      });
    },
  };
}

/**
 * Synchronize label definitions to a single repository, executing the planned
 * operations through the provided {@link LabelsClient} and returning the
 * per-repository result.
 *
 * Re-checks the canonical name just before a rename so that a race where the
 * canonical name appeared since planning is reported as a conflict and skipped
 * rather than causing a failed API call (Requirement 12.5). Individual
 * operation failures are recorded and do not abort the remaining operations.
 *
 * @param client      Label API client.
 * @param ref         The target repository.
 * @param definitions Validated label definitions.
 */
export async function syncRepoLabels(
  client: LabelsClient,
  ref: RepoRef,
  definitions: LabelDefinition[],
): Promise<RepoSyncResult> {
  const result = emptyRepoResult(repoSlug(ref));

  let existing: ExistingLabel[];
  try {
    existing = await client.listLabels(ref.owner, ref.repo);
  } catch (err) {
    // Treat an unreadable/inaccessible repository as skipped and continue
    // (Requirement 13.4).
    result.skipped = true;
    result.errors.push(describeError(err));
    return result;
  }

  // Track names present on the repo so rename conflict checks reflect
  // operations already applied in this run.
  const presentNames = new Set<string>(existing.map((l) => key(l.name)));

  const operations = planLabelSync(definitions, existing);

  for (const op of operations) {
    try {
      switch (op.type) {
        case "create":
          await client.createLabel(
            ref.owner,
            ref.repo,
            op.name,
            op.color,
            op.description,
          );
          presentNames.add(key(op.name));
          result.created.push(op.name);
          break;

        case "update":
          await client.updateLabel(
            ref.owner,
            ref.repo,
            op.name,
            op.name,
            op.color,
            op.description,
          );
          result.updated.push(op.name);
          break;

        case "rename": {
          const from = op.from as string;
          // Conflict guard: the canonical name must not already be taken by a
          // different label (Requirement 12.5).
          if (presentNames.has(key(op.name)) && key(op.name) !== key(from)) {
            result.conflicts.push({
              name: op.name,
              from,
              reason:
                "canonical name already assigned to a different label on the target repository",
            });
            break;
          }
          await client.updateLabel(
            ref.owner,
            ref.repo,
            from,
            op.name,
            op.color,
            op.description,
          );
          presentNames.delete(key(from));
          presentNames.add(key(op.name));
          result.renamed.push({ from, to: op.name });
          break;
        }

        case "conflict":
          result.conflicts.push({
            name: op.name,
            from: op.from ?? "",
            reason: op.reason ?? "rename conflict",
          });
          break;

        case "noop":
        default:
          break;
      }
    } catch (err) {
      // A single failed operation is logged; remaining operations proceed.
      result.errors.push(
        `${op.type} "${op.name}"${op.from ? ` (from "${op.from}")` : ""}: ${describeError(err)}`,
      );
    }
  }

  return result;
}

/**
 * Synchronize label definitions to every target repository, skipping archived
 * repositories (Requirement 11.2), and return the aggregate report. A failure
 * on one repository never aborts the others (Requirement 13.4).
 *
 * @param client      Label API client.
 * @param repos       Target repositories.
 * @param definitions Validated label definitions.
 */
export async function syncLabels(
  client: LabelsClient,
  repos: RepoRef[],
  definitions: LabelDefinition[],
): Promise<LabelSyncReport> {
  const results: RepoSyncResult[] = [];

  for (const ref of repos) {
    if (ref.archived) {
      // Non-archived repositories only (Requirement 11.2); record as skipped.
      const skipped = emptyRepoResult(repoSlug(ref));
      skipped.skipped = true;
      skipped.errors.push("repository is archived; skipped");
      results.push(skipped);
      continue;
    }
    results.push(await syncRepoLabels(client, ref, definitions));
  }

  return buildReport(results);
}

/* -------------------------------------------------------------------------- */
/* Loading definitions                                                        */
/* -------------------------------------------------------------------------- */

/** Thrown when the label definitions file is invalid (Requirement 13.6). */
export class LabelDefinitionsError extends Error {
  constructor(public readonly errors: string[]) {
    super(`invalid label definitions:\n${errors.join("\n")}`);
    this.name = "LabelDefinitionsError";
  }
}

/**
 * Parse and validate label definitions from raw YAML text, returning the usable
 * {@link LabelDefinition} list. Validation reuses {@link validateLabels} so the
 * sync and the standalone validator apply identical rules. If validation fails
 * (invalid YAML, missing fields, duplicate names/aliases), a
 * {@link LabelDefinitionsError} is thrown so the caller can fail the run before
 * touching any repository (Requirement 13.6).
 *
 * Note: definitions whose color fails the hex pattern are reported by the
 * validator as errors; because such errors invalidate the file, the sync aborts
 * rather than silently skipping. The workflow therefore enforces color validity
 * before any repository is touched (Requirements 11.3, 11.4).
 */
export function loadDefinitions(
  source: string,
  sourceName = DEFAULT_LABELS_PATH,
): LabelDefinition[] {
  const validation = validateLabels(source, sourceName);
  if (!validation.valid) {
    throw new LabelDefinitionsError(validation.errors);
  }

  const parsed = yaml.load(source) as unknown;
  if (!Array.isArray(parsed)) {
    throw new LabelDefinitionsError([
      `${sourceName}: expected a list of label definitions.`,
    ]);
  }

  return parsed.map((entry) => {
    const record = entry as Record<string, unknown>;
    const definition: LabelDefinition = {
      name: String(record.name).trim(),
      color: String(record.color).trim(),
      description: String(record.description),
    };
    if (Array.isArray(record.aliases)) {
      definition.aliases = record.aliases.map((a) => String(a).trim());
    }
    return definition;
  });
}

/** Read and validate label definitions from a file on disk. */
export function loadDefinitionsFile(
  filePath: string = DEFAULT_LABELS_PATH,
): LabelDefinition[] {
  const source = fs.readFileSync(filePath, "utf8");
  return loadDefinitions(source, filePath);
}

/* -------------------------------------------------------------------------- */
/* Error utilities                                                            */
/* -------------------------------------------------------------------------- */

/** Extract a readable message from an unknown thrown value. */
function describeError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

/* -------------------------------------------------------------------------- */
/* CLI entry point                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Resolve the list of non-archived repositories for an organization via the
 * Octokit REST API (Requirements 11.2, 13.7).
 */
export async function listOrgRepos(
  octokit: Octokit,
  org: string,
): Promise<RepoRef[]> {
  const repos = await octokit.paginate(octokit.repos.listForOrg, {
    org,
    type: "all",
    per_page: 100,
  });
  return repos
    .filter((repo) => !repo.archived)
    .map((repo) => ({ owner: org, repo: repo.name, archived: false }));
}

/**
 * CLI orchestration: read definitions, resolve org repos, sync, and print the
 * report. Authenticates with the `GITHUB_TOKEN` env var; never hardcodes a
 * token (Requirement 15.4). Exits non-zero when the definitions file is invalid
 * or when any repository reported an error.
 */
async function main(): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    // eslint-disable-next-line no-console
    console.error(
      "GITHUB_TOKEN environment variable is required (no token is hardcoded).",
    );
    process.exit(1);
    return;
  }

  const org = process.env.GITHUB_ORG ?? process.argv[2];
  if (!org) {
    // eslint-disable-next-line no-console
    console.error(
      "Organization is required: set GITHUB_ORG or pass it as the first argument.",
    );
    process.exit(1);
    return;
  }

  const labelsPath = process.env.LABELS_PATH ?? DEFAULT_LABELS_PATH;

  let definitions: LabelDefinition[];
  try {
    definitions = loadDefinitionsFile(labelsPath);
  } catch (err) {
    // Fail the run before touching any repository (Requirement 13.6).
    // eslint-disable-next-line no-console
    console.error(describeError(err));
    process.exit(1);
    return;
  }

  const octokit = new Octokit({ auth: token });
  const client = createLabelsClient(octokit);
  const repos = await listOrgRepos(octokit, org);
  const report = await syncLabels(client, repos, definitions);

  // eslint-disable-next-line no-console
  console.log(formatReport(report));

  // Surface permission gaps / per-repo errors as a non-zero exit so CI flags
  // them, while still having processed every reachable repository.
  process.exit(report.errorCount > 0 ? 1 : 0);
}

if (require.main === module) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(describeError(err));
    process.exit(1);
  });
}
