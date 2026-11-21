# Implementation Plan: Personal GitHub Profile

## Overview

Curate Massimo Selvi's GitHub profile through Markdown authoring, shell scripts for repo management, showcase repository scaffolding, community health cleanup, and an optional automation workflow. All work is file-based (Markdown, Bash, YAML) with no application code or build tooling.

## Tasks

- [ ] 1. Profile README and community health cleanup
  - [x] 1.1 Write the Profile README (massimoselvi/massimoselvi/README.md)
    - Create `README.md` in `/Volumes/MM4TB/Repos/massimoselvi/massimoselvi/README.md`
    - Include headline section: "Cloud Architect · AWS Serverless · AI-augmented SDLC"
    - Write bio section (max 4 sentences) summarizing professional identity
    - Add tech badges section with shields.io badges for TypeScript, Node.js, PHP, Go, AWS, CDK, Docker
    - Add GitHub stats card SVG via github-readme-stats
    - Add activity graph SVG via github-readme-activity-graph
    - Add featured projects section listing pinned showcase repos with one-line descriptions
    - Add "Current focus" line referencing AI-augmented SDLC at f.technology
    - Add links section with LinkedIn and f.technology URLs
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

  - [ ] 1.2 Clean up the community health repo (massimoselvi/.github)
    - Remove `CONTRIBUTING.md` and `CODEOWNERS` from `/Volumes/MM4TB/Repos/massimoselvi/.github/`
    - Retain `CODE_OF_CONDUCT.md`, `SECURITY.md`, `.github/PULL_REQUEST_TEMPLATE/`, `.github/pull_request_template.md`
    - Stage removals as a single commit with message: `chore: simplify community health files for personal account`
    - _Requirements: 5.1, 5.2, 5.3_

- [ ] 2. Repo metadata and archival scripts
  - [ ] 2.1 Create the repo metadata update script (scripts/update-repo-metadata.sh)
    - Create `/Volumes/MM4TB/Repos/massimoselvi/.github/scripts/update-repo-metadata.sh`
    - Define associative arrays with descriptions and 2-6 topic tags for all 13 public own repos
    - Iterate repos and call `gh repo edit` with `--description` and `--add-topic`
    - Handle per-repo failures with a warning log without halting the script
    - Make the script executable (`chmod +x`)
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 2.2 Create the stale repo archive script (scripts/archive-stale-repos.sh)
    - Create `/Volumes/MM4TB/Repos/massimoselvi/.github/scripts/archive-stale-repos.sh`
    - Target exactly 6 repos: zeit-hello-world, ImmutableModel, laravel-passport, laravel-passport-consumer, lerna-monorepo-starter-kit, multi-auth-laravel
    - Use `gh repo archive` with `--yes` flag for each
    - Log errors to stderr on failure and continue to the next repo
    - Make the script executable (`chmod +x`)
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ] 2.3 Write shell validation tests for metadata script
    - **Property 1: Topic tag count within bounds**
    - Verify each repo entry has between 2 and 6 topic tags
    - **Validates: Requirements 2.2**

- [ ] 3. Checkpoint - Verify scripts and README
  - Ensure Profile README contains all required sections, scripts are syntactically valid (`bash -n`), ask the user if questions arise.

- [ ] 4. Showcase repository scaffolding
  - [ ] 4.1 Create aws-serverless-reference-architecture showcase repo
    - Run `gh repo create massimoselvi/aws-serverless-reference-architecture --public --description "..."`
    - Clone locally and scaffold: README.md (purpose line, CI badge placeholder, TOC, overview), LICENSE (MIT), docs/adr/ with two ADR documents, infrastructure/lib/.gitkeep, infrastructure/bin/.gitkeep, diagrams/architecture.mmd
    - Commit and push initial scaffold
    - _Requirements: 3.1, 3.6_

  - [ ] 4.2 Create ai-augmented-sdlc-playbook showcase repo
    - Run `gh repo create massimoselvi/ai-augmented-sdlc-playbook --public --description "..."`
    - Clone locally and scaffold: README.md (purpose line, CI badge placeholder, TOC), LICENSE (MIT), docs/prompt-patterns/ with two pattern docs, docs/governance/ with two docs, docs/tool-evaluation/evaluation-criteria.md
    - Commit and push initial scaffold
    - _Requirements: 3.2, 3.6_

  - [ ] 4.3 Create laravel-to-serverless-migration showcase repo
    - Run `gh repo create massimoselvi/laravel-to-serverless-migration --public --description "..."`
    - Clone locally and scaffold: README.md (purpose line, CI badge placeholder, TOC), LICENSE (MIT), docs/patterns/ with three migration pattern docs, docs/diagrams/before-after.mmd, infrastructure/examples/.gitkeep
    - Commit and push initial scaffold
    - _Requirements: 3.3, 3.6_

  - [ ] 4.4 Create adr-rfc-templates showcase repo
    - Run `gh repo create massimoselvi/adr-rfc-templates --public --description "..."`
    - Clone locally and scaffold: README.md (purpose line, CI badge placeholder, TOC, process explanation), LICENSE (MIT), templates/adr-template.md, templates/rfc-template.md, examples/ with two ADR examples and one RFC example
    - Commit and push initial scaffold
    - _Requirements: 3.4, 3.6_

  - [ ] 4.5 Validate showcase README structural completeness
    - **Property 2: Showcase README structural completeness**
    - Check each showcase README contains purpose statement, CI badge placeholder, and TOC
    - **Validates: Requirements 3.6**

- [ ] 5. Checkpoint - Verify showcase repos
  - Ensure all 4 showcase repos are created and READMEs follow the required structure, ask the user if questions arise.

- [ ] 6. Profile automation and pinning
  - [ ] 6.1 Create the profile automation workflow
    - Create `/Volumes/MM4TB/Repos/massimoselvi/massimoselvi/.github/workflows/update-profile.yml`
    - Configure cron schedule (daily at 06:00 UTC) and workflow_dispatch trigger
    - Add steps to fetch stats card and activity graph SVGs with `curl -sSf`
    - Add conditional commit step using `git diff --quiet` to commit only when changes detected
    - Ensure failed curl does not overwrite existing files (use `-f` flag)
    - Set `permissions: contents: write`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 6.2 Create a script to pin showcase repos on the profile
    - Create `/Volumes/MM4TB/Repos/massimoselvi/.github/scripts/pin-repos.sh`
    - Document which repos to pin (4-6 repos including at least 3 showcase repos)
    - Note: GitHub pinning is done via the web UI — script outputs instructions
    - _Requirements: 3.5_

- [ ] 7. Final checkpoint - Ensure all deliverables are complete
  - Ensure all tests pass, scripts are valid, all files committed, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All scripts live in `/Volumes/MM4TB/Repos/massimoselvi/.github/scripts/` as one-shot utilities
- The Profile README is at `/Volumes/MM4TB/Repos/massimoselvi/massimoselvi/README.md`
- The automation workflow is at `/Volumes/MM4TB/Repos/massimoselvi/massimoselvi/.github/workflows/update-profile.yml`
- Showcase repos are created via `gh` CLI and scaffolded locally before pushing
- Community health cleanup targets the current workspace (`massimoselvi/.github`)
- Property tests validate script correctness and README structure
- Checkpoints ensure incremental validation

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1", "2.2"] },
    { "id": 1, "tasks": ["2.3", "4.1", "4.2", "4.3", "4.4"] },
    { "id": 2, "tasks": ["4.5", "6.1", "6.2"] }
  ]
}
```
