# Back-merge: main -> devel (Hotfix Sync)

This repo uses special branching:

- `main` = default + stable/release
- `devel` = integration/development

After a hotfix is merged into `main`, perform a **back-merge** so the fix is also present in `devel`.

## Recommended: helper script

Run from repo root:

```bash
node scripts/backmerge-main-into-devel.mjs
```

### What it does

- Updates `main` and `devel`
- Creates/resets `backmerge/main-into-devel` from `devel`
- Merges `main` into that branch
- Pushes the branch and prints PR instructions

### If conflicts occur

Resolve conflicts manually, then:

```bash
git add -A
git commit
git push -u origin backmerge/main-into-devel
```

Then create a PR:

- **base:** `devel`
- **compare:** `backmerge/main-into-devel`

## Manual steps (without script)

1. Update `main`

    ```bash
    git checkout main
    git pull
    ```

2. Update `devel` + create backmerge branch

    ```bash
    git checkout devel
    git pull
    git checkout -b backmerge/main-into-devel
    ```

3. Merge `main` into the backmerge branch

    ```bash
    git merge main
    ```

    If conflicts occur:

    ```bash
    git add -A
    git commit
    ```

4. Push and create PR

    ```bash
    git push -u origin backmerge/main-into-devel
    ```

    PR:

    - **base:** `devel`

    - **compare:** `backmerge/main-into-devel`

5. After merge (optional)

    - Delete `backmerge/main-into-devel` in GitHub UI.
