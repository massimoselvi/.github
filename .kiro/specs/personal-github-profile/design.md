# Design Document

## Overview

This design covers the technical approach for curating Massimo Selvi's personal GitHub profile. The work spans multiple repositories and involves Markdown authoring, shell scripting with `gh` CLI, repository scaffolding, and a simple GitHub Actions workflow. There is no application code or complex build tooling — the deliverables are static files, scripts, and YAML configurations.

## Architecture

The feature touches four distinct areas, each isolated from the others:

```
massimoselvi/massimoselvi     ← Profile README + optional automation workflow
massimoselvi/.github          ← Community health files (cleanup)
massimoselvi/showcase-repos   ← 4 new public repos (scaffolded)
scripts/                      ← One-shot shell scripts for metadata + archival
```

There is no runtime service. All operations are either file edits committed to git, or one-shot `gh` CLI commands run locally.

## Components

### 1. Profile README (massimoselvi/massimoselvi/README.md)

A single Markdown file with the following sections in order:

| Section | Content | Tooling |
|---------|---------|---------|
| Header | Headline text + short bio | Plain Markdown |
| Tech Badges | shields.io badge images | `![badge](https://img.shields.io/badge/...)` |
| Stats Card | GitHub stats SVG | `![stats](https://github-readme-stats.vercel.app/api?username=massimoselvi&...)` |
| Activity Graph | Contribution graph | `![graph](https://github-readme-activity-graph.vercel.app/graph?username=massimoselvi&...)` |
| Featured Projects | Table or list of pinned repos | Markdown links + one-line descriptions |
| Current Focus | Single line | Plain text |
| Links | LinkedIn, f.technology | Markdown links |

The README is hand-authored once and updated manually or via the optional automation workflow.

### 2. Repo Metadata Script (scripts/update-repo-metadata.sh)

A Bash script that iterates over a declared list of repositories and applies descriptions and topic tags using `gh` CLI.

```bash
#!/usr/bin/env bash
set -euo pipefail

# Repository metadata configuration
declare -A REPO_DESCRIPTIONS=(
  ["aws-lambda-golang-todo-app"]="Serverless TODO API built with Go, AWS Lambda, and DynamoDB"
  ["serverless-todo-api-go"]="Minimal Go serverless REST API with AWS SAM"
  # ... all 13 public own repos
)

declare -A REPO_TOPICS=(
  ["aws-lambda-golang-todo-app"]="aws,lambda,golang,serverless,dynamodb"
  ["serverless-todo-api-go"]="aws,serverless,golang,sam"
  # ... 2-6 topics per repo
)

for repo in "${!REPO_DESCRIPTIONS[@]}"; do
  echo "Updating: massimoselvi/$repo"
  gh repo edit "massimoselvi/$repo" \
    --description "${REPO_DESCRIPTIONS[$repo]}" \
    --add-topic "${REPO_TOPICS[$repo]}" || echo "WARN: Failed to update $repo"
done
```

Key design decisions:
- Associative arrays keep config and logic in one file
- `set -euo pipefail` with per-command `|| echo` allows partial failures without halting
- Topics are comma-separated strings passed to `--add-topic`

### 3. Archive Script (scripts/archive-stale-repos.sh)

A simple Bash script targeting the 6 identified stale repositories:

```bash
#!/usr/bin/env bash
set -uo pipefail

STALE_REPOS=(
  "zeit-hello-world"
  "ImmutableModel"
  "laravel-passport"
  "laravel-passport-consumer"
  "lerna-monorepo-starter-kit"
  "multi-auth-laravel"
)

for repo in "${STALE_REPOS[@]}"; do
  echo "Archiving: massimoselvi/$repo"
  if ! gh repo archive "massimoselvi/$repo" --yes 2>&1; then
    echo "ERROR: Failed to archive $repo" >&2
  fi
done
```

Key design decisions:
- Uses `--yes` flag to skip interactive confirmation
- Captures stderr on failure, logs it, and continues to the next repo
- No `set -e` at the top so individual failures don't abort the loop

### 4. Showcase Repository Scaffolding

Each showcase repo is created with `gh repo create` and then populated with a minimal file structure. No full implementation — just README, LICENSE, and directory stubs.

#### 4a. aws-serverless-reference-architecture

```
README.md              ← Purpose, architecture diagram (Mermaid), TOC, CI badge placeholder
LICENSE                ← MIT
docs/
  adr/
    001-event-driven-design.md
    002-cdk-over-cloudformation.md
infrastructure/
  lib/
    .gitkeep           ← CDK scaffold placeholder
  bin/
    .gitkeep
diagrams/
  architecture.mmd     ← Mermaid source for architecture diagram
```

#### 4b. ai-augmented-sdlc-playbook

```
README.md              ← Purpose, TOC, CI badge placeholder
LICENSE                ← MIT
docs/
  prompt-patterns/
    code-review.md
    architecture-decision.md
  governance/
    adoption-guidelines.md
    risk-assessment.md
  tool-evaluation/
    evaluation-criteria.md
```

#### 4c. laravel-to-serverless-migration

```
README.md              ← Purpose, TOC, CI badge placeholder
LICENSE                ← MIT
docs/
  patterns/
    monolith-to-lambda.md
    queue-to-sqs.md
    scheduled-tasks-to-eventbridge.md
  diagrams/
    before-after.mmd
infrastructure/
  examples/
    .gitkeep           ← IaC example placeholder
```

#### 4d. adr-rfc-templates

```
README.md              ← Purpose, TOC, CI badge placeholder, explanation of process
LICENSE                ← MIT
templates/
  adr-template.md
  rfc-template.md
examples/
  adr-001-use-event-driven-architecture.md
  adr-002-adopt-cdk-for-infrastructure.md
  rfc-001-api-versioning-strategy.md
```

Each showcase repo README follows this structure:
1. One-line purpose statement (first line after title)
2. CI badge placeholder: `<!-- CI badge: add after setting up GitHub Actions -->`
3. Table of contents
4. Overview section
5. Getting Started / Usage section (placeholder)

### 5. Community Health Repo Cleanup

Files to remove from `massimoselvi/.github`:
- `CONTRIBUTING.md`
- `CODEOWNERS`
- Any `workflow-templates/` directory (none exists currently)
- Any label sync or issue template files (none exist currently)

Files to retain:
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`
- `.github/PULL_REQUEST_TEMPLATE/` directory and contents
- `.github/pull_request_template.md`

A `profile/README.md` will be added if it doesn't exist (this is the org-level profile README — for a personal account, this isn't rendered but is harmless to keep).

The cleanup is performed as a single git commit with message: `chore: simplify community health files for personal account`.

### 6. Profile Automation Workflow (optional)

Located at `massimoselvi/massimoselvi/.github/workflows/update-profile.yml`:

```yaml
name: Update Profile Stats

on:
  schedule:
    - cron: '0 6 * * *'  # Daily at 06:00 UTC
  workflow_dispatch:       # Manual trigger

permissions:
  contents: write

jobs:
  update-stats:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Update stats card
        run: |
          # Fetch fresh stats card SVG
          curl -sSf -o stats-card.svg \
            "https://github-readme-stats.vercel.app/api?username=massimoselvi&show_icons=true&theme=default"

      - name: Update activity graph
        run: |
          curl -sSf -o activity-graph.svg \
            "https://github-readme-activity-graph.vercel.app/graph?username=massimoselvi&theme=github-light"

      - name: Commit if changed
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          if git diff --quiet; then
            echo "No changes detected"
          else
            git add .
            git commit -m "chore: update profile stats [skip ci]"
            git push
          fi
```

Key design decisions:
- `curl -sSf` fails silently on HTTP errors (`-f`) but doesn't produce output on success (`-sS`), so a failed fetch won't overwrite existing files with error HTML
- `git diff --quiet` ensures no commit when nothing changed
- `workflow_dispatch` allows manual trigger for testing
- Runs daily at 06:00 UTC — well within the "at least every 24 hours" requirement

## Data Models

No runtime data models. All state is stored as:
- Markdown files in git repositories
- Repository metadata (descriptions, topics) in GitHub's API
- Archive status as a GitHub repo flag

### Repo Metadata Configuration

The metadata script uses inline associative arrays. Each entry:

```
repo_name → (description: string, topics: string[2..6])
```

Constraints:
- Description: non-empty string, under 350 characters (GitHub limit)
- Topics: 2-6 lowercase, hyphenated strings matching GitHub topic format (`[a-z0-9-]+`, max 50 chars each)

## Error Handling

| Scenario | Handling |
|----------|----------|
| `gh repo edit` fails for one repo | Log warning, continue to next repo |
| `gh repo archive` fails | Log error to stderr, continue to next repo |
| Stats card URL unreachable | `curl -f` exits non-zero, file not overwritten, workflow step fails but existing README unchanged |
| Activity graph URL unreachable | Same as above |
| Git push fails in workflow | Workflow fails, existing committed content remains |
| Showcase repo already exists | `gh repo create` will fail; script should check existence first |

## Interfaces

No APIs or service interfaces. All interactions are:
- **Human → Script**: Run shell scripts locally (`bash scripts/update-repo-metadata.sh`)
- **GitHub Actions → GitHub API**: Automated via workflow YAML
- **Human → Git**: Commit and push Markdown files

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Topic tag count within bounds

*For any* repository entry in the metadata configuration, the number of assigned topic tags SHALL be between 2 and 6 inclusive.

**Validates: Requirements 2.2**

### Property 2: Showcase README structural completeness

*For any* showcase repository, its README SHALL contain a one-line purpose statement as the first content after the title, a CI badge placeholder comment, and a table of contents section.

**Validates: Requirements 3.6**

## Testing Strategy

Given the nature of this feature (Markdown files, shell scripts, YAML configs), the testing approach is lightweight:

**Property tests (shell-based):**
- Parse the metadata config and verify tag counts per repo (Property 1)
- Scan each showcase README for required structural elements (Property 2)

**Example-based tests (manual or scripted checks):**
- Verify Profile README contains all required sections (Req 1.1-1.8)
- Verify archive script targets exactly 6 specific repos (Req 4.2)
- Verify cleanup commit removes correct files and retains others (Req 5.1, 5.2)
- Verify workflow YAML has cron schedule and conditional commit logic (Req 6.1-6.3)

**Edge case tests:**
- Simulate `gh repo archive` failure and verify script continues (Req 4.3)
- Simulate curl failure in workflow and verify README not corrupted (Req 6.4)

**Integration tests (manual, run once):**
- Execute metadata script against real repos and verify on GitHub
- Execute archive script and verify repos are archived
- Trigger workflow manually and verify commit behavior
