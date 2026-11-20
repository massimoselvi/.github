# Requirements Document

## Introduction

This document defines the requirements for the GitHub Organization Management feature, which establishes a centralized `.github` repository as the configuration hub for a GitHub organization. The repository provides default community health files, issue/PR templates, reusable workflow templates, organization profile content, and label synchronization that apply across all organization repositories.

## Glossary

- **Dot_GitHub_Repository**: The special `.github` repository that serves as the central configuration hub for the organization, providing default files inherited by all organization repositories.
- **Organization_Profile**: The public-facing README displayed on the organization's GitHub profile page, located at `profile/README.md`.
- **Community_Health_Files**: A set of default files (CODE_OF_CONDUCT.md, CONTRIBUTING.md, SUPPORT.md, SECURITY.md, FUNDING.yml) that establish contribution standards across all repositories.
- **Issue_Template_System**: The collection of YAML-based issue form templates and configuration that guide contributors to provide structured information when creating issues.
- **Template_Chooser**: The GitHub UI that displays available issue templates and external contact links when a user creates a new issue.
- **Workflow_Template_System**: Reusable GitHub Actions workflow templates available to all organization repositories via the Actions tab.
- **Properties_File**: A JSON file accompanying each workflow template that provides metadata (name, description, icon, categories, file patterns).
- **Label_Sync_System**: The automated system that maintains consistent labels across all organization repositories using a definitions file and a synchronization workflow.
- **Label_Definition**: A YAML entry specifying a label's name, hex color, description, and optional aliases for renaming.
- **Form_Element**: A component within an issue template body (Input, Textarea, Dropdown, Checkboxes, or Markdown).

## Requirements

### Requirement 1: Organization Profile Display

**User Story:** As a visitor, I want to see a clear organization profile on GitHub, so that I can understand the organization's identity, mission, and key resources.

#### Acceptance Criteria

1. WHEN a visitor navigates to the organization's GitHub page, THE Organization_Profile SHALL display the content of `profile/README.md` rendered as Markdown.
2. THE Organization_Profile SHALL contain the organization name, a description of the organization's purpose, and a mission statement, each identifiable as distinct sections or paragraphs.
3. THE Organization_Profile SHALL provide at least one link to an organization repository and at least one link to a resource where visitors can contribute (e.g., a contributing guide, open issues, or discussion forum).
4. IF the `profile/README.md` file is missing or does not exist, THEN THE Organization_Profile SHALL not render any content on the organization page. An empty file that exists SHALL be treated identically to a missing file.

### Requirement 2: Community Health File Inheritance

**User Story:** As a repository maintainer, I want community health files defined once at the organization level, so that all repositories automatically inherit consistent standards without duplication.

#### Acceptance Criteria

1. THE Dot_GitHub_Repository SHALL provide default CODE_OF_CONDUCT.md, CONTRIBUTING.md, SUPPORT.md, SECURITY.md, and FUNDING.yml files at the repository root.
2. WHEN a repository does not define its own community health file AND the Dot_GitHub_Repository provides a default for that file type, THEN THE Dot_GitHub_Repository SHALL provide the organization-level default via GitHub's default file resolution mechanism.
3. WHEN a repository defines its own community health file, THE repository's local file SHALL take precedence over the organization-level default.
4. THE CONTRIBUTING.md SHALL document contribution workflows including branch naming conventions, commit message format, and pull request expectations.
5. THE SUPPORT.md SHALL specify available support channels including at least one contact method and expected response times.
6. THE SECURITY.md SHALL include vulnerability reporting instructions with a private disclosure channel (GitHub Security Advisories or dedicated email).

### Requirement 3: Code of Conduct

**User Story:** As an organization administrator, I want a centralized code of conduct, so that behavioral expectations are consistent and visible across all repositories.

#### Acceptance Criteria

1. THE CODE_OF_CONDUCT.md SHALL define behavioral expectations covering at minimum: acceptable behavior, unacceptable behavior, and the scope of applicability (repository interactions, issue discussions, pull request reviews, and any organization-managed communication channels).
2. WHEN a user navigates to a repository's Community tab, IF no local CODE_OF_CONDUCT.md exists in that repository, THEN THE Dot_GitHub_Repository SHALL provide the organization-level CODE_OF_CONDUCT.md as the default.
3. THE CODE_OF_CONDUCT.md SHALL specify enforcement procedures including the responsible party for enforcement decisions, the range of possible consequences for violations, and at least one private contact method (email address or GitHub Security Advisories) for reporting incidents.
4. THE CODE_OF_CONDUCT.md SHALL define an appeals process that describes how a person subject to enforcement action can request a review of the decision.

### Requirement 4: Funding Configuration

**User Story:** As an organization administrator, I want to configure sponsorship links centrally, so that funding opportunities are consistently presented across all repositories.

#### Acceptance Criteria

1. THE FUNDING.yml SHALL specify at least one funding platform from the supported set: GitHub Sponsors, Open Collective, Ko-fi, or custom URLs.
2. WHEN URLs are included in FUNDING.yml, THE Dot_GitHub_Repository SHALL validate that all URLs use HTTPS protocol.
3. WHEN GitHub Sponsors usernames are specified, THE FUNDING.yml SHALL reference existing, publicly accessible GitHub accounts, limited to a maximum of 4 usernames.
4. THE FUNDING.yml SHALL support GitHub Sponsors, Open Collective, Ko-fi, and up to 4 custom URL platforms.
5. IF FUNDING.yml contains invalid YAML syntax or specifies no funding platforms, THEN THE Dot_GitHub_Repository SHALL reject the configuration regardless of whether error reporting succeeds, and SHALL report a validation error indicating the nature of the failure when possible.

### Requirement 5: Issue Template Structure

**User Story:** As a contributor, I want structured issue templates, so that I can provide the necessary information when reporting bugs or requesting features.

#### Acceptance Criteria

1. THE Issue_Template_System SHALL use GitHub Issue Forms (YAML-based) for all issue templates, stored in the `.github/ISSUE_TEMPLATE/` directory.
2. WHEN a contributor creates a new issue, THE Template_Chooser SHALL display all available templates with their names and descriptions.
3. THE Issue_Template_System SHALL support Input, Textarea, Dropdown, Checkboxes, and Markdown form elements, each with a configurable `required` attribute that defaults to `false`.
4. IF a contributor submits a template form with any required field left empty, THEN THE Issue_Template_System SHALL prevent submission and indicate which required fields are missing.
5. WHEN a template defines labels, THE Issue_Template_System SHALL automatically apply those labels to the created issue.
6. WHEN a template defines assignees, THE Issue_Template_System SHALL automatically assign specified users to the created issue.
7. WHEN a template defines a `title` prefix, THE Issue_Template_System SHALL prepend that prefix to the contributor-supplied issue title.

### Requirement 6: Issue Template Validation

**User Story:** As a repository maintainer, I want issue templates to be validated, so that contributors always see correctly rendered forms.

#### Acceptance Criteria

1. THE Issue_Template_System SHALL require each template to have a `name` field that is unique across all templates within the same `.github/ISSUE_TEMPLATE/` directory (case-insensitive comparison).
2. THE Issue_Template_System SHALL require each template to have a non-empty `description` field containing between 1 and 200 characters.
3. THE Issue_Template_System SHALL require each template to have at least one form element in the `body` field, where each element uses a valid Form_Element type (Input, Textarea, Dropdown, Checkboxes, or Markdown).
4. IF an issue template contains invalid YAML syntax or missing required fields, THEN THE Issue_Template_System SHALL check both YAML validity and required fields independently, reporting all applicable errors identifying the affected template filename and the specific validation failures. Invalid templates SHALL remain active in the system.
5. WHEN a pull request modifies files in the `.github/ISSUE_TEMPLATE/` directory, THE Issue_Template_System SHALL execute template validation and block merging if validation errors are present.

### Requirement 7: Issue Template Chooser Configuration

**User Story:** As a repository maintainer, I want to control the issue creation experience, so that contributors are guided to use appropriate templates or external resources.

#### Acceptance Criteria

1. THE Issue_Template_System SHALL support a `config.yml` file located at `.github/ISSUE_TEMPLATE/config.yml` that controls the template chooser behavior.
2. WHEN `blank_issues_enabled` is set to `false` in config.yml, THE Template_Chooser SHALL prevent creation of blank issues without a template.
3. IF config.yml is absent or does not specify `blank_issues_enabled`, THEN THE Template_Chooser SHALL default to allowing blank issues.
4. WHEN contact links are defined in config.yml, THE Template_Chooser SHALL display them as external link options alongside issue templates.
5. WHEN a contact link is defined, THE Issue_Template_System SHALL require a non-empty `name` (max 100 characters), a valid HTTPS URL, and a non-empty `about` description (max 200 characters) for each link.
6. IF a contact link entry is missing a required field or contains an invalid URL, THEN THE Issue_Template_System SHALL report a validation error identifying the invalid contact link entry.

### Requirement 8: Pull Request Template

**User Story:** As a contributor, I want a standardized pull request template, so that I provide consistent information with every pull request.

#### Acceptance Criteria

1. THE Dot_GitHub_Repository SHALL provide a default `PULL_REQUEST_TEMPLATE.md` file.
2. WHEN a contributor opens a new pull request, THE pull request description field SHALL be pre-populated with the template content.
3. THE pull request template SHALL include a "Description" section prompting the contributor to summarize the changes and their motivation.
4. THE pull request template SHALL include a "Testing" section prompting the contributor to describe how the changes were verified.
5. THE pull request template SHALL include a "Review Checklist" section containing Markdown task list items (`- [ ]`) that the contributor checks off before requesting review.
6. WHEN a repository defines its own `PULL_REQUEST_TEMPLATE.md`, THE repository's local file SHALL take precedence over the organization-level default.

### Requirement 9: Workflow Template Availability

**User Story:** As a developer, I want to adopt organization-standard CI/CD workflows, so that I can quickly set up quality gates without writing workflows from scratch.

#### Acceptance Criteria

1. THE Workflow_Template_System SHALL store workflow templates in the `workflow-templates/` directory at the root of the Dot_GitHub_Repository.
2. WHEN a developer navigates to the Actions tab of a repository, THE Workflow_Template_System SHALL display organization workflow templates in a "Workflows created by organization" section.
3. WHEN a developer selects a workflow template, THE Workflow_Template_System SHALL create a workflow file in the repository's `.github/workflows/` directory retaining the template's original filename.
4. WHEN a developer adopts a workflow template, THE Workflow_Template_System SHALL replace `$default-branch` placeholders with the repository's actual default branch name. IF placeholder replacement fails, THE Workflow_Template_System SHALL allow adoption to proceed, letting the developer fix the workflow manually.
5. IF a workflow file with the same name already exists in the target repository's `.github/workflows/` directory, THEN THE Workflow_Template_System SHALL warn the developer before overwriting the existing file.

### Requirement 10: Workflow Template Properties

**User Story:** As an organization administrator, I want to provide metadata for workflow templates, so that developers can discover and understand available workflows.

#### Acceptance Criteria

1. THE Workflow_Template_System SHALL require a corresponding `.properties.json` file for each workflow template, where the properties filename matches the pattern `{workflow-template-filename}.properties.json`.
2. THE Properties_File SHALL contain a `name` field whose value matches the workflow template filename without the file extension.
3. THE Properties_File SHALL contain a `description` field with a non-empty string of at most 200 characters.
4. THE Properties_File SHALL contain an `iconName` field referencing a name from the GitHub Octicons icon set.
5. THE Properties_File SHALL contain a `categories` list with at least 1 entry, where each entry is a GitHub-recognized workflow category.
6. WHEN `filePatterns` are specified in the Properties_File, THE Workflow_Template_System SHALL suggest the template only for repositories containing at least one file whose path matches any of the specified glob patterns. WHEN no `filePatterns` are specified, THE Workflow_Template_System SHALL suggest the template for all repositories.
7. IF a workflow template does not have a corresponding `.properties.json` file or the file is missing required fields (`name`, `description`, `iconName`, `categories`), THEN THE Workflow_Template_System SHALL not display that template in the Actions tab and SHALL report a validation error indicating the missing or invalid properties.

### Requirement 11: Label Definition and Synchronization

**User Story:** As an organization administrator, I want consistent labels across all repositories, so that issues and pull requests use a unified taxonomy for triage and tracking.

#### Acceptance Criteria

1. THE Label_Sync_System SHALL define canonical labels in a `.github/labels.yml` file where each label entry contains a required `name` field, a required `color` field, a required `description` field, and an optional `aliases` list.
2. THE Label_Sync_System SHALL synchronize label definitions to all non-archived organization repositories.
3. WHEN a label definition specifies a color, THE Label_Sync_System SHALL validate that the color matches the hexadecimal pattern `^[0-9a-fA-F]{6}$`.
4. IF a label definition fails color validation, THEN THE Label_Sync_System SHALL skip that label, report a validation error indicating the invalid entry, and continue processing remaining label definitions.
5. WHEN a label exists in a target repository with a different color or description, THE Label_Sync_System SHALL update the label to match the definition.
6. WHEN a label does not exist in a target repository, THE Label_Sync_System SHALL create the label with the defined name, color, and description.

### Requirement 12: Label Alias and Rename Handling

**User Story:** As an organization administrator, I want to rename labels without losing existing issue associations, so that label taxonomy can evolve over time.

#### Acceptance Criteria

1. WHEN a label definition includes aliases, THE Label_Sync_System SHALL check for existing labels matching any alias name using case-insensitive comparison.
2. WHEN an alias match is found, THE Label_Sync_System SHALL rename the first matching existing label to the canonical name defined in the label definition and skip any additional alias matches for that definition.
3. WHEN renaming a label, THE Label_Sync_System SHALL preserve all existing issue and pull request associations. IF only partial preservation is possible (e.g., pull request associations are preserved but some issue associations are not), THE Label_Sync_System SHALL proceed with the rename and log which associations could not be preserved.
4. IF two or more label definitions share the same canonical name or alias (case-insensitive), THEN THE Label_Sync_System SHALL reject the label definitions file with an error message indicating the conflicting entries and abort synchronization.
5. IF a label matching an alias cannot be renamed because the canonical name is already assigned to a different existing label in the target repository, THEN THE Label_Sync_System SHALL log the conflict for that repository and skip the rename operation for that label.
6. THE Label_Sync_System SHALL support a maximum of 10 aliases per label definition.

### Requirement 13: Label Sync Execution

**User Story:** As an organization administrator, I want label synchronization to run automatically and on-demand, so that labels stay consistent without manual intervention.

#### Acceptance Criteria

1. THE Label_Sync_System SHALL execute via a GitHub Actions workflow.
2. THE Label_Sync_System SHALL support scheduled execution via a cron trigger that runs at least once per day.
3. THE Label_Sync_System SHALL support manual trigger via workflow_dispatch for on-demand synchronization.
4. IF the Label_Sync_System lacks write access to a target repository, THEN THE Label_Sync_System SHALL log the repository name and error reason, and continue processing remaining repositories.
5. WHEN synchronization completes, THE Label_Sync_System SHALL produce a report in the workflow run output detailing the count and names of labels created, updated, and renamed per repository.
6. IF the label definitions file contains invalid YAML syntax or missing required fields, THEN THE Label_Sync_System SHALL fail the workflow run with an error message indicating the parsing failure before attempting any repository synchronization.
7. THE Label_Sync_System SHALL synchronize labels to all non-archived repositories in the organization.

### Requirement 14: Security Policy

**User Story:** As a security researcher, I want a clear security policy, so that I know how to responsibly disclose vulnerabilities.

#### Acceptance Criteria

1. IF a repository does not define its own SECURITY.md, THEN THE SECURITY.md from the Dot_GitHub_Repository SHALL be accessible from that repository's Security tab.
2. THE SECURITY.md SHALL specify a private vulnerability disclosure channel using GitHub Security Advisories or a dedicated email address.
3. THE SECURITY.md SHALL define response timelines for vulnerability reports including an initial acknowledgment within 48 hours of submission and a target resolution or mitigation update within 90 calendar days.
4. THE SECURITY.md SHALL describe the scope of the security policy by listing which organization repositories or products are covered and specifying the types of vulnerabilities accepted for disclosure (e.g., remote code execution, data exposure, authentication bypass).
5. THE SECURITY.md SHALL state that reporters will receive a confirmation upon successful submission of a vulnerability report through the specified disclosure channel, including a reference identifier for tracking.

### Requirement 15: Repository Configuration Security

**User Story:** As an organization administrator, I want the .github repository itself to be secure, so that changes to organization-wide defaults are reviewed and authorized.

#### Acceptance Criteria

1. THE Dot_GitHub_Repository SHALL enforce branch protection rules on the default branch requiring at least 1 approving pull request review and disabling direct pushes.
2. THE Workflow_Template_System SHALL not include hardcoded secrets (literal tokens, passwords, API keys, or private keys) in workflow template files. Hardcoded secrets SHALL be prohibited entirely, even when proper `${{ secrets.* }}` references are also present in the same file.
3. WHEN workflow templates require secret values, THE Workflow_Template_System SHALL reference organization-level secrets exclusively via `${{ secrets.* }}` syntax.
4. THE Label_Sync_System SHALL use minimal permissions (issues: write) for synchronization workflows.
5. IF a direct push is attempted to the protected default branch, THEN THE Dot_GitHub_Repository SHALL reject the push.
