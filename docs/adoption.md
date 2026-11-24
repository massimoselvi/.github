# Adoption

This document shows how each default from `massimoselvi/.github` reaches a personal repository, what each repository must do itself, and how content shared with the organization repository stays in sync.

## Adoption matrix

| Default | How it reaches a repository | Action in each repository | How to override |
| --- | --- | --- | --- |
| `ACCESSIBILITY.md` | Inherited | None | Add an own `ACCESSIBILITY.md` with the known barriers of the project |
| `CODE_OF_CONDUCT.md` | Inherited | None | Add an own `CODE_OF_CONDUCT.md` |
| `CONTRIBUTING.md` | Inherited | None | Add an own `CONTRIBUTING.md` |
| `SECURITY.md` | Inherited | Turn on private vulnerability reporting (public repositories) | Add an own `SECURITY.md` |
| `SUPPORT.md` | Inherited | None | Add an own `SUPPORT.md` |
| Pull request template | Inherited | None | Add an own `.github/pull_request_template.md` |
| Issue forms and chooser | Inherited | Create the labels that the forms use, until the label sync runs | Add any file to `.github/ISSUE_TEMPLATE/`. This replaces the whole default set |
| Labels | Not inherited | Label sync, when it is available | Remove the repository from `.github/label-sync-targets.yml` |
| Security baseline | Not inherited | Apply [security-baseline.md](security-baseline.md) by hand | Record the exception in the ClickUp task, not in a public file |
| `CODEOWNERS` | Not inherited | Add `* @massimoselvi` | Not applicable |
| `LICENSE` | Not inherited. GitHub has no default license file | Add an own `LICENSE` | Not applicable |
| `.github/dependabot.yml` | Not inherited | Add one per repository | Not applicable |
| Workflows | Not inherited | Add them per repository, or call a reusable workflow | Not applicable |
| Claude code review | Not inherited. A reusable workflow | Add a caller workflow, the secret, and the Claude GitHub App. See [Claude code review](#claude-code-review) | Add an own review workflow instead of the caller |

An own file replaces the default completely. GitHub does not merge an own file with the default.

## Claude code review

`.github/workflows/claude-code-review.yml` is a reusable workflow. A repository calls it with this file, `.github/workflows/claude-code-review.yml`:

```yaml
name: Claude Code Review

on:
  pull_request:
    types: [opened, synchronize, ready_for_review, reopened]

# A different group from the called workflow, so the two never wait for each other.
concurrency:
  group: claude-review-caller-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  review:
    uses: massimoselvi/.github/.github/workflows/claude-code-review.yml@main
    # A called workflow cannot get more permissions than the caller grants.
    permissions:
      contents: read
      pull-requests: read
      issues: read
      id-token: write
    secrets:
      CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
```

Each calling repository also needs:

1. The `CLAUDE_CODE_OAUTH_TOKEN` repository secret. Create the token with `claude setup-token`. `secrets: inherit` is documented for organizations and enterprises, so pass the secret by name.
2. The Claude Code GitHub App, installed on the repository.

Rules:

- The required check name in the calling repository is `review / claude-review`, with the job ID `review`. A different job ID changes the check name and breaks a required check.
- `@main` applies each change of this workflow to every caller at once. To control updates, pin a commit SHA. Dependabot then updates the SHA only if the calling repository has a `github-actions` entry in `.github/dependabot.yml`.
- The pull request that adds the caller is probably not reviewed: the action runs only when its workflow file matches the default branch (see [security-baseline.md](security-baseline.md)). This was verified in this repository only. Confirm the behavior on the first caller, and update this line.

## Shared content with the organization repository

The organization configuration lives in `Cell-V/.github` (ClickUp task "Implement the .github repository as the organization configuration hub"). Some content is shared. Each shared item has one source of truth.

| Item | Source of truth | Copy in the other repository |
| --- | --- | --- |
| Label tooling (TypeScript) | `Cell-V/.github` | None. The personal sync calls it. It is never copied here |
| Label catalog schema | `Cell-V/.github` | `.github/labels.yml` here follows it. The personal catalog content stays personal |
| Contributor Covenant text | contributor-covenant.org, version 2.1 | Both repositories use the published text. Only the enforcement contact differs |
| Policy structure (`SECURITY.md`, `SUPPORT.md`, `CONTRIBUTING.md`, `ACCESSIBILITY.md`) | `massimoselvi/.github` until the organization adds its own | The organization adapts it. Contacts and response targets stay separate |
| Issue form fields | `massimoselvi/.github` until the organization adds its own | The organization adapts it. Labels follow each catalog |

Never share between the two repositories: targets, credentials, secrets, contact routes, or repository names.

### Keep shared content in sync

1. When a pull request changes a shared item in its source of truth, the author opens an issue in the other repository with a link to the pull request.
2. The other repository adopts the change, adapts it, or records why it does not apply. Close the issue with that decision.
3. Review the table above in each review of [security-baseline.md](security-baseline.md), every six months.

Last sync review: 2026-11-21. `Cell-V/.github` contains only `.gitignore`, so nothing was synced.

## Issues at the audit

The task description of 2026-11-20 noted one open issue in `massimoselvi/.github`. On 2026-11-21 the repository had no open or closed issues (`gh issue list --state all` returned none). No decision was necessary.
