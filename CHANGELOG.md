# Changelog

All notable changes to the Reqit project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-10-29

### Added

- **First-Run & Welcome Experience**:
  - Interactive welcome screen with quick actions: Open Folder, New Collection, Explore Example, Import cURL, and Scratchpad.
  - Bundled runnable Httpbin example collection with HTTP methods, Auth, Status codes, and dynamic delay requests.
- **Native Desktop Shell & Menus**:
  - Native application menus (`File`, `Edit`, `View`, `Settings`, `Help`).
  - Dynamic window title tracking dirty state, active request, collection name, and active environment.
  - React Error Boundary with crash recovery view and "Copy Error Details" diagnostic exporter.
- **Settings Screen**:
  - General settings (Dark, Light, System themes, UI font sizing, Editor font size).
  - Request execution defaults (Timeout, Redirects, SSL/TLS validation toggle).
  - Outbound proxy configuration (Direct, System proxy via environment variables, Manual proxy with bypass lists).
  - Privacy and Request History settings with one-click database purge.
- **Proxy Support**:
  - HTTP and HTTPS outbound proxy support with HTTP CONNECT tunneling for encrypted endpoints.
  - System proxy integration via `HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY`.
  - Wildcard domain bypass lists (e.g. `*.internal.net`, `localhost`).
- **cURL Import & Export (Phase 13)**:
  - Paste cURL commands directly into the URL bar to auto-populate method, URL, headers, and body.
  - Dedicated "Import cURL" dialog with syntax highlighting and live request preview.
  - "Copy as cURL" generator supporting Bash, Windows PowerShell, and Windows CMD formats.
- **Request History Panel (Phase 12)**:
  - Local SQLite history storage with Write-Ahead Logging (WAL) mode.
  - Real-time debounced search and HTTP status filtering (`2xx`, `4xx`, `5xx`, errors).
  - Pre-serialization credential masking for `Authorization`, API keys, and sensitive tokens.
  - Detailed request/response inspection modal with "Open as New Request".
- **Variable Scopes & Secrets (Phase 11)**:
  - Hierarchical variable inheritance: Collection < Folder < Environment < Secrets < Runtime.
  - Transparent variable substitution using `{{variableName}}` with syntax highlighting and autocompletion.
  - Secure `.reqit/secrets.yaml` isolation with automatic `.gitignore` protection.
- **Live File Watcher (Phase 10)**:
  - High-performance recursive collection directory watcher using Chokidar.
  - App-initiated write tracking to avoid false conflicts.
  - Conflict banner with side-by-side Git diff viewer when files are edited externally.
- **Collection Tree & Disk Operations (Phase 9)**:
  - Full CRUD operations for collections, folders, and request files.
  - Natural drag-and-drop or modal reorganization with `folder.yaml` order tracking.
- **Response Viewer (Phase 8)**:
  - Status strip with HTTP status codes, response time, and transfer size.
  - Preview modes: Pretty (JSON, HTML, XML), Raw, and Hex/Binary view.
  - Sub-millisecond timing breakdown (DNS, TCP, TLS, TTFB, Content Download).
  - Streaming to temporary disk files for responses exceeding 5 MB.
- **Request Builder (Phase 7)**:
  - Bidirectional URL query parameters and URL bar synchronization.
  - Auth editors: Bearer, Basic, API Key.
  - CodeMirror 6 editors with JSON formatting and header autocompletion.
- **Core Engine & Architecture (Phases 0-4)**:
  - High-performance Node.js HTTP/HTTPS engine with connection pooling and timing instrumentation.
  - Deterministic YAML parser and serializer with zero-diff round-tripping.
  - Electron multi-process architecture with strict Content Security Policy (CSP) and context-isolated preload bridge.
