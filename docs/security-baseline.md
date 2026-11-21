# Personal security baseline

This baseline applies to repositories owned by the personal account `massimoselvi`. The `.github` repository cannot enforce settings. Apply each setting in the account or in each repository. Check each item against the current GitHub documentation before you rely on it, because plan limits change.

## Plan matrix

| Control | Public repository, Free | Private repository, Free | Private repository, Pro |
| --- | --- | --- | --- |
| Branch protection rules and rulesets | Yes | No | Yes |
| Required pull request reviews | Yes | No | Yes |
| Required review from code owners | Yes | No | Yes |
| Required status checks | Yes | No | Yes |
| Draft pull requests | Yes | No | Yes |
| Dependabot alerts, security updates, version updates | Yes | Yes | Yes |
| Dependency graph | Yes, on by default | Yes, enable it | Yes, enable it |
| Secret scanning and push protection | Yes | No | No |
| Code scanning with CodeQL | Yes | No | No |
| Private vulnerability reporting | Yes | Not applicable | Not applicable |

Secret scanning and code scanning for private repositories need GitHub Secret Protection and GitHub Code Security. GitHub sells them to organizations on Team or Enterprise, not to personal accounts. For private personal repositories, run a secret scanner (for example Gitleaks) in CI and as a pre-commit hook.

## Account settings

Apply once, in **Settings** of the personal account.

- [ ] Two-factor authentication is on, with a passkey or a security key as the primary method. Store the recovery codes offline.
- [ ] Commits are signed with an SSH or GPG key, and **Vigilant mode** is on.
- [ ] Personal access tokens are fine-grained, scoped to selected repositories, and expire in 90 days or less. Delete classic tokens that you do not use.
- [ ] Review authorized OAuth apps and GitHub Apps every quarter. Revoke apps that you do not use.
- [ ] Review SSH keys and deploy keys every quarter.
- [ ] In **Code security**, turn on Dependabot alerts and the dependency graph for new repositories.

## Repository settings

Apply to each repository. Items marked **Public or Pro** need a public repository or GitHub Pro.

### Default branch ruleset (Public or Pro)

Create a ruleset that targets the default branch:

- [ ] Require a pull request before merging.
- [ ] Require the status checks of the CI workflow to pass.
- [ ] Block force pushes.
- [ ] Restrict deletions.
- [ ] Require linear history.
- [ ] Require signed commits.

A solo maintainer cannot approve their own pull request. Set the required approvals to `0` while you are the only contributor, so that the rule does not block every merge. When a repository has collaborators, set the required approvals to `1`, require review from code owners, and add **Repository admin** to the bypass list only for emergencies.

### Code security

- [ ] Dependabot alerts and Dependabot security updates are on.
- [ ] A `.github/dependabot.yml` file sets weekly version updates for each package ecosystem and for `github-actions`.
- [ ] Public repositories: secret scanning and push protection are on.
- [ ] Public repositories: CodeQL default setup is on for each supported language.
- [ ] Public repositories: private vulnerability reporting is on. `SECURITY.md` depends on it.

### GitHub Actions

- [ ] **Workflow permissions** is set to read repository contents. Each workflow declares the extra `permissions` it needs at job level.
- [ ] **Allow GitHub Actions to create and approve pull requests** is off, unless a workflow needs it.
- [ ] Workflows from fork pull requests need approval before they run.
- [ ] Third-party actions are pinned to a full commit SHA. Dependabot updates the pins.
- [ ] Workflows do not use `pull_request_target` with a checkout of the pull request code.
- [ ] Secrets are stored as repository or environment secrets, never in files. Deploys use OIDC to AWS, not long-lived access keys.

### Repository hygiene

- [ ] `CODEOWNERS` contains `* @massimoselvi`. GitHub does not inherit it from `.github`.
- [ ] `.gitignore` excludes `.env*`, credentials, and build output.
- [ ] Archive a repository when you stop maintaining it.

## Review

Review this baseline every six months, and when you change plan. Record the date of the last review here.

Last review: 2026-11-21.
