# Implementation Plan: GitHub Organization Management

## Overview

This plan implements a `.github` repository as the central configuration hub for a GitHub organization. It covers organization profile, community health files, issue/PR templates, workflow templates, label synchronization (with TypeScript-based validation and sync logic), and repository security configuration. Each task produces concrete files that can be committed to the `.github` repository.

## Tasks

- [x] 1. Set up project structure and tooling
  - [x] 1.1 Initialize project structure and TypeScript configuration
    - Create directory structure: `profile/`, `.github/ISSUE_TEMPLATE/`, `workflow-templates/`, `.github/workflows/`, `scripts/`
    - Initialize `package.json` with TypeScript, `ts-node`, `js-yaml`, `@octokit/rest` dependencies
    - Configure `tsconfig.json` for the validation and sync scripts
    - _Requirements: 15.1_

  - [x] 1.2 Create shared TypeScript types and interfaces
    - Define interfaces for `LabelDefinition`, `IssueTemplate`, `WorkflowProperties`, `FundingConfig`, `ContactLink`, `ValidationResult`
    - Create type guards and utility types for YAML/JSON parsed content
    - Place in `scripts/types.ts`
    - _Requirements: 5.3, 10.1, 11.1, 12.6_

- [x] 2. Implement organization profile
  - [x] 2.1 Create `profile/README.md` with organization identity
    - Include organization name, description, and mission statement as distinct sections
    - Add links to key repositories and contribution opportunities
    - Add badges or status indicators as appropriate
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 3. Implement community health files
  - [x] 3.1 Create `CODE_OF_CONDUCT.md`
    - Define acceptable and unacceptable behavior sections
    - Specify scope of applicability (repos, issues, PRs, communication channels)
    - Include enforcement procedures with responsible party and consequences
    - Add appeals process section
    - Provide private contact method for reporting
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Create `CONTRIBUTING.md`
    - Document branch naming conventions
    - Specify commit message format
    - Describe pull request expectations and workflow
    - _Requirements: 2.1, 2.4_

  - [x] 3.3 Create `SUPPORT.md`
    - Specify available support channels with at least one contact method
    - Include expected response times
    - _Requirements: 2.1, 2.5_

  - [x] 3.4 Create `SECURITY.md`
    - Include vulnerability reporting instructions with private disclosure channel (GitHub Security Advisories or dedicated email)
    - Define response timelines: acknowledgment within 48 hours, resolution/mitigation within 90 days
    - Describe scope (covered repositories/products, accepted vulnerability types)
    - State confirmation upon successful submission with reference identifier
    - _Requirements: 2.6, 14.1, 14.2, 14.3, 14.4, 14.5_

  - [x] 3.5 Create `FUNDING.yml`
    - Configure at least one funding platform (GitHub Sponsors, Open Collective, Ko-fi, or custom)
    - Ensure all URLs use HTTPS protocol
    - Limit GitHub Sponsors usernames to maximum of 4
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 4. Checkpoint - Verify community health files
  - Ensure all community health files pass Markdown linting, ask the user if questions arise.

- [x] 5. Implement issue and PR templates
  - [x] 5.1 Create bug report issue template
    - Create `.github/ISSUE_TEMPLATE/bug-report.yml` using GitHub Issue Forms YAML format
    - Include required fields: description (Textarea), steps to reproduce (Textarea), severity (Dropdown)
    - Include optional fields: version (Input), environment (Input)
    - Configure labels, title prefix `[Bug]: `
    - _Requirements: 5.1, 5.3, 5.5, 5.7_

  - [x] 5.2 Create feature request issue template
    - Create `.github/ISSUE_TEMPLATE/feature-request.yml` using GitHub Issue Forms YAML format
    - Include required fields: description (Textarea), use case (Textarea)
    - Include optional fields: proposed solution (Textarea), alternatives considered (Textarea)
    - Configure labels, title prefix `[Feature]: `
    - _Requirements: 5.1, 5.3, 5.5, 5.7_

  - [x] 5.3 Create issue template chooser configuration
    - Create `.github/ISSUE_TEMPLATE/config.yml`
    - Set `blank_issues_enabled` to `false`
    - Add contact links with valid HTTPS URLs, names (max 100 chars), and about descriptions (max 200 chars)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 5.4 Create pull request template
    - Create `.github/PULL_REQUEST_TEMPLATE.md`
    - Include "Description" section for summarizing changes and motivation
    - Include "Testing" section for verification details
    - Include "Review Checklist" with Markdown task list items (`- [ ]`)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 6. Implement workflow templates
  - [x] 6.1 Create CI pipeline workflow template
    - Create `workflow-templates/ci-pipeline.yml` with standard CI steps (lint, test, build)
    - Use `$default-branch` placeholder for branch references
    - Reference secrets via `${{ secrets.* }}` syntax only — no hardcoded secrets
    - _Requirements: 9.1, 9.4, 15.2, 15.3_

  - [x] 6.2 Create CI pipeline properties file
    - Create `workflow-templates/ci-pipeline.properties.json`
    - Include `name` matching workflow filename (without extension)
    - Include `description` (max 200 chars), `iconName` (valid Octicon), `categories`, and `filePatterns`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 6.3 Create security scanning workflow template
    - Create `workflow-templates/security-scan.yml` with dependency/code scanning steps
    - Use `$default-branch` placeholder and `${{ secrets.* }}` for any secret references
    - _Requirements: 9.1, 9.4, 15.2, 15.3_

  - [x] 6.4 Create security scanning properties file
    - Create `workflow-templates/security-scan.properties.json`
    - Include all required fields: `name`, `description`, `iconName`, `categories`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 7. Checkpoint - Verify templates
  - Ensure all YAML templates are valid, properties files match their workflow counterparts, ask the user if questions arise.

- [x] 8. Implement label synchronization system
  - [x] 8.1 Create label definitions file
    - Create `.github/labels.yml` with canonical label set
    - Each label entry includes required `name`, `color` (6-char hex), `description`, and optional `aliases`
    - Ensure no duplicate names (case-insensitive) and max 10 aliases per label
    - _Requirements: 11.1, 11.3, 12.6_

  - [x] 8.2 Implement label definitions validator in TypeScript
    - Create `scripts/validate-labels.ts`
    - Validate YAML syntax, required fields (name, color, description)
    - Validate hex color pattern `^[0-9a-fA-F]{6}$`
    - Check for duplicate names/aliases (case-insensitive)
    - Report errors per invalid entry; skip invalid labels and continue
    - _Requirements: 11.3, 11.4, 12.4, 13.6_

  - [x] 8.3 Write property test for label color validation
    - **Property 7: Label Definition Validity**
    - Test that for any set of label definitions, colors match hex pattern and no duplicate names exist (case-insensitive)
    - **Validates: Requirements 11.3, 12.4**

  - [x] 8.4 Implement label sync logic in TypeScript
    - Create `scripts/sync-labels.ts`
    - Use `@octokit/rest` to interact with GitHub API
    - Implement create, update, and rename operations per the sync algorithm
    - Handle alias matching (case-insensitive, first match wins)
    - Handle conflict when canonical name already exists on target repo
    - Use minimal permissions (issues: write)
    - Generate sync report with counts and names of created/updated/renamed per repo
    - _Requirements: 11.2, 11.5, 11.6, 12.1, 12.2, 12.3, 12.5, 13.4, 13.5, 15.4_

  - [x] 8.5 Write property test for label sync convergence
    - **Property 4: Label Sync Convergence**
    - Test that after sync execution, target repository labels match all definitions exactly
    - **Validates: Requirements 11.2, 11.5, 11.6**

  - [x] 8.6 Create label sync GitHub Actions workflow
    - Create `.github/workflows/label-sync.yml`
    - Configure cron trigger (daily schedule)
    - Configure `workflow_dispatch` for manual trigger
    - Run TypeScript sync script with minimal permissions
    - Target all non-archived organization repositories
    - _Requirements: 13.1, 13.2, 13.3, 13.7_

- [x] 9. Implement template validation workflow
  - [x] 9.1 Implement issue template validator in TypeScript
    - Create `scripts/validate-templates.ts`
    - Validate each template has unique `name` (case-insensitive), non-empty `description` (1-200 chars), at least one valid form element in `body`
    - Validate contact links in config.yml (name max 100 chars, HTTPS URL, about max 200 chars)
    - Report all validation errors with filename and specific failure
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.5, 7.6_

  - [x] 9.2 Write property test for issue template structural validity
    - **Property 6: Issue Template Structural Validity**
    - Test that templates have unique names, non-empty descriptions, and at least one form element
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [x] 9.3 Create template validation GitHub Actions workflow
    - Create `.github/workflows/validate-templates.yml`
    - Trigger on pull requests that modify `.github/ISSUE_TEMPLATE/` directory
    - Run TypeScript validation script
    - Block merging on validation errors
    - _Requirements: 6.5_

- [x] 10. Implement funding validation
  - [x] 10.1 Implement FUNDING.yml validator in TypeScript
    - Create `scripts/validate-funding.ts`
    - Validate YAML syntax and at least one funding platform specified
    - Validate all URLs use HTTPS protocol
    - Validate GitHub Sponsors usernames (max 4, publicly accessible)
    - Report validation errors on invalid configuration
    - _Requirements: 4.2, 4.5_

  - [x] 10.2 Write property test for funding URL HTTPS validation
    - **Property 1: Funding URL HTTPS Validation**
    - Test that all URLs in FUNDING.yml use HTTPS protocol
    - **Validates: Requirements 4.2**

- [x] 11. Implement workflow template validation
  - [x] 11.1 Implement workflow template validator in TypeScript
    - Create `scripts/validate-workflows.ts`
    - Validate each workflow template has a corresponding `.properties.json`
    - Validate properties contain required fields: `name`, `description`, `iconName`, `categories`
    - Validate `name` matches workflow filename without extension
    - Check for hardcoded secrets (reject if found)
    - _Requirements: 10.1, 10.2, 10.7, 15.2_

  - [x] 11.2 Write property test for workflow template consistency
    - **Property 2: Workflow Template Consistency**
    - Test that every workflow template has a matching properties file with valid fields
    - **Validates: Requirements 10.1, 10.2, 10.7**

  - [x] 11.3 Write property test for no hardcoded secrets
    - **Property 3: No Hardcoded Secrets in Workflow Templates**
    - Test that workflow templates contain no hardcoded secret values
    - **Validates: Requirements 15.2**

- [x] 12. Configure repository security
  - [x] 12.1 Document branch protection rules
    - Create `.github/branch-protection.md` documenting required protection rules
    - Require at least 1 approving PR review on default branch
    - Disable direct pushes to default branch
    - Note: actual enforcement is configured via GitHub API/UI, not files
    - _Requirements: 15.1, 15.5_

- [x] 13. Integration and wiring
  - [x] 13.1 Create unified validation script
    - Create `scripts/validate-all.ts` that runs all validators (labels, templates, funding, workflows)
    - Exit with non-zero code on any validation failure
    - Produce consolidated validation report
    - _Requirements: 6.4, 10.7, 11.4, 13.6_

  - [x] 13.2 Create CI workflow for the .github repository itself
    - Create `.github/workflows/ci.yml`
    - Run unified validation on push and PR
    - Ensure all template and configuration files pass validation before merge
    - _Requirements: 6.5, 15.1_

  - [x] 13.3 Write integration tests for label sync
    - Test end-to-end label sync against mock GitHub API responses
    - Verify sync report accuracy matches actual operations
    - **Property 5: Sync Report Accuracy**
    - **Validates: Requirements 13.5**

- [~] 14. Final checkpoint - Ensure all validations pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The label sync system uses TypeScript with `@octokit/rest` for GitHub API interactions
- All workflow templates use `${{ secrets.* }}` syntax — never hardcoded secrets
- Community health files and templates are static content (Markdown/YAML) — no compilation needed
- Validation scripts are TypeScript and require `ts-node` or compilation to run in CI

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "3.1", "3.2", "3.3", "3.4", "3.5"] },
    { "id": 2, "tasks": ["5.1", "5.2", "5.3", "5.4", "6.1", "6.3", "8.1"] },
    { "id": 3, "tasks": ["6.2", "6.4", "8.2", "9.1", "10.1", "11.1"] },
    { "id": 4, "tasks": ["8.3", "8.4", "9.2", "10.2", "11.2", "11.3"] },
    { "id": 5, "tasks": ["8.5", "8.6", "9.3", "12.1"] },
    { "id": 6, "tasks": ["13.1"] },
    { "id": 7, "tasks": ["13.2", "13.3"] }
  ]
}
```
