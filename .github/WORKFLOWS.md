# GitHub Actions Workflows

This repository uses a extra branching strategy:

- `main` is the **default** and **stable/release** branch (tags/releases are created from `main`).  
- `devel` is the **integration/development** branch (day-to-day work and primary PR target)

## Workflows

### (1) PR Check (Monorepo)

**File:** `.github/workflows/pr-check.yml`

**Purpose**

- Validate that both extensions build and package correctly.
- Provide downloadable VSIX artifacts for PR verification.

**Triggers**

- Pull requests targeting `devel` or `main`
- Pushes to `devel`

**What it does**

- `npm ci` at repository root (workspaces)
- Builds both packages:
  - `packages/pb-lang-support` (compile + webpack:prod)
  - `packages/pb-forms-editor` (compile)
- Packages VSIX for both (smoke-test)
- Uploads VSIX artifacts to the workflow run
- Posts/updates a PR status comment (only for PRs from this repo, not forks)

### (2) Build VSIX (for Marketplace Upload)

**File:** `.github/workflows/build-vsix.yml`

**Purpose**

- Produce VSIX artifacts for manual upload/publishing.
- Intended to be run for releases created from `main`.

**Triggers**

- Manual run (`workflow_dispatch`) (optionally building a selected ref)
- Push of version tags:
  - `suite-v*`
  - `pb-lang-support-v*`
  - `pb-forms-editor-v*`

**What it does**

- `npm ci` at repository root (workspaces)
- Builds and packages VSIX for:
  - `pb-lang-support`
  - `pb-forms-editor`
- Uploads VSIX artifacts to the workflow run

## Recommended Release Flow (Option 2)

1. Merge feature work into `devel` (typically via PRs).
2. When ready to release, open a PR from `devel` -> `main` and merge it.
3. On `main`, create and push version tags:
   - `npm run t:all` (suite + both packages)
   - or individually: `npm run t:suite`, `npm run t:lang`, `npm run t:forms`
4. Pushing the tags triggers **Build VSIX** and produces the VSIX artifacts.

## Secrets

- No repository secrets are required for these workflows.
- This repository currently does not include an automated Marketplace publish workflow.

## Important Notes

- Ensure that the version information in package.json is correct
- Test functionality locally before publishing
- Pre-release versions can be tested in pre-release mode first  
- There is currently no automated Marketplace publish workflow in this repository.
  Upload/publish the produced VSIX artifacts manually via the desired release process.
