# Reqit: Implementation Plan

This plan breaks the whole project into small phases. Each phase is meant to take **2 to 5 days** of focused work, ends with something that runs, and has a clear "done when" check. Do the phases in order, since each one builds on the last.

**How to use this file**

- Tick the checkboxes as you finish tasks.
- Do not start a phase until the previous phase's "Done when" is true.
- Commit at the end of every phase and tag the milestones (`v0.1.0`, `v0.2.0`, `v1.0.0`).
- If a phase runs past 5 days, split it into two.

---

## Overview

| Milestone                     | Phases | Result                                                          |
| ----------------------------- | ------ | --------------------------------------------------------------- |
| **Foundation**                | 0-2    | Repo, file format, variables (no UI yet)                        |
| **Engine**                    | 3-4    | Working HTTP engine with timing, tested from code               |
| **App shell**                 | 5-6    | Electron app with layout and typed IPC                          |
| **Core UI**                   | 7-8    | Build a request, send it, see the response                      |
| **Collections**               | 9-12   | Files on disk, sidebar, watcher, environments, secrets, history |
| **MVP release (v0.1.0)**      | 13-14  | cURL import/export, polish, installers, public release          |
| **Power features (v0.2-0.3)** | 15-20  | Postman import, scripts, tests, cookies, snippets, tabs         |
| **Automation**                | 21-22  | CLI runner and collection runner                                |
| **v1.0**                      | 23-26  | OpenAPI, GraphQL, signing, auto-update, docs                    |
| **Differentiator**            | 27     | AI assist or Git panel                                          |

---

# Milestone 1: Foundation

## Phase 0: Repository and tooling setup

**Goal:** an empty but properly configured monorepo with CI.

- [x] Create the GitHub repo with MIT license, `README.md`, and `.gitignore`
- [x] Initialize a pnpm workspace with `packages/core`, `packages/desktop`, `packages/cli`
- [x] Add TypeScript (strict mode) with a shared `tsconfig.base.json`
- [x] Add ESLint, Prettier, and a pre-commit hook (lint-staged + husky)
- [x] Add Vitest to `core`
- [x] Add a GitHub Actions workflow that runs install, lint, and test on push and pull request
- [x] Add `docs/` and `examples/` folders
- [x] Add `CONTRIBUTING.md` and an issue template (can be short for now)

**Done when:** `pnpm install && pnpm lint && pnpm test` passes locally and in CI, with one placeholder test.

---

## Phase 1: Core types and YAML file format

**Goal:** read and write request files with zero-diff round-tripping.

- [ ] Define TypeScript types in `core/src/format/types.ts`: `RequestFile`, `KeyValue`, `Auth`, `Body`, `FolderFile`, `CollectionFile`, `EnvironmentFile`, `SecretsFile`
- [ ] Define a schema (Zod) that mirrors the types, with friendly error messages that include file path and field
- [ ] Implement `parseRequest(text)` using the `yaml` package, preserving comments where possible
- [ ] Implement `serializeRequest(request)` with a **fixed field order**
- [ ] Always quote strings that YAML would misread (values starting with `{`, `[`, `*`, `&`, `!`, `%`, `@`, or a backtick; `yes`/`no`/`on`/`off`; numeric-looking strings)
- [ ] Write multi-line bodies and scripts as `|` block scalars
- [ ] Preserve unknown fields instead of dropping them
- [ ] Implement the same parse/serialize pair for folder, collection, environment, and secrets files
- [ ] Add `version` handling and a `migrate()` function stub (identity for v1)
- [ ] Create a fixtures folder with 15+ sample files: minimal, full, comments, tricky quoting, disabled headers, empty body, unicode, very long scripts, malformed files

**Tests**

- [ ] Round-trip: `serialize(parse(text)) === text` for every canonical fixture
- [ ] Parse then serialize an untouched file produces zero diff
- [ ] Malformed YAML and schema violations return clear errors, not crashes
- [ ] Unknown fields survive a round trip

**Done when:** all fixtures round-trip byte for byte and the test suite is green.

---

## Phase 2: Variable resolution

**Goal:** `{{variable}}` substitution with scopes and good errors.

- [ ] Implement `resolve(template, scopes)` where scopes are ordered: collection, folder, environment, secrets, runtime
- [ ] Higher-priority scopes override lower ones
- [ ] Support variables that reference other variables
- [ ] Detect cycles (`a -> b -> a`) and report the chain
- [ ] Undefined variable throws an error naming the variable, not an empty string
- [ ] Support an escape for literal `{{` (for example `\{{`)
- [ ] Implement `resolveRequest(request, scopes)` that resolves URL, params, headers, auth, and body
- [ ] Implement folder inheritance: merge folder-level headers and auth into requests, with request values winning

**Tests**

- [ ] Scope priority, nested variables, cycles, undefined variables, escapes, inheritance
- [ ] Variables inside JSON bodies and headers

**Done when:** a request with variables across all scopes resolves correctly, and every error case has a test.

---

# Milestone 2: Engine

## Phase 3: Basic HTTP engine

**Goal:** send a request from code and get a structured response.

- [ ] Implement `sendRequest(resolvedRequest, options)` using Node `http`/`https`
- [ ] Methods: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- [ ] Query params appended and encoded correctly, with disabled params skipped
- [ ] Body types: none, JSON (auto `Content-Type`), text, form-urlencoded, multipart (with file fields)
- [ ] Auth: Bearer, Basic, API key (header or query)
- [ ] Redirect handling with a max-redirect limit and a toggle
- [ ] Timeout and cancellation via `AbortController`
- [ ] Gzip, deflate, and brotli decompression
- [ ] TLS options: validate certificates by default, with a per-request opt-out
- [ ] Stream the body to a temp file when it exceeds a size threshold (for example 5 MB), and return the path
- [ ] Return `{ status, statusText, headers, body or bodyPath, sizeBytes, totalMs }`
- [ ] Clear errors for DNS failure, connection refused, timeout, TLS failure, and aborted requests

**Tests** (against a local test server you start in the test setup)

- [ ] Every method, every body type, every auth type
- [ ] Redirects (301, 302, 307, 308), loops, and the limit
- [ ] Timeout, cancel, large body, compressed responses
- [ ] Each error type returns the expected message

**Done when:** a script can send any supported request to the test server and the whole engine test suite passes.

---

## Phase 4: Timing breakdown

**Goal:** show where time went, like browser dev tools.

- [ ] Hook socket events: `lookup` (DNS), `connect` (TCP), `secureConnect` (TLS), first byte of `response`, and `end`
- [ ] Compute `dnsMs`, `tcpMs`, `tlsMs`, `ttfbMs`, `downloadMs`, `totalMs`
- [ ] Handle connection reuse (keep-alive), where DNS, TCP, and TLS are 0
- [ ] Handle plain HTTP (TLS is 0) and IP addresses (DNS is 0)
- [ ] Record redirect hops separately
- [ ] Expose the timing in the response type

**Tests**

- [ ] Use a test server with artificial delays and assert each phase is within tolerance
- [ ] Timing fields are never negative and the phases sum to roughly the total

**Done when:** timing values are sensible against both the local server and a real HTTPS API.

---

# Milestone 3: App shell

## Phase 5: Electron shell and typed IPC

**Goal:** a secure Electron app that can call into `core`.

- [ ] Scaffold `packages/desktop` with electron-vite, React, TypeScript, and Tailwind
- [ ] Enable `contextIsolation`, disable `nodeIntegration`, set a strict Content Security Policy
- [ ] Create the preload script exposing a narrow API through `contextBridge`
- [ ] Define IPC channels as a typed contract shared by main and renderer (one `ipc-types.ts`)
- [ ] Implement first handlers: `request:send`, `request:cancel`, `app:getVersion`
- [ ] Add a temporary button in the renderer that sends a hard-coded GET request and prints the result
- [ ] Add dev tooling: hot reload for renderer, restart for main
- [ ] Add a `desktop` smoke test with Playwright that launches the app

**Done when:** clicking the button sends a real request through main and shows the response in the window.

---

## Phase 6: UI layout and design system

**Goal:** the app's structure, before any real functionality.

- [ ] Layout: left sidebar, main request/response area (resizable split), status bar
- [ ] Light and dark theme with CSS variables, following the system by default
- [ ] Base components: Button, Input, Select, Tabs, Dropdown, Modal, Tooltip, Toast, ContextMenu, KeyValueTable
- [ ] Set up Zustand stores: `appStore`, `collectionStore`, `requestStore`
- [ ] Add a CodeMirror 6 wrapper component with JSON, XML, HTML, and plain text modes
- [ ] Keyboard shortcut system (a single registry, so shortcuts can be listed and rebound later)
- [ ] Persist window size, sidebar width, and theme

**Done when:** the app looks like a real API client shell, with working panel resizing and theme switching.

---

# Milestone 4: Core UI

## Phase 7: Request builder

**Goal:** edit every part of a request in the UI.

- [ ] URL bar with method dropdown and Send button (Ctrl/Cmd+Enter to send)
- [ ] Query params table that stays in sync with the URL (edit either one)
- [ ] Headers table with enable/disable checkboxes, with autocomplete for common header names
- [ ] Body tab with a type selector: none, JSON, text, form-urlencoded, multipart
- [ ] JSON editor with syntax highlighting, bracket matching, and a "Beautify" action
- [ ] Multipart editor with file picker
- [ ] Auth tab: none, Bearer, Basic, API key
- [ ] Highlight `{{variables}}` in inputs (known variables in one color, unknown in another)
- [ ] Unsaved-changes indicator
- [ ] Wire the Send button to the IPC call, with a loading state and a Cancel button

**Done when:** you can build any supported request entirely in the UI and send it.

---

## Phase 8: Response viewer

**Goal:** inspect responses properly.

- [ ] Status badge (colored by class), time, and size in a header strip
- [ ] **Body** tab: Pretty (JSON, XML, HTML), Raw, and Preview (for HTML and images)
- [ ] Syntax highlighting, code folding, and in-body search (Ctrl/Cmd+F)
- [ ] **Headers** tab with a searchable table
- [ ] **Timing** tab with a waterfall bar chart from the Phase 4 data
- [ ] Copy body, save body to file
- [ ] Large-body handling: when the engine returns `bodyPath`, show the first part and a "Load more" or virtualized view, so the UI never freezes
- [ ] Empty, loading, and error states (distinct and helpful)

**Done when:** a 50 MB JSON response opens without freezing, and every tab works.

---

# Milestone 5: Collections

## Phase 9: Collections on disk and sidebar

**Goal:** requests live as files in a folder.

- [ ] `FileService` in main: open a collection folder, scan recursively, parse all request, folder, and collection files
- [ ] "Open Collection" and "New Collection" actions (creates `reqit.yaml`)
- [ ] Sidebar tree built from the folder structure, ordered by `folder.yaml` then alphabetically
- [ ] Actions: new request, new folder, rename, duplicate, delete (to trash), move (drag and drop)
- [ ] Slug generation for filenames, with collision handling (`create-user-2.yaml`)
- [ ] Renaming changes `name` in the file and renames the file separately
- [ ] Save writes through `serializeRequest` (Ctrl/Cmd+S)
- [ ] Drag-and-drop reordering updates `folder.yaml` only
- [ ] Show parse errors per file in the sidebar (red marker) without breaking the rest
- [ ] Remember recent collections and reopen the last one at startup

**Tests**

- [ ] Create, rename, move, and delete leave the folder in a valid state
- [ ] A corrupt file does not stop the collection from loading
- [ ] Saving an untouched request produces no Git diff

**Done when:** you can create a collection, add requests, restart the app, and everything is still there as plain YAML files.

---

## Phase 10: File watcher and live reload

**Goal:** changes made outside the app appear instantly.

- [ ] Watch the collection folder with chokidar, debounced
- [ ] Ignore the app's own writes (track a write token or hash per save)
- [ ] Handle editors that save through temp-file-and-rename
- [ ] Handle bulk changes (`git checkout`, `git pull`) without flicker or crashes
- [ ] Update the sidebar tree incrementally
- [ ] If the open request changed on disk and has no unsaved edits, reload it silently
- [ ] If it has unsaved edits, show a conflict banner with "Keep mine", "Load disk version", and "View diff"
- [ ] Handle a file or folder deleted while open

**Tests**

- [ ] Automated: modify, add, delete, and rename files externally and assert the store updates
- [ ] Automated: the app's own save does not cause a reload loop

**Done when:** running `git checkout other-branch` in a terminal updates the sidebar within a second.

---

## Phase 11: Environments and secrets

**Goal:** switch between dev, staging, and prod safely.

- [ ] Load `environments/*.yaml` and `.reqit/secrets.yaml`
- [ ] Environment selector in the top bar, remembered per collection
- [ ] Environment editor UI (table of variables, add/remove/rename environments)
- [ ] Secrets editor UI, with masked values and a reveal toggle
- [ ] On first run, add `.reqit/secrets.yaml` to the repo's `.gitignore` (create it if missing, with a notice)
- [ ] Warn when a request file contains something that looks like a hardcoded token
- [ ] Autocomplete `{{` in inputs with known variable names
- [ ] Hover over a variable to see its resolved value and which scope it came from
- [ ] Wire the Phase 2 resolver into the Send flow (all scopes)
- [ ] Clear error in the UI when a variable is undefined, linking to "Add variable"

**Done when:** switching the environment changes where a request goes, and secrets never appear in a Git diff.

---

## Phase 12: Request history

**Goal:** find and re-run past requests.

- [ ] SQLite database (better-sqlite3) in the app data directory
- [ ] Store: timestamp, method, resolved URL, status, duration, size, request summary, and response summary
- [ ] Store response bodies up to a size cap, and prune old entries (keep the last N or last 30 days)
- [ ] Never store secret values (store the unresolved request, or mask known secrets)
- [ ] History panel in the sidebar: grouped by day, searchable, filter by status
- [ ] Click an entry to view its saved response, or "Open as new request"
- [ ] Clear history, with a confirmation
- [ ] Settings toggle to disable history entirely

**Done when:** every sent request appears in history, survives a restart, and contains no secrets.

---

# Milestone 6: MVP release (v0.1.0)

## Phase 13: cURL import and export

**Goal:** the fastest way to get requests in and out.

- [ ] cURL parser covering `-X`, `-H`, `-d`/`--data`/`--data-raw`/`--data-binary`, `--data-urlencode`, `-F`, `-u`, `-A`, `-b`, `-L`, `-k`, `--compressed`, `--url`, and multi-line input with `\`
- [ ] Import by pasting into the URL bar, or via an "Import cURL" dialog
- [ ] "Copy as cURL" for the current request, resolved or unresolved (user's choice)
- [ ] Proper shell escaping for bash, with a Windows (cmd/PowerShell) option
- [ ] Detect JSON bodies and set the body type automatically
- [ ] Report anything that could not be converted

**Tests**

- [ ] 30+ real cURL commands (copied from browser dev tools and API docs) import correctly
- [ ] Export then import round-trips

**Done when:** copying a request from Chrome dev tools as cURL and pasting it into the app gives a working request.

---

## Phase 14: MVP polish and first release

**Goal:** ship something people can install.

- [ ] First-run experience: welcome screen with "Open folder", "New collection", and "Open example"
- [ ] A bundled example collection (a public API such as httpbin or a similar test API)
- [ ] App icon, window title showing the collection and environment, native menus
- [ ] Settings screen: theme, font size, timeout default, redirect default, TLS default, proxy, history toggle
- [ ] Proxy support (HTTP/HTTPS proxy, system proxy)
- [ ] Error boundaries and an in-app "Something went wrong" screen with a copy-details button
- [ ] Performance check: startup time, memory, a collection with 500 requests
- [ ] electron-builder config for Windows (`.exe`), macOS (`.dmg`), Linux (`.AppImage`, `.deb`)
- [ ] GitHub Actions release workflow: on version tag, build all three platforms and upload to GitHub Releases
- [ ] README with screenshots or a GIF, install instructions, and a 5-minute quick start
- [ ] `docs/file-format.md` with the full spec from the README
- [ ] `CHANGELOG.md`
- [ ] Manual test pass on all three operating systems (a checklist file in `docs/`)
- [ ] Tag `v0.1.0` and publish the release

**Done when:** a stranger can download the installer from GitHub Releases, open a folder, send a request, and commit the file to Git.

---

# Milestone 7: Power features (v0.2 to v0.3)

## Phase 15: Postman import

- [ ] Parse Postman Collection v2.1 JSON
- [ ] Map folders to directories, requests to files, and folder order to `folder.yaml`
- [ ] Map auth (including inherited auth), headers, params, and body modes (raw, urlencoded, form-data, GraphQL)
- [ ] Parse Postman environments into environment files, and move secret-type values to the secrets file
- [ ] Convert `{{var}}` syntax (already compatible) and flag unsupported dynamic variables (`{{$randomInt}}`)
- [ ] Carry scripts over as comments or as converted code (after Phase 17), noting unconverted `pm.*` calls
- [ ] Import report: a summary of what converted, what was approximated, and what was skipped
- [ ] Test with several real exported collections of different sizes

**Done when:** a real-world Postman collection imports into a working, committable folder with a readable report.

---

## Phase 16: Scripts (pre-request and post-response)

- [ ] Choose the sandbox (Node `vm` in a utility process, or `isolated-vm`) and document the decision
- [ ] Run scripts in a separate process with time and memory limits
- [ ] Expose a small API: `req` (read and modify URL, headers, body), `res` (status, headers, body, json()), `reqit.setVar`, `reqit.getVar`, `reqit.log`
- [ ] Show script console output in a Console tab
- [ ] Script editors in the request builder (Pre and Post tabs)
- [ ] Runtime variables stored in memory and shown in a variables viewer
- [ ] **Workspace trust:** scripts are disabled in a newly opened collection until the user clicks "Trust"
- [ ] Clear error display with line numbers

**Tests**

- [ ] Sandbox escape attempts (`process`, `require`, `import`, `globalThis` tricks) fail
- [ ] Infinite loops and huge allocations are killed cleanly

**Done when:** a post-response script can save a token into a variable that the next request uses, and malicious scripts cannot touch the system.

---

## Phase 17: Tests and assertions

- [ ] Tests section in the request builder: a list of named assertions
- [ ] Run assertions after the post-response script, with `res` available
- [ ] Quick-add helpers: "Status is 200", "Body contains", "JSON path equals", "Response time under N ms", "Header exists"
- [ ] Test results panel with pass/fail and failure messages
- [ ] Pass/fail summary badge in the response header
- [ ] Store tests in the request file under `tests:`

**Done when:** a request with five assertions shows a clear pass/fail list after sending.

---

## Phase 18: Cookies and extra auth

- [ ] Cookie jar per collection (respects domain, path, expiry, Secure, HttpOnly)
- [ ] Cookies tab in the response, and a cookie manager dialog
- [ ] Toggle to disable the jar per request
- [ ] OAuth 2.0 (authorization code with PKCE, client credentials) with token storage in the secrets file
- [ ] Digest auth
- [ ] AWS Signature v4 auth (optional)

**Done when:** a login request sets a session cookie that is sent automatically on the next request.

---

## Phase 19: Code snippet generation

- [ ] Generate snippets from a resolved request for cURL, JavaScript fetch, axios, Python requests, Node http, Go, and Java
- [ ] Snippet panel with a language selector and a copy button
- [ ] Option to keep `{{variables}}` as placeholders or insert resolved values

**Done when:** every snippet runs correctly when pasted into its language (spot-check with real runs).

---

## Phase 20: Tabs, command palette, and quality of life

- [ ] Multiple open requests in tabs, with preview tabs and unsaved indicators
- [ ] Command palette (Ctrl/Cmd+K): open request by name, switch environment, run actions
- [ ] Global search across all requests (name, URL, body)
- [ ] Request docs tab (the `docs:` field, rendered Markdown)
- [ ] Keyboard shortcut list and rebinding
- [ ] Response comparison: pin a response and diff it against the next one
- [ ] Release `v0.2.0` and `v0.3.0` with changelogs

**Done when:** you can work all day in the app without touching the mouse for common actions.

---

# Milestone 8: Automation

## Phase 21: CLI runner

**Goal:** run collections in CI with the same engine as the desktop app.

- [ ] `packages/cli` using the shared `core` package (no Electron)
- [ ] Command: `reqit run <path> --env <name> [--folder <name>] [--secrets <file>]`
- [ ] Environment secrets from environment variables (for CI), for example `REQIT_SECRET_token`
- [ ] Run scripts and tests with the same sandbox rules
- [ ] Reporters: console (default), JSON, JUnit XML
- [ ] Exit code `0` on all passing and `1` on any failure
- [ ] Options: `--bail`, `--timeout`, `--delay`, `--insecure`
- [ ] Publish to npm as `@reqit/cli`
- [ ] Add a sample GitHub Actions workflow in `docs/ci.md`

**Done when:** a GitHub Actions job runs a collection against a test API and fails the build when an assertion fails.

---

## Phase 22: Collection runner (desktop)

- [ ] Run a whole folder or collection in order from the UI
- [ ] Progress view with per-request status, timing, and test results
- [ ] Options: stop on failure, delay between requests, iterations
- [ ] Data-driven runs from a CSV or JSON file (each row becomes variables)
- [ ] Export the run report (JSON or HTML)

**Done when:** you can run a 20-request collection with a CSV of 10 rows and see a full report.

---

# Milestone 9: v1.0

## Phase 23: OpenAPI import

- [ ] Parse OpenAPI 3.x (JSON and YAML) and Swagger 2.0
- [ ] Generate folders from tags and requests from operations
- [ ] Generate example bodies from schemas, and params with example values
- [ ] Map security schemes to auth settings
- [ ] Re-import that updates existing files without overwriting the user's edits (three-way merge or "add new only")
- [ ] Import from file or URL

**Done when:** a real-world spec with 100+ operations generates a clean, readable collection.

---

## Phase 24: GraphQL support

- [ ] GraphQL body type: query editor plus variables editor
- [ ] Schema introspection and autocomplete in the query editor
- [ ] Schema explorer panel
- [ ] Store GraphQL requests in the same YAML format (`body.type: graphql`)
- [ ] cURL export and snippets for GraphQL

**Done when:** you can introspect a public GraphQL API and run queries with autocomplete.

---

## Phase 25: Signing, auto-update, and hardening

- [ ] Windows code signing and macOS signing plus notarization (or document the unsigned install clearly if you cannot afford certificates yet)
- [ ] Auto-update with electron-updater from GitHub Releases, with a user-visible "Update available" prompt
- [ ] Security review: IPC surface, CSP, sandbox, path traversal in file operations, safe handling of untrusted collections
- [ ] Dependency audit and automated updates (Dependabot)
- [ ] Crash reporting (strictly opt-in) or a clear "report a bug" flow with logs
- [ ] Accessibility pass: keyboard navigation, focus states, contrast, screen reader labels on main controls
- [ ] Performance pass: startup time, memory with large collections, large responses

**Done when:** an installed v0.9 updates itself to the next version, and the security checklist is complete.

---

## Phase 26: Documentation site and v1.0 release

- [ ] Documentation site (VitePress or Docusaurus) on GitHub Pages
- [ ] Pages: getting started, file format reference, variables, scripting API, CI guide, importing from Postman, FAQ, comparison with other tools
- [ ] Short demo GIFs or a 2-minute video
- [ ] Landing page with a clear one-line pitch and download buttons
- [ ] Update the README with final screenshots
- [ ] Release checklist: all tests green, manual test pass on three OSes, changelog complete
- [ ] Tag `v1.0.0`, publish the release, and announce (Hacker News "Show HN", Reddit r/webdev and r/programming, dev.to, X, LinkedIn)

**Done when:** `v1.0.0` is public with docs, a landing page, and installers for all platforms.

---

# Milestone 10: Differentiator

## Phase 27: Pick one and build it

### Option A: AI assist

- [ ] Settings for the user's own API key and model (no keys bundled, off by default)
- [ ] "Generate request from description" (for example, "POST a new user with name and email")
- [ ] "Explain this response" for errors (4xx and 5xx), with a suggested fix
- [ ] "Generate tests from this response"
- [ ] "Generate collection from a codebase route file" (read-only, user-selected files)
- [ ] Clear privacy notice showing exactly what is sent, with a preview before sending, and secrets always stripped

### Option B: Built-in Git panel

- [ ] Detect that the collection is inside a Git repository
- [ ] Show changed, added, and deleted request files with status icons in the sidebar
- [ ] Side-by-side diff view for a request (field-aware, not just raw text)
- [ ] Stage, commit, and discard from the UI
- [ ] Show the current branch, with branch switching
- [ ] Show the last author and date for a request (blame summary)

**Done when:** the chosen feature works end to end and is documented, and you ship it as `v1.1.0`.

---

# Cross-Cutting Rules (apply to every phase)

1. **Tests first for format and engine code.** UI code can lean on Playwright tests for key flows.
2. **No phase ends with a broken main branch.** Use short-lived branches and pull requests, even when working alone.
3. **Every format change** needs a fixture, a migration (if breaking), and a docs update.
4. **Keep `core` free of Electron imports.** The CLI depends on it.
5. **Log decisions.** Keep a short `docs/decisions.md` (one paragraph per decision, with date) for choices such as the sandbox, file extension, and script API.
6. **Dogfood from Phase 9.** Use Reqit for your own API testing as soon as it can save a request, since daily use finds bugs faster than tests.
7. **Ship small and often.** A usable v0.1 beats a perfect v1.0 that never releases.

---

# Suggested Timeline

| Weeks | Phases     | Outcome                                      |
| ----- | ---------- | -------------------------------------------- |
| 1     | 0, 1       | Repo, file format with round-trip tests      |
| 2     | 2, 3, 4    | Variables and a full HTTP engine with timing |
| 3     | 5, 6       | Electron shell, IPC, UI foundation           |
| 4     | 7, 8       | Request builder and response viewer          |
| 5     | 9, 10      | Collections on disk, sidebar, live reload    |
| 6     | 11, 12     | Environments, secrets, history               |
| 7     | 13, 14     | cURL, polish, **v0.1.0 release**             |
| 8-9   | 15, 16     | Postman import, scripts                      |
| 10    | 17, 18, 19 | Tests, cookies, OAuth, snippets              |
| 11    | 20         | Tabs, command palette, **v0.3.0**            |
| 12    | 21, 22     | CLI and collection runner                    |
| 13-14 | 23, 24     | OpenAPI and GraphQL                          |
| 15-16 | 25, 26     | Signing, auto-update, docs, **v1.0.0**       |
| 17+   | 27         | Differentiator                               |

If you work part-time, roughly double each range. The order matters more than the pace.
