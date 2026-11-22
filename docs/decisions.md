# Reqit Architecture & Technical Decisions

This document records architectural, design, and technical decisions made during the development of Reqit, following the project's cross-cutting rules.

---

### ADR-001: Script Execution Sandbox (Node `vm` in dedicated child process)

- **Date:** 2026-11-01
- **Status:** Accepted (Phase 16)
- **Context:**
  Reqit requires running arbitrary user-authored JavaScript scripts (pre-request and post-response scripts) safely. We evaluated two primary sandbox architectures:
  1. `isolated-vm` (native V8 isolate wrapper)
  2. Node's built-in `node:vm` running inside a dedicated, isolated child process (`spawn(process.execPath)`)
- **Decision:**
  We chose Node's built-in `node:vm` executing inside an ephemeral, dedicated child process with hard OS-level process timeouts (`child.kill('SIGKILL')`), memory limits (`--max-old-space-size=64`), and a sterile context created with `Object.create(null)` and `codeGeneration: { strings: false, wasm: false }`.
- **Rationale:**
  - **Zero native build friction:** `isolated-vm` requires C++ native compilation with node-gyp and prebuilts. Native dependencies frequently break across Electron versions (ABI mismatches) and target OSes (Windows, macOS ARM/x64, Linux).
  - **Shared code between Desktop & CLI:** `@reqit/core` is shared with `@reqit/cli` (no Electron). A pure Node.js sandbox guarantees 100% feature and security parity in CI environments.
  - **True process isolation:** Running the VM in an isolated disposable child process ensures that infinite loops (`while(true){}`) can be killed instantly with `SIGKILL` without freezing the parent process event loop. Memory is capped at the V8 engine level (`--max-old-space-size`), safely catching heap allocation bombs.
  - **Hardened sandbox:** With `codeGeneration: { strings: false, wasm: false }`, attempts to evaluate strings via `eval()` or `Function()` constructor are rejected by V8. The child process has no access to sensitive variables, secrets, or filesystem tokens.
