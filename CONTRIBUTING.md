# Contributing to Reqit

Thank you for your interest in contributing to Reqit! We welcome contributions of all kinds: bug reports, documentation improvements, feature requests, and code contributions.

---

## Development Setup

### Prerequisites

- **Node.js**: v20 or newer (v22+ recommended)
- **pnpm**: v9 or newer (`npm install -g pnpm`)
- **Git**

### Getting the Code

```bash
git clone https://github.com/reqit/reqit.git
cd reqit
pnpm install
```

---

## Development Workflow

1. Create a branch for your changes:

   ```bash
   git checkout -b feature/my-feature-name
   # or
   git checkout -b fix/my-bug-fix
   ```

2. Make your changes in the appropriate package:
   - `packages/core`: Core parsing, serialization, variable resolution, and HTTP engine.
   - `packages/desktop`: Electron desktop app.
   - `packages/cli`: CLI runner.

3. Verify your changes pass all checks:

   ```bash
   pnpm lint
   pnpm test
   ```

4. Commit your changes following [Conventional Commits](https://www.conventionalcommits.org/):

   ```bash
   git commit -m "feat(core): add request validation schema"
   ```

5. Push your branch and open a Pull Request.

---

## Coding Standards

- **TypeScript**: Strict mode is enabled across all packages. Avoid `any`.
- **Formatting**: Prettier is configured; run `pnpm format` before committing.
- **Linting**: ESLint is configured; run `pnpm lint` to check for style and correctness issues.
- **Testing**: Write unit tests for new features and bug fixes. All tests must pass in CI.

---

## Issue Reports

- For bugs, please use the Bug Report issue template and provide reproduction steps.
- For feature proposals, please explain the use case and how it fits into Reqit's local-first philosophy.
