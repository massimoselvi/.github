# Branch Protection Rules

This document describes the required branch protection rules for the default
branch of this `.github` repository. Because changes here define
organization-wide defaults, every change must be reviewed before it reaches the
default branch.

> **Note:** This file is documentation only. GitHub does **not** read branch
> protection rules from a file in the repository. The rules below must be
> configured through the GitHub UI, the REST API, or the `gh` CLI (see
> [Configuring the rules](#configuring-the-rules)). Keep this document in sync
> with the actual configuration.

## Required rules

The following rules apply to the default branch (typically `main`):

- **Require a pull request before merging.** Direct pushes to the default branch
  are disabled. All changes must go through a pull request.
- **Require at least 1 approving review.** A pull request must receive at least
  one approving review before it can be merged.
- **Dismiss stale approvals on new commits.** When new commits are pushed to a
  pull request, previous approvals are dismissed so the latest changes are
  reviewed.
- **Require conversation resolution before merging.** All review comments must be
  resolved before the pull request can be merged.
- **Apply rules to administrators.** The protections apply to everyone,
  including users with administrative permissions, so the default branch cannot
  be bypassed.

### Expected behavior

- A direct push to the protected default branch is rejected. Contributors must
  open a pull request instead.
- A pull request cannot be merged until it has at least 1 approving review and
  all required conditions are satisfied.

## Configuring the rules

Branch protection is enforced by GitHub, not by this repository. Configure it
using one of the methods below.

### GitHub UI

1. Open the repository on GitHub and go to **Settings → Branches**.
2. Under **Branch protection rules**, select **Add branch ruleset** (or **Add
   rule** for classic branch protection).
3. Set the branch name pattern to the default branch (for example, `main`).
4. Enable the following options:
   - **Require a pull request before merging** and set **Required approvals** to
     at least `1`.
   - **Dismiss stale pull request approvals when new commits are pushed.**
   - **Require conversation resolution before merging.**
   - **Do not allow bypassing the above settings** (apply to administrators).
5. Save the rule.

### GitHub CLI (`gh`)

Replace `OWNER/REPO` with the organization and repository name and `main` with
the default branch if it differs.

```sh
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  /repos/OWNER/REPO/branches/main/protection \
  -f 'required_pull_request_reviews[required_approving_review_count]=1' \
  -F 'required_pull_request_reviews[dismiss_stale_reviews]=true' \
  -F 'enforce_admins=true' \
  -F 'required_conversation_resolution=true' \
  -F 'required_status_checks=null' \
  -F 'restrictions=null'
```

### REST API

The equivalent REST API call targets the branch protection endpoint:

```http
PUT /repos/{owner}/{repo}/branches/{branch}/protection
```

```json
{
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "required_conversation_resolution": true,
  "enforce_admins": true,
  "required_status_checks": null,
  "restrictions": null
}
```

See GitHub's documentation on
[protected branches](https://docs.github.com/en/rest/branches/branch-protection)
and
[managing a branch protection rule](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule)
for the full set of available options.

## Verifying the configuration

To confirm the rules are active, fetch the current protection settings:

```sh
gh api /repos/OWNER/REPO/branches/main/protection
```

Confirm that:

- `required_pull_request_reviews.required_approving_review_count` is at least
  `1`.
- `enforce_admins.enabled` is `true`.
- A direct push to the default branch is rejected (it must go through a pull
  request).
