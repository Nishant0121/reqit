# Reqit

> A local-first, Git-native desktop API client. Your requests live as plain YAML files in your repository, next to your code.

[![CI](https://github.com/reqit/reqit/actions/workflows/ci.yml/badge.svg)](https://github.com/reqit/reqit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Why Reqit?

Most API clients store your requests in their own cloud or proprietary databases. That creates friction:

- **Requests drift away from code:** APIs change in pull requests, but collections are stored elsewhere.
- **Sharing requires proprietary accounts:** Team members need logins and workspace invites.
- **No code review for requests:** Changes to requests bypass your normal Git PR review process.
- **Heavy and bloated:** Modern API clients have grown into complex platforms when you just need a fast, reliable tool.

**Reqit solves this by storing collections as human-readable YAML files directly on disk.**

```
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

## Monorepo Structure

Reqit is organized as a pnpm workspace:

```
reqit/
├── packages/
│   ├── core/         # Shared engine: format parser, variable resolver, HTTP engine
│   ├── desktop/      # Electron app (React + Tailwind CSS + CodeMirror)
│   └── cli/          # Headless CLI runner for CI/CD
├── docs/             # Specifications and implementation plans
├── examples/         # Sample collections
└── .github/          # GitHub Actions workflows and issue templates
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (>= 20.0.0, recommended 22+)
- [pnpm](https://pnpm.io/) (>= 9.0.0)

### Installation & Development

```bash
# Clone the repository
git clone https://github.com/reqit/reqit.git
cd reqit

# Install dependencies across all packages
pnpm install

# Run linters
pnpm lint

# Run tests
pnpm test

# Format code
pnpm format
```

---

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and development workflow.

---

## License

This project is licensed under the [MIT License](LICENSE).
