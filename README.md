# Reqit

> A local-first, Git-native desktop API client. Your requests live as plain YAML files in your repository, next to your code.

[![CI](https://github.com/Nishant0121/reqit/actions/workflows/ci.yml/badge.svg)](https://github.com/Nishant0121/reqit/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/badge/docs-GitHub%20Pages-blue.svg)](https://nishant0121.github.io/reqit/)
[![Release](https://img.shields.io/badge/release-v1.0.0-emerald.svg)](https://github.com/Nishant0121/reqit/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Why Reqit?

Most API clients store your requests in their own cloud or proprietary databases. That creates friction:

- **Requests drift away from code:** APIs change in pull requests, but collections are stored elsewhere.
- **Sharing requires proprietary accounts:** Team members need logins and workspace invites.
- **No code review for requests:** Changes to requests bypass your normal Git PR review process.
- **Heavy and bloated:** Modern API clients have grown into complex platforms when you just need a fast, reliable tool.

**Reqit solves this by storing collections as human-readable YAML files directly on disk.**

```text
my-project/
├── src/                          <- Your application code
├── api/                          <- Your Reqit collection
│   ├── reqit.yaml                <- Collection settings
│   ├── auth/
│   │   ├── folder.yaml           <- Folder settings and order
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
│   └── secrets.yaml              <- Gitignored, never committed
└── package.json
```

---

## Key Features

- **Local-First & Committable**: Every request, folder, and environment is a deterministic `.yaml` file. Check it into Git and review API changes alongside code.
- **Fast HTTP Engine**: Built on Node.js native networking with sub-millisecond timing breakdown (DNS, TCP, TLS, TTFB, transfer).
- **Live File Watcher**: Seamlessly picks up external changes (e.g. `git checkout` or editing in VS Code). Automatic conflict detection with built-in diff viewer.
- **Hierarchical Variables & Secrets**: Transparent `{{variable}}` substitution across Collection, Folder, Environment, Secrets, and Runtime scopes. Secrets are automatically kept out of Git.
- **cURL Integration**: Paste raw cURL commands directly into the URL bar to import requests instantly. Export requests to Bash, Windows PowerShell, or CMD format.
- **Local Request History**: SQLite-backed history with Write-Ahead Logging (WAL), credential masking, and real-time search.
- **Proxy Support**: HTTP/HTTPS proxy support with HTTP CONNECT tunneling, system environment variable detection, and wildcard bypass lists.
- **Modern UI & Shortcuts**: Dark/Light/System themes, resizable split panes, CodeMirror 6 editors with autocomplete, and keyboard-first navigation (`Ctrl+Enter` to send, `Ctrl+S` to save).

---

## 5-Minute Quick Start

### 1. Installation

Download the pre-built installer for your operating system from [GitHub Releases](https://github.com/reqit/reqit/releases):

- **Windows**: `Reqit-Setup-<version>.exe`
- **macOS**: `Reqit-<version>.dmg`
- **Linux**: `Reqit-<version>.AppImage` or `.deb`

### 2. Exploring the Bundled Example

1. Launch Reqit.
2. On the Welcome screen, click **Explore Example** (or select `File -> Open Example Collection`).
3. Select `HTTP Methods -> GET Request` in the sidebar.
4. Press `Ctrl+Enter` (or `Cmd+Enter` on macOS) to send the request.
5. Inspect the response headers, body, and timing waterfall breakdown!

### 3. Creating Your First Collection

1. Click **New Collection** from the top bar or Welcome screen.
2. Choose a collection name and destination folder.
3. Add a request (`Ctrl+N`), configure URL and headers, and press `Ctrl+S` to save.
4. Commit your collection folder directly into Git: `git add . && git commit -m "Add API collection"`.

---

## Documentation & Reference

- **[Official Documentation Site](https://nishant0121.github.io/reqit/)** — Complete online documentation, API reference, and guides.
- **[Getting Started & Installation Guide](https://nishant0121.github.io/reqit/guide/getting-started)** — Quickstart and handling unsigned OS warnings on Windows, Mac, and Linux.
- **[File Format Specification](https://nishant0121.github.io/reqit/format/specification)** — Complete schema for requests, folders, environments, and secrets.
- **[Scripting & Assertions API](https://nishant0121.github.io/reqit/features/scripting)** — Pre-request scripts and `reqit.test()` assertion syntax.
- **[Collection Runner & CLI](https://nishant0121.github.io/reqit/features/runner-cli)** — Headless CI/CD automation with `@reqit/cli`.
- **[Security & Unsigned Release Guide](docs/SECURITY_AND_INSTALLATION.md)** — Security architecture, sandboxing, and manual verification.
- **[Changelog](CHANGELOG.md)** — Complete release notes for `v1.0.0`.

---

## Development & Building

### Prerequisites

- [Node.js](https://nodejs.org/) (>= 20.0.0, recommended 22+)
- [pnpm](https://pnpm.io/) (>= 9.0.0)

### Development Commands

```bash
# Clone the repository
git clone https://github.com/reqit/reqit.git
cd reqit

# Install dependencies across all packages
pnpm install

# Start Electron desktop app in live-reload dev mode
pnpm dev

# Run unit tests across all packages
pnpm test

# Run Playwright desktop smoke tests
pnpm test:smoke

# Run linters and formatting checks
pnpm lint
pnpm format:check

# Build and package installers
pnpm --filter @reqit/desktop run package:win    # Windows (.exe)
pnpm --filter @reqit/desktop run package:mac    # macOS (.dmg)
pnpm --filter @reqit/desktop run package:linux  # Linux (.AppImage, .deb)
```

---

## License

This project is licensed under the [MIT License](LICENSE).
