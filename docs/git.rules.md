# Reqit Git & Branching Rules

For a desktop & CLI application like **Reqit** (which publishes installable binaries via GitHub Releases and tags), the most effective and clean branching model is a **Release-Tagged Trunk-Based Workflow** (enhanced GitHub Flow).

---

## ⚠️ Automation & Assistant Policy: No Auto-Commits

> [!IMPORTANT]
> **Do not commit anything automatically.**  
> AI assistants, scripts, and tooling must **NEVER** run `git commit` directly.
>
> - Always provide the exact `git add` and `git commit` commands for the user to review and execute manually in their terminal.
> - Ensure all suggested commit messages adhere to Conventional Commits format (e.g. `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).

---

## 1. Long-Lived Branches

| Branch                     | Purpose                                                                                                     | Rules & Best Practices                                                                                                                                                                                                                                      |
| :------------------------- | :---------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`main`** _(or `master`)_ | **Production Source of Truth**<br>Contains code that is stable, fully tested, and releasable at any moment. | • **Never push directly to `main`**.<br>• Every commit must pass all CI checks (`lint`, `test`, `typecheck`).<br>• Releases are created by tagging commits here (e.g., `v0.1.0`, `v0.2.0`).                                                                 |
| **`develop`** _(Optional)_ | **Integration branch for upcoming milestones**                                                              | _Recommended only if multiple developers are merging distinct features simultaneously before bundling them into a major milestone release (e.g., preparing v0.2.0)._ For solo/small teams, branching directly off `main` is simpler and avoids merge drift. |

---

## 2. Short-Lived Branches (Feature & Fix Branches)

Create these branches off `main`, do your work, open a Pull Request (or merge), and **delete the branch** once merged.

Use standard prefix conventions:

### `feat/` — New Features or Enhancements

Use for implementing roadmap milestones from your implementation plan:

- `feat/postman-import` (Phase 15: Postman collection import)
- `feat/pre-request-scripts` (Phase 16: Scripting sandbox)
- `feat/oauth2-support` (Phase 18: OAuth2 authorization flow)
- `feat/command-palette` (Phase 20: Quick switcher & shortcuts)

### `fix/` — Bug Fixes

Use when fixing unexpected behavior or UI issues:

- `fix/curl-multiline-escape`
- `fix/sidebar-scrolling-stutter`
- `fix/history-json-truncation`

### `chore/` — Tooling, Maintenance, & Housekeeping

Use for dependency upgrades, CI workflows, and refactoring configs:

- `chore/clean-docs-tracking`
- `chore/upgrade-electron`
- `chore/update-pnpm-lock`

### `test/` — Adding or Improving Test Suites

Use when writing new integration tests, benchmarks, or smoke tests:

- `test/watcher-concurrency`
- `test/benchmark-1000-requests`

---

## 3. Release & Maintenance Branches (When Needed)

As the project gains users, you will occasionally need:

- **`hotfix/v0.1.1`**:
  - **When to use:** A critical crash is reported in `v0.1.0` while you are halfway through developing a large feature.
  - **How it works:** Branch directly from tag `v0.1.0`, patch the bug, test, tag `v0.1.1`, and merge back into `main`.
- **`release/v0.2.0`**:
  - **When to use:** When preparing a major version cut. Used to freeze feature development, bump versions in `package.json`, update `CHANGELOG.md`, and run final smoke tests before tagging.

---

## 4. Summary: The Golden Rules for Reqit

1. **Never auto-commit:** Provide `git add` and `git commit` commands for manual execution.
2. **Keep `main` Green:** Always ensure `pnpm typecheck && pnpm test` pass before merging into `main`.
3. **Releases are Tags, Not Branches:** Do not create branches called `v0.1.0` or `v0.2.0`. Create git tags (`git tag -a v0.1.0 -m "Release v0.1.0"`). The release workflow in `.github/workflows/release.yml` automatically triggers on tags matching `v*`.
4. **Delete Merged Branches:** Keep your remote clean by deleting feature branches on GitHub once merged (`git branch -d feat/...` and delete on GitHub).
5. **Rename `master` to `main` (Optional but Industry Standard):**
   ```bash
   git branch -m master main
   git push -u origin main
   # Then set 'main' as default branch in GitHub Repo Settings -> Branches
   ```
