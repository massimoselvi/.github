# Personal security baseline

This baseline applies to repositories owned by the personal account `massimoselvi`. The account has an active GitHub Pro subscription, confirmed on 2026-11-21. The account has one owner, who is also the only regular contributor.

This document describes the baseline. It does not apply rules to any repository. Apply the baseline to each repository separately.

## What is inherited and what is not

| Item | Where it comes from |
| --- | --- |
| `SECURITY.md` reporting guidance | Inherited from `massimoselvi/.github` when the repository has no own file |
| Private vulnerability reporting | Repository setting. Turn it on in each public repository |
| Dependabot alerts and security updates | Repository setting |
| Secret scanning and push protection | Repository setting, public repositories only (see the plan matrix) |
| Rulesets | Repository setting. `massimoselvi/.github` does not distribute rulesets |
| GitHub Actions permissions | Repository setting |
| `.github/dependabot.yml` | Repository file. Not inherited |
| `CODEOWNERS` | Repository file. Not inherited |

`CODEOWNERS` documents ownership. It makes owner review mandatory only when a ruleset requires review from code owners. The solo-owner baseline does not.

## Plan matrix

Check each item against the current GitHub documentation before you rely on it, because plan limits change. GitHub Pro does not include every security product for private repositories.

| Control | Public repository | Private repository on Pro | Private repository on Free, for reference |
| --- | --- | --- | --- |
| Rulesets and protected branches | Yes | Yes | No |
| Required pull request reviews | Yes | Yes | No |
| Code owners | Yes | Yes | No |
| Required status checks | Yes | Yes | No |
| Dependabot alerts, security updates, version updates | Yes | Yes | Yes |
| Dependency graph | Yes, on by default | Yes, enable it | Yes, enable it |
| Secret scanning and push protection | Yes | No | No |
| Code scanning with CodeQL | Yes | No | No |
| Private vulnerability reporting | Yes | Not applicable | Not applicable |

GitHub sells GitHub Secret Protection and GitHub Code Security to organizations, not to personal accounts. For private repositories, run a secret scanner (for example Gitleaks) in CI and as a pre-commit hook.

## Solo-owner default-branch ruleset

Create one ruleset per repository:

- Name: `default-branch`.
- Enforcement status: **Active**.
- Target: the default branch.
- Bypass list: **empty**. Do not add repository admins, Dependabot, or other apps.

A bypass actor with **For pull requests only** can bypass every rule in the ruleset, including required status checks, not only reviews. So a bypass on this ruleset is not a safe routine path for solo merges.

Rules:

- [ ] **Restrict deletions.**
- [ ] **Block force pushes.**
- [ ] **Require a pull request before merging**, with required approvals `0`. Do not require review from code owners. Do not require approval of the most recent reviewable push. Turn on **Require conversation resolution before merging**.
- [ ] **Require status checks to pass**, with **Require branches to be up to date before merging**. Add the actual CI checks of the repository (see "Required checks"). Repositories without CI: leave this rule off and keep the other rules. Add CI before you add the rule.
- [ ] **Require linear history.**
- [ ] Do not turn on **Restrict updates**. It blocks routine merges unless an actor can bypass it.

Merge settings of the repository (they are not ruleset rules):

- [ ] Allow **squash merging** only. Turn off merge commits and rebase merging. Linear history alone still allows rebase merges.
- [ ] Use the pull request title as the default squash commit message.
- [ ] Turn on **Automatically delete head branches**.

### Required checks

- Add a check to the ruleset only after it has run successfully in the repository. GitHub lists only checks that completed in the last seven days.
- Make sure each required check reports on every pull request to the default branch. A workflow that path or branch filters skip never reports, and the check stays **Pending** and blocks the merge. Do not put `paths` filters on a workflow with a required job.
- A job skipped by a job-level `if:` reports success. A skipped job means "not run", not "passed". Do not require a job that skips on purpose to approve a change.
- A `workflow_dispatch` run does not satisfy a required check. The workflow must run on `pull_request`.
- Where the ruleset offers it, set **GitHub Actions** as the expected source of each check. This stops another app from reporting a check with the same name.

In `massimoselvi/.github`, require `Validate`. Do not require `claude-review` while the Claude Code GitHub App is not installed, because the job fails on every run.

### Optional hardening: signed commits

**Require signed commits** is not part of the baseline. Turn it on only after these checks:

1. Your local Git signs commits, with the SSH or GPG key registered on GitHub.
2. Commits from Dependabot and other bots in the repository show as **Verified**.
3. A test pull request merges. Unsigned commits on the head branch can block a squash merge, although GitHub signs the squash commit.

### Independent review, later

Add a review requirement only when a second reviewer is available. Keep the `default-branch` ruleset without bypass, and add a second ruleset for the review:

- Ruleset `review`, target the default branch, **Active**.
- **Require a pull request before merging**, with required approvals `1`, **Dismiss stale pull request approvals when new commits are pushed**, and review from code owners if `CODEOWNERS` lists the reviewer.
- If the owner still needs to merge without a review, add **Repository admin** to the bypass list of the `review` ruleset only, with **For pull requests only**. CI stays enforced by `default-branch`, because that ruleset has no bypass.

Test the two rulesets together before you rely on them. The admin bypass must not skip the checks of `default-branch`.

### Break glass

Rules do not stop the owner from editing the rules. If an emergency needs a change that the ruleset blocks:

1. Turn off only the rule that blocks the change, or set the ruleset to **Disabled**.
2. Make the change.
3. Restore the rule at once.
4. Record the reason, the time, and the commit in an issue or the commit message.

### Verify the ruleset

Verify the baseline in one representative repository before you apply it to others. Record the result in the ClickUp task.

- [ ] A direct push to the default branch is rejected.
- [ ] A force push to the default branch is rejected.
- [ ] Deletion of the default branch is rejected.
- [ ] A pull request with a failing required check cannot merge.
- [ ] A pull request with a pending required check cannot merge.
- [ ] A green pull request from the owner merges without an approval.
- [ ] If the `review` ruleset exists, its bypass does not skip the checks of `default-branch`.

## Account settings

Apply once, in **Settings** of the personal account.

- [ ] Two-factor authentication is on, with a passkey or a security key as the primary method. Store the recovery codes offline.
- [ ] Personal access tokens are fine-grained, scoped to selected repositories, and expire in 90 days or less. Delete classic tokens that you do not use.
- [ ] Review authorized OAuth apps and GitHub Apps every quarter. Revoke apps that you do not use.
- [ ] Review SSH keys and deploy keys every quarter.
- [ ] In **Code security**, turn on Dependabot alerts and the dependency graph for new repositories.

## Repository settings

Apply to each repository that you maintain, public or private.

### Code security

- [ ] Dependabot alerts and Dependabot security updates are on.
- [ ] `.github/dependabot.yml` sets weekly version updates for each package ecosystem in the repository, and for `github-actions` if the repository has workflows.
- [ ] Private repositories: the dependency graph is on, and CI runs a secret scanner.
- [ ] Public repositories: secret scanning and push protection are on.
- [ ] Public repositories: CodeQL default setup is on for each supported language.
- [ ] Public repositories: private vulnerability reporting is on. `SECURITY.md` depends on it.

### Lockfiles and the dependency graph

Dependabot alerts depend on the dependency graph. The dependency graph depends on lockfiles that GitHub can read.

- **pnpm 12:** when `pnpm-lock.yaml` has two YAML documents, the dependency graph does not detect its dependencies. pnpm 12 writes this format by default in projects that pin a pnpm version. In these repositories, check the **Dependency graph** tab after the first push. If it is empty, Dependabot alerts do not cover the project. Dependabot reads pnpm through the `npm` ecosystem.
- **Bun:** Dependabot version updates support Bun v1.1.39 and later, with the `bun` ecosystem. Dependabot security updates do not support Bun. Commit the text lockfile `bun.lock`, not only the binary `bun.lockb`. The GitHub documentation does not name the Bun lockfile, so check the **Dependency graph** tab after the first push.

### GitHub Actions

- [ ] **Workflow permissions** is set to read repository contents. Each workflow declares the extra `permissions` it needs at job level.
- [ ] **Allow GitHub Actions to create and approve pull requests** is off, unless a workflow needs it.
- [ ] Public repositories: workflows from fork pull requests need approval before they run.
- [ ] Third-party actions are pinned to a full commit SHA. Dependabot updates the pins.
- [ ] Workflows do not use `pull_request_target` with a checkout of the pull request code.
- [ ] Secrets are stored as repository or environment secrets, never in files. Deploys use OIDC to AWS, not long-lived access keys.

### Repository hygiene

- [ ] `CODEOWNERS` contains `* @massimoselvi`.
- [ ] `.gitignore` excludes `.env*`, credentials, and build output.
- [ ] Archive a repository when you stop maintaining it.

## References

- [Dependency graph supported package ecosystems](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/dependency-graph-supported-package-ecosystems)
- [Dependabot supported ecosystems and repositories](https://docs.github.com/en/code-security/dependabot/ecosystems-supported-by-dependabot/supported-ecosystems-and-repositories)
- [Creating rulesets for a repository](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository)
- [Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
- [Troubleshooting required status checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)
- [GitHub plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans)

## Review

Review this baseline every six months, when you change plan, and when a repository gets its first collaborator. Record the date of the last review here.

Last review: 2026-11-21.
