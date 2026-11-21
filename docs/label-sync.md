# Label sync for personal repositories

GitHub does not inherit labels from the `.github` repository, and personal accounts have no default labels setting. A sync through the GitHub API applies the personal catalog to each target repository.

## Files

| File | Role |
| --- | --- |
| [`.github/labels.yml`](../.github/labels.yml) | Personal label catalog. The schema is the same as the shared tooling uses |
| [`.github/label-sync-targets.yml`](../.github/label-sync-targets.yml) | Explicit list of personal target repositories |

## Tooling

This repository does not contain sync code. The shared TypeScript tooling lives with the organization work in `Cell-V/.github`. Do not copy or fork it here. The personal sync calls the shared tooling with the personal catalog, the personal targets, and the personal token.

Status on 2026-11-21: the shared tooling is not published in `Cell-V/.github` yet. Until it is, the catalog and the targets are the source of truth, and no automated sync runs.

When the shared tooling is published as a reusable workflow, add `.github/workflows/label-sync.yml` here. The workflow must:

- Run on `workflow_dispatch` only at first, with a `dry_run` input that defaults to `true`.
- Read `.github/label-sync-targets.yml`, and never discover targets by listing the account.
- Pass `delete_unlisted: false` unless the person who runs it opts in for that run.
- Use only the `PERSONAL_LABEL_SYNC_TOKEN` secret.
- Declare `permissions: contents: read` at job level, because the token, not `GITHUB_TOKEN`, writes the labels.

## Credentials

Keep personal and organization credentials separate.

| Item | Personal sync | Organization sync |
| --- | --- | --- |
| Repository that runs it | `massimoselvi/.github` | `Cell-V/.github` |
| Secret name | `PERSONAL_LABEL_SYNC_TOKEN` | Defined in `Cell-V/.github` |
| Token owner | `massimoselvi` | The organization or a GitHub App |
| Targets | `.github/label-sync-targets.yml` here | Defined in `Cell-V/.github` |

Create the personal token as a fine-grained personal access token:

1. Resource owner: `massimoselvi`.
2. Repository access: **Only select repositories**, the repositories in `label-sync-targets.yml`.
3. Repository permissions: **Issues: Read and write**, and **Metadata: Read-only**. No other permission.
4. Expiration: 90 days. Add a calendar reminder to rotate it.
5. Store it as the repository secret `PERSONAL_LABEL_SYNC_TOKEN` in `massimoselvi/.github`. Never commit it, and never print it in logs.

## Change the catalog

1. Edit `.github/labels.yml`. To rename a label, change `name` and add the old name to `aliases`. The sync then renames the label and keeps it on existing issues.
2. Do not remove a label that is in use. Without the delete opt-in, the sync leaves it on the target repositories.
3. Run the sync in dry-run mode and read the report before you apply it.

## Change the targets

1. Add only public repositories owned by `massimoselvi`. This repository is public, so a private repository name here discloses it.
2. Exclude forks and archived repositories.
3. Refresh the list with `gh repo list massimoselvi --visibility public --source --no-archived --json name --jq '.[].name'`, and update the review date in the file.
4. Add the new repository to the repository access of the token.
