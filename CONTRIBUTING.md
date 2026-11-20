# Contributing

Thanks for your interest in contributing. Whether you are reporting a bug,
proposing a feature, fixing a typo, or improving documentation, your help is
welcome and appreciated.

This guide documents how we work: branch naming, commit message format, and
what we expect from a pull request. Following it keeps our history readable and
our review process fast.

## Before You Start

- Search existing [issues](https://github.com/Cell-V/.github/issues)
  and pull requests to avoid duplicating work already in progress.
- For anything beyond a small fix, open an issue first so we can agree on the
  approach before you invest time in it.
- Be kind and constructive. All participation is governed by our
  [Code of Conduct](./CODE_OF_CONDUCT.md).

## Branch Naming

Create a dedicated branch for every change. Never commit directly to `main`.

Use a `type/short-description` format, where `type` describes the kind of work
and the description is a few lowercase words separated by hyphens.

- `feature/` — new functionality
- `fix/` — bug fixes
- `docs/` — documentation-only changes
- `chore/` — tooling, dependencies, and maintenance
- `refactor/` — code changes that neither fix a bug nor add a feature

Examples:

```text
feature/label-sync-workflow
fix/issue-template-validation
docs/update-security-policy
chore/bump-dependencies
```

When a branch relates to an issue, include the issue number for traceability,
for example `fix/142-broken-funding-url`.

## Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/)
specification. A commit message has this structure:

```text
<type>(<optional scope>): <description>

<optional body>

<optional footer>
```

Common types:

- `feat` — a new feature
- `fix` — a bug fix
- `docs` — documentation only
- `refactor` — a code change that neither fixes a bug nor adds a feature
- `test` — adding or correcting tests
- `chore` — build process, tooling, or dependency changes

Guidelines:

- Write the description in the imperative mood ("add", not "added" or "adds").
- Keep the subject line at 72 characters or fewer and do not end it with a period.
- Use the body to explain **what** changed and **why**, not how.
- Reference related issues in the footer, for example `Closes #142`.
- Mark breaking changes with a `!` after the type or a `BREAKING CHANGE:`
  footer, for example `feat!: drop support for legacy config`.

Examples:

```text
feat(labels): add alias-based rename support

fix(templates): reject issue forms missing a description

docs: clarify branch naming conventions

chore(deps): bump @octokit/rest to 21.0.0
```

## Pull Requests

Before opening a pull request, make sure that:

1. Your work is based on the latest `main` branch.
2. The change is focused on a single concern. Keep unrelated reformatting
   out of it.
3. Tests and linters pass locally.
4. Documentation is updated to reflect any behavior changes.

When you open the pull request:

- Fill out the pull request template completely, including the description,
  testing notes, and review checklist.
- Give it a clear title that follows the Conventional Commits format and
  matches the primary change.
- Link the issues it addresses so they close automatically on merge.
- Keep the pull request as small as is reasonable; smaller changes are reviewed
  and merged faster.

What to expect during review:

- At least one approving review is required before a pull request can be merged
  into `main`.
- Address review feedback by pushing new commits to the same branch. Avoid
  force-pushing once review has started so reviewers can follow your updates.
- All automated checks must pass before merge.
- A maintainer merges approved pull requests. We generally squash merge so that
  each change lands as a single, well-described commit on `main`.

## Questions

If you get stuck or need direction, see [SUPPORT.md](./SUPPORT.md) for the best
way to reach us. For security issues, follow [SECURITY.md](./SECURITY.md)
instead of opening a public issue.
