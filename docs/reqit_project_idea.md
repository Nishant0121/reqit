# Reqit

> A local-first, Git-native desktop API client. Your requests live as plain YAML files in your repo, next to your code.

**Status:** Planning / pre-alpha
**Working name:** Reqit (rename freely)
**Platforms:** Windows, macOS, Linux
**License:** MIT

---

## Table of Contents

1. [The Problem](#1-the-problem)
2. [The Idea](#2-the-idea)
3. [Goals and Non-Goals](#3-goals-and-non-goals)
4. [How It Works (End-to-End Walkthrough)](#4-how-it-works-end-to-end-walkthrough)
5. [Features](#5-features)
6. [File Format Specification](#6-file-format-specification)
7. [Architecture](#7-architecture)
8. [Tech Stack](#8-tech-stack)
9. [Project Structure](#9-project-structure)
10. [Hard Engineering Problems](#10-hard-engineering-problems)
11. [Security Model](#11-security-model)
12. [Testing Strategy](#12-testing-strategy)
13. [Packaging and Releases](#13-packaging-and-releases)
14. [Roadmap](#14-roadmap)
15. [Development Setup](#15-development-setup)
16. [Contributing](#16-contributing)
17. [Open Questions](#17-open-questions)

---

## 1. The Problem

API clients like Postman store your requests in their own database and cloud. That causes real, daily friction:

- **Requests drift away from code.** A developer changes an endpoint in a pull request, but the saved request in the API client is never updated, and nobody notices.
- **Sharing needs accounts.** Teammates must join a workspace, sign in, and sync. Some features sit behind paid plans.
- **No review process.** Changes to saved requests are not reviewed like code, and there is no clean history of who changed what.
- **Heavy and slow.** Many tools have become large, login-gated platforms when all you wanted was to send an HTTP request.

## 2. The Idea

**Store every request as a small YAML file in a normal folder.** The folder structure _is_ the collection. There is no hidden database and no required account.

```
my-project/
├── src/                          <- your application code
├── api/                          <- your Reqit collection
│   ├── reqit.yaml                <- collection settings
│   ├── auth/
│   │   ├── folder.yaml           <- folder settings and request order
│   │   ├── login.yaml
│   │   └── refresh-token.yaml
│   ├── users/
│   │   ├── folder.yaml
│   │   ├── get-user.yaml
│   │   └── create-user.yaml
│   └── environments/
│       ├── dev.yaml
│       └── prod.yaml
├── .reqit/
│   └── secrets.yaml              <- gitignored, never committed
└── package.json
```

Because these are plain text files:

1. A new endpoint and its request file go in **the same pull request**.
2. Teammates get the new request with a plain `git pull`, with no export, import, or account.
3. Reviewers see request changes as normal, readable diffs.
4. Git history shows who changed a request and when, and bad changes can be rolled back.

The app's job is to read and write these files, present them in a fast and pleasant UI, and live-reload when files change on disk (for example after a `git pull` or branch switch).

## 3. Goals and Non-Goals

### Goals

- **Local-first.** Works fully offline, with no account, no telemetry by default, and no cloud.
- **Git-native.** Clean diffs, one request per file, and deterministic serialization.
- **Fast and light.** Opens quickly and stays responsive on large responses.
- **Complete enough for daily use.** Auth, environments, scripts, tests, and imports.
- **Open source** with proper cross-platform releases.

### Non-Goals (for v1)

- Cloud sync or a hosted workspace.
- Team and permission management (Git already handles this).
- Mock servers, API monitoring, or API design tools.
- Mobile apps.

## 4. How It Works (End-to-End Walkthrough)

This is the full life of a request, from opening the app to sharing the result.

1. **Open a collection.** The user picks a folder. The app scans it, parses every `.yaml` request file, and shows a sidebar tree matching the folder structure.
2. **Pick an environment.** The user selects `dev` from a dropdown. The app loads `environments/dev.yaml` and merges in `.reqit/secrets.yaml`.
3. **Edit a request.** The user opens `create-user.yaml` in the request builder: method, URL, params, headers, body, auth, and scripts. Changes are written back to the file (debounced autosave or on Ctrl/Cmd+S).
4. **Send.** The renderer sends an IPC message to the main process. The main process resolves `{{variables}}`, runs the pre-request script, sends the HTTP request, records timing for each phase, and runs the post-response script and tests.
5. **Inspect the response.** The UI shows status, time, size, a pretty-printed body, headers, cookies, a timing breakdown, and test results.
6. **Save history.** The request and response summary are stored in a local history database inside the app's data directory, not in the repo.
7. **Commit and share.** The user runs `git add api/ && git commit`. A teammate pulls, and the file watcher updates their sidebar instantly.
8. **Automate.** The same collection runs in CI using the CLI runner: `reqit run ./api --env staging`.

## 5. Features

### MVP (v0.1)

- Request builder: method, URL, query params, headers
- Body types: JSON, form-urlencoded, multipart form, raw text
- Auth: Bearer, Basic, API key
- Response viewer: status, time, size, pretty JSON/XML/HTML, raw, headers
- Collections as folders and files, with a sidebar tree (create, rename, move, delete, duplicate)
- Environments with `{{variable}}` substitution
- Gitignored secrets file
- Request history
- Import from cURL, and **Copy as cURL**
- File watcher with live reload

### v0.2 to v0.3

- Import from Postman collections and environments
- Pre-request and post-response scripts (sandboxed JavaScript)
- Assertions and test results panel
- Timing breakdown (DNS, TCP, TLS, time to first byte, download)
- Cookie jar
- Code snippet generation (cURL, fetch, axios, Python requests)
- Tabs and a command palette

### v1.0

- CLI runner for CI (`reqit run`)
- OpenAPI import (generate a collection from a spec)
- GraphQL support
- Collection runner (run a folder in order, with data-driven iterations)
- Signed installers and auto-update

### After v1.0 (choose one differentiator)

- **AI assist:** generate requests from a description, explain a failing response, and suggest a fix.
- **Git panel:** a built-in view of changed requests and their diffs.
- WebSocket and Server-Sent Events support.

## 6. File Format Specification

Format: **YAML 1.2**, parsed and written with the `yaml` npm package.

### 6.1 Request file (`*.yaml`)

```yaml
version: 1
name: Create User
method: POST
url: '{{baseUrl}}/users'

params:
  - name: notify
    value: 'true'
    enabled: true

headers:
  - name: Content-Type
    value: application/json
  - name: X-Debug
    value: '1'
    enabled: false

auth:
  type: bearer
  token: '{{token}}'

body:
  type: json
  content: |
    {
      "name": "Nishant",
      "email": "n@example.com"
    }

scripts:
  pre: |
    req.setHeader("X-Request-Time", Date.now());
  post: |
    reqit.setVar("userId", res.body.id);

tests:
  - name: Status is 201
    assert: res.status === 201
  - name: Returns an id
    assert: typeof res.body.id === "string"

docs: |
  Creates a user. Returns the new user's id.
```

**Field rules**

| Field                | Required | Notes                                                                             |
| -------------------- | -------- | --------------------------------------------------------------------------------- |
| `version`            | Yes      | Format version, used for migrations. Starts at `1`.                               |
| `name`               | Yes      | Display name shown in the UI.                                                     |
| `method`             | Yes      | `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`.                       |
| `url`                | Yes      | **Always quoted** so `{{variable}}` is not parsed as a YAML object.               |
| `params` / `headers` | No       | Lists, so order is preserved and entries can be disabled.                         |
| `auth`               | No       | `none`, `bearer`, `basic`, `apikey`.                                              |
| `body`               | No       | `type` is one of `none`, `json`, `text`, `form`, `multipart`.                     |
| `scripts`            | No       | `pre` and `post`, stored as block scalars (`\|`) so code stays readable in diffs. |
| `tests`              | No       | List of named assertions.                                                         |
| `docs`               | No       | Free-text notes in Markdown.                                                      |

### 6.2 Folder file (`folder.yaml`)

Holds ordering and folder-level defaults, so request files never need a `seq` field. Inserting a request changes one small file instead of many.

```yaml
version: 1
name: Users
order:
  - get-user
  - create-user
headers:
  - name: X-Team
    value: backend
auth:
  type: bearer
  token: '{{token}}'
```

Requests not listed in `order` are appended alphabetically. Folder-level headers and auth are inherited by every request below, and can be overridden.

### 6.3 Collection file (`reqit.yaml`)

```yaml
version: 1
name: My Project API
defaults:
  timeoutMs: 30000
  followRedirects: true
  validateSsl: true
```

### 6.4 Environment files (`environments/*.yaml`)

```yaml
version: 1
name: dev
variables:
  baseUrl: 'http://localhost:3000'
  apiVersion: v1
```

### 6.5 Secrets file (`.reqit/secrets.yaml`, gitignored)

```yaml
version: 1
environments:
  dev:
    token: 'eyJhbGciOi...'
  prod:
    token: '...'
```

The app adds `.reqit/secrets.yaml` to `.gitignore` automatically on first run.

### 6.6 Serialization rules (non-negotiable)

1. **One request per file.** Two people editing different requests never conflict.
2. **Deterministic output.** Fields are always written in the same order, with no random IDs or timestamps. Opening and saving an untouched file must produce **zero diff**.
3. **No ordering inside request files.** Order lives in `folder.yaml`.
4. **No secrets in request files.** Only `{{variables}}`.
5. **Filename is a slug, `name` is the display name.** Renaming in the UI changes `name`, and the file is renamed separately, so Git can track the rename.
6. **Quote strings that need it.** The serializer always quotes values starting with `{`, `[`, `*`, `&`, `!`, `%`, `@`, or a backtick, and values like `yes`, `no`, `on`, `off`, or numbers that must stay strings.
7. **Unknown fields are preserved.** A newer file opened in an older app must not lose data.
8. **Format changes go through migrations.** Bump `version` and write an upgrade function.

All file access goes through two functions so the format can be swapped later:

```ts
parseRequest(text: string): RequestFile
serializeRequest(request: RequestFile): string
```

### 6.7 Variable resolution

Scopes, from lowest to highest priority:

1. Collection defaults
2. Folder
3. Environment
4. Secrets
5. Runtime variables (set by scripts)

Syntax is `{{name}}`. An undefined variable produces a clear error that names the variable and the request, and it never silently sends an empty string. Variables can reference other variables (with cycle detection).

## 7. Architecture

```
┌──────────────────────────── Renderer (React) ───────────────────────────┐
│  Sidebar tree · Request builder · Response viewer · History · Settings  │
│  State: Zustand          Editors: CodeMirror 6                          │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │  typed IPC (contextBridge, no Node access)
┌───────────────────────────────┴─────────────────────────────────────────┐
│                          Main process (Node)                            │
│                                                                         │
│  FileService       read/write/rename/move files, parse + serialize      │
│  Watcher           chokidar, debounced, emits change events             │
│  VariableResolver  scopes, interpolation, cycle detection               │
│  RequestEngine     builds and sends HTTP, records timing, handles auth   │
│  ScriptRunner      sandboxed pre/post scripts and test assertions        │
│  HistoryStore      SQLite (better-sqlite3) in the app data directory     │
│  Importers         cURL, Postman, OpenAPI                                │
│  Exporters         cURL, code snippets                                   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                 ┌──────────────┴───────────────┐
                 │   Disk: collection folder    │   Network: target APIs
                 └──────────────────────────────┘
```

**Why requests go through the main process:** the renderer is a browser environment and would hit CORS restrictions. The main process is Node, so it can send any request with full control over headers, TLS, redirects, and timing.

**Shared core package:** parsing, serialization, variable resolution, and the request engine live in a separate `core` package with no Electron dependency. The desktop app and the CLI runner both use it, so behavior is identical in both.

### Main data types

```ts
type RequestFile = {
  version: number;
  name: string;
  method: HttpMethod;
  url: string;
  params?: KeyValue[];
  headers?: KeyValue[];
  auth?: Auth;
  body?: Body;
  scripts?: { pre?: string; post?: string };
  tests?: { name: string; assert: string }[];
  docs?: string;
};

type KeyValue = { name: string; value: string; enabled?: boolean };

type ResponseResult = {
  status: number;
  statusText: string;
  headers: KeyValue[];
  bodyPath: string; // large bodies are streamed to a temp file
  sizeBytes: number;
  timing: {
    dnsMs: number;
    tcpMs: number;
    tlsMs: number;
    ttfbMs: number;
    downloadMs: number;
    totalMs: number;
  };
  testResults: { name: string; passed: boolean; error?: string }[];
};
```

## 8. Tech Stack

| Area           | Choice                                               | Why                                             |
| -------------- | ---------------------------------------------------- | ----------------------------------------------- |
| Shell          | Electron                                             | Mature, JavaScript everywhere, easy packaging   |
| Language       | TypeScript (strict)                                  | Safer refactors, shared types across processes  |
| UI             | React + Tailwind CSS                                 | Familiar and fast to build with                 |
| State          | Zustand                                              | Small and simple                                |
| Editors        | CodeMirror 6                                         | Light, extensible, good for large documents     |
| Build          | Vite + electron-vite                                 | Fast dev loop                                   |
| YAML           | `yaml` package                                       | Preserves comments, YAML 1.2                    |
| HTTP           | Node `http`/`https` (or `undici`)                    | Gives low-level events for the timing breakdown |
| File watching  | chokidar                                             | Reliable across platforms                       |
| History        | SQLite via better-sqlite3                            | Fast, local, no server                          |
| Script sandbox | Node `vm` inside a utility process, or `isolated-vm` | Isolation from the app                          |
| Tests          | Vitest, Playwright                                   | Unit and end-to-end                             |
| Packaging      | electron-builder                                     | Installers and auto-update                      |
| CI             | GitHub Actions                                       | Build and release on all three platforms        |
| Monorepo       | pnpm workspaces                                      | `core`, `desktop`, `cli` packages               |

**Alternative:** Tauri (Rust backend) gives smaller installers and lower memory use, at the cost of learning Rust and rewriting the engine in it. Electron is the pragmatic choice for v1.

## 9. Project Structure

```
reqit/
├── packages/
│   ├── core/                     <- no Electron dependency
│   │   ├── src/
│   │   │   ├── format/           <- parse, serialize, migrations, schema
│   │   │   ├── variables/        <- scopes and interpolation
│   │   │   ├── engine/           <- HTTP sending, auth, timing
│   │   │   ├── scripts/          <- sandbox and test runner
│   │   │   ├── importers/        <- curl, postman, openapi
│   │   │   └── exporters/        <- curl, snippets
│   │   └── tests/
│   ├── desktop/
│   │   ├── src/main/             <- Electron main process, IPC handlers
│   │   ├── src/preload/          <- contextBridge API
│   │   └── src/renderer/         <- React app
│   └── cli/                      <- `reqit run`
├── docs/                         <- format spec, architecture, user guide
├── examples/                     <- sample collections
├── .github/workflows/            <- CI and release pipelines
├── README.md
└── LICENSE
```

## 10. Hard Engineering Problems

These are what make the project more than a UI exercise.

1. **Request engine with timing breakdown.** Use socket-level events (`lookup`, `connect`, `secureConnect`, `response`, `end`) to measure DNS, TCP, TLS, time to first byte, and download time separately, as browser dev tools do.
2. **Deterministic serialization.** Round-tripping a file (parse, then serialize) must reproduce it byte for byte. Test this with a large set of fixture files, including comments, odd quoting, and multi-line scripts.
3. **File watching without loops.** When the app saves a file, the watcher fires. The app must ignore its own writes, handle editors that write via temp-file-and-rename, and handle many changes at once after `git checkout`.
4. **Script sandbox.** User scripts must not read the filesystem, spawn processes, or access app internals. They get only a small API (`req`, `res`, `reqit.setVar`) plus time and memory limits.
5. **Large responses.** A 50 MB JSON body must not freeze the UI. Stream it to disk, render with a virtualized viewer, and offer lazy tree expansion and search.
6. **Variable resolution.** Scopes, nesting, cycle detection, and good error messages.
7. **Importer fidelity.** Postman collections contain many edge cases (nested folders, inherited auth, scripts that use `pm.*`). Map what is possible, and clearly report what could not be converted.
8. **Cross-platform packaging.** Code signing, notarization on macOS, auto-update, and path differences between Windows and Unix.

## 11. Security Model

- **Context isolation on, Node integration off** in the renderer. The renderer talks to the main process only through a narrow, typed `contextBridge` API.
- **Scripts run in a sandbox** with a time limit, memory limit, and no filesystem or network access except through the provided API.
- **Secrets stay out of Git.** The secrets file is gitignored automatically, and the UI warns if a value that looks like a token is typed directly into a request file.
- **Secrets are masked** in the UI by default, and excluded from history unless the user opts in.
- **No telemetry by default.** If crash reporting is ever added, it is opt-in.
- **Untrusted collections.** Opening a collection from someone else could run their scripts. Scripts are disabled until the user clicks "Trust this collection" (similar to VS Code's workspace trust).
- **TLS verification on by default,** with a clear per-request toggle to disable it.

## 12. Testing Strategy

| Layer     | Tool                       | What it covers                                               |
| --------- | -------------------------- | ------------------------------------------------------------ |
| Format    | Vitest                     | Round-trip tests, fixtures, migration tests, malformed input |
| Variables | Vitest                     | Scopes, nesting, cycles, undefined variables                 |
| Engine    | Vitest + local test server | Methods, bodies, auth, redirects, timeouts, timing values    |
| Importers | Vitest                     | Real exported Postman and cURL samples                       |
| Scripts   | Vitest                     | Sandbox escape attempts, infinite loops, memory abuse        |
| UI        | Playwright (Electron)      | Open collection, edit, send, see response, git-pull reload   |
| CLI       | Vitest                     | Exit codes and output for passing and failing collections    |

**Rule:** any bug in the file format gets a regression fixture before it is fixed.

## 13. Packaging and Releases

- Build installers with electron-builder: `.exe` (Windows), `.dmg` (macOS), `.AppImage` and `.deb` (Linux).
- GitHub Actions builds on all three operating systems for each version tag and attaches the installers to a GitHub Release.
- Sign the Windows and macOS builds when possible, since unsigned apps trigger scary warnings.
- Auto-update via electron-updater, pointed at GitHub Releases.
- Follow semantic versioning, with a `CHANGELOG.md` for every release.
- Publish the CLI to npm as `@reqit/cli`.

## 14. Roadmap

| Phase                 | Timeframe   | Deliverable                                                                             |
| --------------------- | ----------- | --------------------------------------------------------------------------------------- |
| **0. Setup**          | Week 0      | Monorepo, TypeScript, lint, CI, empty Electron window                                   |
| **1. Engine**         | Weeks 1-2   | Request engine in `core`, response viewer, basic request builder                        |
| **2. Files**          | Weeks 3-4   | YAML format, collections on disk, sidebar, environments, secrets, history, file watcher |
| **3. MVP release**    | Weeks 5-6   | cURL import and export, packaging, README, **v0.1.0 public release**                    |
| **4. Power features** | Weeks 7-10  | Postman import, scripts and tests, timing breakdown, cookies, snippets                  |
| **5. Automation**     | Weeks 11-12 | CLI runner, CI example, collection runner                                               |
| **6. v1.0**           | Weeks 13-16 | OpenAPI import, GraphQL, signed installers, auto-update, docs site                      |
| **7. Differentiator** | After v1.0  | AI assist or built-in Git panel                                                         |

**Definition of done for v0.1:** a developer can open a folder, send a request with a variable, see the response, commit the request file, and have a teammate pull it and send it, with no account anywhere.

## 15. Development Setup

> These commands describe the intended setup once the repo is scaffolded.

```bash
# Requirements: Node 20+, pnpm 9+, Git
git clone https://github.com/<your-username>/reqit.git
cd reqit
pnpm install

# Run the desktop app in development
pnpm --filter desktop dev

# Run all tests
pnpm test

# Build installers for your OS
pnpm --filter desktop build
```

## 16. Contributing

Contributions are welcome once v0.1 is released.

1. Open an issue before starting large changes.
2. Fork, branch from `main`, and keep each pull request focused.
3. Add or update tests. Format changes require a fixture.
4. Run `pnpm lint && pnpm test` before pushing.
5. Use Conventional Commits (`feat:`, `fix:`, `docs:`).

## 17. Open Questions

Decisions to make during development:

- **Final name** and a check that the name, domain, and npm scope are available.
- **Script API shape:** should it be Postman-compatible (`pm.*`) to make imports easier, or its own cleaner API?
- **Sandbox technology:** Node `vm` is simple but weaker. `isolated-vm` is stronger but has native build complexity.
- **Request file extension:** plain `.yaml`, or `.req.yaml` so the app can recognize its own files in a mixed folder?
- **Large body storage in history:** how much to keep, and for how long?
- **Differentiator after v1.0:** AI assist or the built-in Git panel.

---

_Built as a real, daily-use tool first. Everything else follows from that._
