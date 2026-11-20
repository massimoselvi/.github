# Requirements Document

## Introduction

This feature covers the curation of Massimo Selvi's personal GitHub profile to present a polished, professional brand as a senior cloud architect and engineering manager. The scope includes rewriting the profile README with a rich layout, curating existing public repo metadata, creating new showcase repositories for pinning, archiving stale repos, simplifying the `.github` community health repo, and optionally adding GitHub Actions automation for profile freshness.

## Glossary

- **Profile_README**: The `README.md` file in the `massimoselvi/massimoselvi` repository that renders on the GitHub profile page
- **Showcase_Repo**: A newly created public repository designed to demonstrate expertise in a specific domain, intended for pinning on the profile
- **Community_Health_Repo**: The `massimoselvi/.github` repository containing default community health files applied across all repos in the account
- **Repo_Metadata**: The description field and topic tags associated with a GitHub repository
- **Stale_Repo**: A public repository with no meaningful commits in over 2 years and no active purpose
- **Stats_Card**: A dynamically generated SVG image (via github-readme-stats or similar service) showing GitHub contribution metrics
- **Activity_Graph**: A dynamically generated SVG image showing recent contribution activity over time
- **gh_CLI**: The GitHub CLI tool used to manage repository settings programmatically

## Requirements

### Requirement 1: Profile README Structure

**User Story:** As a visitor to Massimo Selvi's GitHub profile, I want to see a compelling, well-structured README so that I immediately understand his expertise and current focus.

#### Acceptance Criteria

1. THE Profile_README SHALL contain a headline section displaying "Cloud Architect · AWS Serverless · AI-augmented SDLC"
2. THE Profile_README SHALL contain a bio section of no more than 4 sentences summarizing professional identity and experience
3. THE Profile_README SHALL contain a tech badges section displaying icons for TypeScript, Node.js, PHP, Go, AWS, CDK, and Docker
4. THE Profile_README SHALL contain a stats card section with at least one GitHub stats SVG image
5. THE Profile_README SHALL contain an activity graph section with a contribution activity visualization
6. THE Profile_README SHALL contain a featured projects section listing the pinned Showcase_Repos with one-line descriptions
7. THE Profile_README SHALL contain a "Current focus" line referencing AI-augmented SDLC at f.technology
8. THE Profile_README SHALL contain a links section with URLs to LinkedIn and f.technology
9. THE Profile_README SHALL be written entirely in English

### Requirement 2: Repo Metadata Curation

**User Story:** As a recruiter or potential collaborator browsing Massimo's repos, I want each public repo to have a clear description and relevant topic tags so that I can quickly understand what each project does.

#### Acceptance Criteria

1. WHEN a public own repository lacks a description, THE gh_CLI SHALL set a concise description summarizing the repository purpose
2. WHEN a public own repository lacks topic tags, THE gh_CLI SHALL add between 2 and 6 relevant topic tags per repository
3. THE gh_CLI SHALL apply metadata updates to all 13 public own repositories

### Requirement 3: Showcase Repository Creation

**User Story:** As a senior architect, I want dedicated showcase repositories pinned on my profile so that visitors see curated examples of my core competencies.

#### Acceptance Criteria

1. THE Showcase_Repo for AWS Serverless Reference Architecture SHALL contain a README with an architecture diagram, CDK infrastructure code scaffolding, ADR documents, and event-driven design patterns
2. THE Showcase_Repo for AI-Augmented SDLC Playbook SHALL contain documentation covering prompt patterns, governance guidelines, and tool evaluation criteria
3. THE Showcase_Repo for Laravel to Serverless Migration Patterns SHALL contain conceptual migration patterns with IaC examples and architecture diagrams
4. THE Showcase_Repo for ADR/RFC Template Repository SHALL contain opinionated ADR and RFC templates with at least two real-world examples
5. WHEN all Showcase_Repos are created, THE GitHub profile SHALL pin between 4 and 6 repositories including at least 3 Showcase_Repos
6. THE Showcase_Repo SHALL each contain a README with a clear opening line stating the project purpose, a CI badge placeholder, and a structured table of contents

### Requirement 4: Stale Repository Archival

**User Story:** As a profile owner, I want stale public repos archived so that my public repository list reflects active and relevant work only.

#### Acceptance Criteria

1. WHEN a repository is identified as stale, THE gh_CLI SHALL archive the repository using the `gh repo archive` command
2. THE gh_CLI SHALL archive the following repositories: zeit-hello-world, ImmutableModel, laravel-passport, laravel-passport-consumer, lerna-monorepo-starter-kit, multi-auth-laravel
3. IF an archive operation fails, THEN THE gh_CLI SHALL log the error message and continue processing the remaining repositories

### Requirement 5: Community Health Repo Simplification

**User Story:** As a profile owner, I want the `.github` repo to contain only essential community health files so that the repo is lean and relevant to a personal account.

#### Acceptance Criteria

1. THE Community_Health_Repo SHALL retain the following files: profile/README.md, CODE_OF_CONDUCT.md, SECURITY.md, and PULL_REQUEST_TEMPLATE directory
2. THE Community_Health_Repo SHALL remove CONTRIBUTING.md, CODEOWNERS, and any workflow-templates, label sync configurations, issue templates, or TypeScript tooling files
3. WHEN a file is removed from Community_Health_Repo, THE removal SHALL be performed via a single commit with a descriptive message

### Requirement 6: Profile Automation

**User Story:** As a profile owner, I want an optional GitHub Actions workflow that keeps my profile stats and activity graph fresh so that visitors always see up-to-date information.

#### Acceptance Criteria

1. WHERE profile automation is enabled, THE massimoselvi repository SHALL contain a GitHub Actions workflow file that runs on a cron schedule
2. WHERE profile automation is enabled, THE workflow SHALL update the Stats_Card and Activity_Graph images at least once every 24 hours
3. WHERE profile automation is enabled, THE workflow SHALL commit updated content only when changes are detected
4. IF the workflow execution fails, THEN THE workflow SHALL not overwrite existing valid content in the Profile_README
