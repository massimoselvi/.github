# Contributing

Thank you for your interest. These guidelines apply to every repository owned by [@massimoselvi](https://github.com/massimoselvi) that does not have its own `CONTRIBUTING.md`. A repository-specific file always takes precedence.

## Before you start

- Read the [Code of Conduct](CODE_OF_CONDUCT.md). It applies to all issues, pull requests, and comments.
- Report a security problem as [SECURITY.md](SECURITY.md) describes. Do not open a public issue.
- For questions and help, read [SUPPORT.md](SUPPORT.md).
- To report an accessibility barrier, read [ACCESSIBILITY.md](ACCESSIBILITY.md).
- Search the open and closed issues before you open a new one.

## Issues

Use an issue form: **Bug report**, **Feature request**, or **Question**. Give enough detail to reproduce the problem or to understand the need. Write in English.

For a large change, open an issue first and agree on the approach before you write code. This prevents work that the maintainer cannot accept.

## Pull requests

1. Fork the repository and create a short-lived branch from the default branch.
2. Keep each pull request to one purpose. Small pull requests get faster reviews.
3. Write commit messages and the pull request title in [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) format, for example `fix(api): handle empty payload`.
4. Fill in the pull request template. Link the issue on the `Task:` line.
5. Add or update tests, and run the checks of the repository locally.
6. Make sure that CI passes, and reply to review comments.

The maintainer reviews pull requests on a best-effort basis. The target is a first response within 5 business days.

## Review

Reviews focus on correctness, architecture, security, and performance. Linters and formatters handle style. Review findings use three tags:

| Tag | Meaning | Blocks the merge |
| --- | --- | --- |
| 🔴 Blocker | A defect, security issue, or design problem that must be fixed | Yes |
| 🟡 Suggestion | An improvement that is worth doing | No |
| 🔵 Nitpick | A small, optional detail | No |

## Licensing

Your contribution is licensed under the license of the repository you contribute to. If a repository has no license file, ask in the issue before you contribute.
