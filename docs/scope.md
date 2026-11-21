# Scope and audit

This document defines what `massimoselvi/.github` contains and what it does not contain. It also records the audit of 2026-11-21 that started this version.

## Purpose

`massimoselvi/.github` is the default-files hub for repositories owned by the personal GitHub account `massimoselvi`. It must stay public. If it becomes private, GitHub stops applying the default files.

## Boundaries

| Area | Status for a personal account | Decision |
| --- | --- | --- |
| Default community health files, including `ACCESSIBILITY.md` | Supported | In scope |
| `VULNERABILITY_REPORT.yml` | Supported | Out of scope for now. Add it to require fields in private vulnerability reports |
| Issue forms and chooser configuration | Supported | In scope |
| Pull request template | Supported | In scope |
| Discussion category forms | Supported | Out of scope until a repository enables Discussions |
| `FUNDING.yml` | Supported | Out of scope until a sponsor account exists. A placeholder file would show a broken Sponsor button |
| Label catalog and sync through the API | Supported, not inherited | In scope. Catalog and targets only, see [label-sync.md](label-sync.md) |
| Profile README | Served from `massimoselvi/massimoselvi` | Out of scope |
| `profile/README.md` | Organization accounts only | Not added |
| `workflow-templates/` | Organization accounts only | Not added |
| Organization default labels | Organization accounts only | Not added |
| Shared CI | Reusable workflows in a public repository | Out of scope here. Do not use workflow templates |
| Branch protection, rulesets, required reviews, code owners | Available in public and private repositories, because the account has GitHub Pro. Repository-local, not inherited | Documented in [security-baseline.md](security-baseline.md) |

Organization work belongs in the public `Cell-V/.github` repository. Do not add organization profile content, organization workflow templates, organization targets, or organization credentials here.

## How GitHub applies the defaults

- GitHub uses a default file only when the target repository has no file with the same name in its `.github/`, root, or `docs/` folder. GitHub reads these folders in that order.
- If a repository has any file in its own `.github/ISSUE_TEMPLATE/` folder, GitHub ignores the whole default `ISSUE_TEMPLATE/` folder, including `config.yml`.
- Default files do not appear in the file tree or the clone of the target repository. They appear only in the GitHub user interface: the issue chooser, the pull request form, and the community profile.
- Relative links in a default file resolve against `massimoselvi/.github`. Contact links in `config.yml` must be absolute URLs.
- A label that an issue form sets must exist in `massimoselvi/.github` and in the target repository. Otherwise GitHub does not apply it.
- GitHub does not inherit `CODEOWNERS`, `.gitignore`, `LICENSE`, `README.md`, workflows, labels, or repository settings.

## Repository layout

| Path | Role | Inherited |
| --- | --- | --- |
| `ACCESSIBILITY.md` | Accessibility goals, known barriers, and reporting | Yes |
| `CODE_OF_CONDUCT.md` | Contributor Covenant 2.1 | Yes |
| `CONTRIBUTING.md` | Contribution and review rules | Yes |
| `SECURITY.md` | Private vulnerability reporting policy | Yes |
| `SUPPORT.md` | Support channels | Yes |
| `.github/pull_request_template.md` | Default pull request template | Yes |
| `.github/ISSUE_TEMPLATE/` | Bug, feature, and question forms, and the chooser | Yes |
| `.github/labels.yml` | Personal label catalog | No |
| `.github/label-sync-targets.yml` | Explicit personal sync targets | No |
| `CODEOWNERS` | Code owners for this repository only | No |
| `docs/` | Scope, security baseline, label sync | No |
| `.kiro/specs/` | Kiro specification of the wider profile work | No |

## Audit of 2026-11-21

State before this change, and the decision for each item.

| Item | Finding | Decision |
| --- | --- | --- |
| `PULL_REQUEST_TEMPLATE` (root, no extension) | Legacy template that competed with `.github/pull_request_template.md` | Removed |
| `.github/PULL_REQUEST_TEMPLATE/bug_fix.md`, `feature.md` | Empty files. Multiple templates also need a `?template=` query parameter | Removed |
| `.github/pull_request_template.md` | Example content about a web application, not a template | Rewritten |
| `CODE_OF_CONDUCT.md` | Linked to pages and an email address that do not exist | Replaced with Contributor Covenant 2.1 |
| `SECURITY.md` | Linked to a domain and an email address that do not exist | Rewritten for GitHub private vulnerability reporting |
| `CONTRIBUTING.md` | Generic boilerplate with the same broken links | Rewritten |
| `CODEOWNERS` | Pointed to a team of another account, which is not valid in a personal repository | Set to `@massimoselvi` |
| `SUPPORT.md`, `ACCESSIBILITY.md`, issue forms | Missing | Added |
| Labels | Only the GitHub defaults | Personal catalog added |
| Pull request #1 | Organization scope. Closed without merge | Not reused as completed work. Issue form ideas adapted |

## Conflict with the Kiro specification

`.kiro/specs/personal-github-profile/` Requirement 5 and task 1.2 ask to remove `CONTRIBUTING.md`, issue templates, and label configuration, and to keep `profile/README.md`. The ClickUp plan of 2026-11-20 replaces that requirement: those files are in scope, and `profile/README.md` is organization-only. Update the specification to match, or mark task 1.2 as superseded.
