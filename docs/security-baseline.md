# Personal security baseline

This baseline applies to repositories owned by the personal account `massimoselvi`. The account has GitHub Pro and one owner, who is also the only regular contributor.

The `.github` repository cannot enforce settings. Rulesets, branch protection, code owners, and security features are repository-local. Apply each setting in the account or in each repository. `CODEOWNERS` is not inherited from this repository.

Check each item against the current GitHub documentation before you rely on it, because plan limits change.

## What GitHub Pro gives this account

| Control | Public repository | Private repository on Pro | Private repository on Free, for reference |
| --- | --- | --- | --- |
| Rulesets and protected branches | Yes | Yes | No |
| Required pull request reviews | Yes | Yes | No |
| Code owners | Yes | Yes | No |
| Required status checks | Yes | Yes | No |
| Wikis and repository insights | Yes | Yes | No |
| Dependabot alerts, security updates, version updates | Yes | Yes | Yes |
| Dependency graph | Yes, on by default | Yes, enable it | Yes, enable it |
| Secret scanning and push protection | Yes | No | No |
| Code scanning with CodeQL | Yes | No | No |
| Private vulnerability reporting | Yes | Not applicable | Not applicable |

GitHub Pro does not add secret scanning or code scanning to private repositories. GitHub sells GitHub Secret Protection and GitHub Code Security to organizations, not to personal accounts. For private repositories, run a secret scanner (for example Gitleaks) in CI and as a pre-commit hook. Confirm this on the GitHub pricing page if your plan changes.

## Solo-owner rules

The owner cannot approve their own pull request. A ruleset that requires one approval blocks every merge in a repository with one contributor. The baseline uses these rules:

- **Pull requests with status checks are the gate.** Every change goes through a pull request, and CI must pass. Required approvals stay at `0`.
- **Self-review is mandatory.** Read the diff of the pull request on GitHub before you merge it. For changes to infrastructure, authentication, or CI, review the diff with the review rules in [CONTRIBUTING.md](../CONTRIBUTING.md).
- **No bypass in normal work.** The ruleset has no bypass actors. If an emergency needs a direct push, turn off the ruleset, push, turn on the ruleset again, and record the reason in the commit message.
- **Collaborators change the rules.** When a repository gets a collaborator with write access, set the required approvals to `1`, require review from code owners, and turn on **Dismiss stale pull request approvals when new commits are pushed**. The collaborator then reviews the owner, and the owner reviews the collaborator.

## Account settings

Apply once, in **Settings** of the personal account.

- [ ] Two-factor authentication is on, with a passkey or a security key as the primary method. Store the recovery codes offline.
- [ ] Commits are signed with an SSH or GPG key, and **Vigilant mode** is on.
- [ ] Personal access tokens are fine-grained, scoped to selected repositories, and expire in 90 days or less. Delete classic tokens that you do not use.
- [ ] Review authorized OAuth apps and GitHub Apps every quarter. Revoke apps that you do not use.
- [ ] Review SSH keys and deploy keys every quarter.
- [ ] In **Code security**, turn on Dependabot alerts and the dependency graph for new repositories.

## Repository settings

Apply to each repository that you maintain, public or private.

### Default branch ruleset

Create a ruleset named `default-branch` that targets the default branch, with status **Active** and no bypass actors:

- [ ] Restrict deletions.
- [ ] Block force pushes.
- [ ] Require linear history.
- [ ] Require signed commits.
- [ ] Require a pull request before merging, with required approvals `0`. Turn on **Require conversation resolution before merging**.
- [ ] Require the status checks of the CI workflow to pass, and require the branch to be up to date before merging.

Repositories without CI: keep the pull request rule, and add CI before you add status checks.

### Merge settings

- [ ] Allow squash merging only. Use the pull request title as the default commit message.
- [ ] Turn on **Automatically delete head branches**.

### Code security

- [ ] Dependabot alerts and Dependabot security updates are on.
- [ ] A `.github/dependabot.yml` file sets weekly version updates for each package ecosystem and for `github-actions`.
- [ ] Private repositories: the dependency graph is on, and CI runs a secret scanner.
- [ ] Public repositories: secret scanning and push protection are on.
- [ ] Public repositories: CodeQL default setup is on for each supported language.
- [ ] Public repositories: private vulnerability reporting is on. `SECURITY.md` depends on it.

### GitHub Actions

- [ ] **Workflow permissions** is set to read repository contents. Each workflow declares the extra `permissions` it needs at job level.
- [ ] **Allow GitHub Actions to create and approve pull requests** is off, unless a workflow needs it.
- [ ] Public repositories: workflows from fork pull requests need approval before they run.
- [ ] Third-party actions are pinned to a full commit SHA. Dependabot updates the pins.
- [ ] Workflows do not use `pull_request_target` with a checkout of the pull request code.
- [ ] Secrets are stored as repository or environment secrets, never in files. Deploys use OIDC to AWS, not long-lived access keys.

### Repository hygiene

- [ ] `CODEOWNERS` contains `* @massimoselvi`. GitHub does not inherit it from `.github`.
- [ ] `.gitignore` excludes `.env*`, credentials, and build output.
- [ ] Archive a repository when you stop maintaining it.

## Review

Review this baseline every six months, when you change plan, and when a repository gets its first collaborator. Record the date of the last review here.

Last review: 2026-11-21.
