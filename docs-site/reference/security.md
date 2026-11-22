# Security Architecture & Unsigned Builds

Reqit is built with a defense-in-depth security model to protect developers working with untrusted third-party repositories and sensitive API credentials.

---

## 1. Electron Hardening & IPC Surface

Reqit strictly follows the official Electron Security Guidelines:

- **Context Isolation:** The renderer process runs in an isolated context (`contextIsolation: true`) with no direct access to Node.js APIs (`nodeIntegration: false`).
- **Strict Preload Bridge:** Communication between the UI and system APIs occurs exclusively over explicit, typed IPC channels exposed through `window.reqitApi`.
- **Content Security Policy (CSP):** A restrictive CSP disallows unauthorized remote script execution and inline code evaluation (`script-src 'self'`).
- **External Links:** Links to documentation or GitHub are routed through Electron's `shell.openExternal()` rather than opening inside the desktop application context.

---

## 2. Path Traversal & System Protection

Reqit enforces strict file system boundaries using the internal `validateSafePath` validator:

- **Prohibited Null Bytes:** Any path containing null bytes (`\0`) is blocked immediately.
- **System Directory Blacklist:** Operations targeting sensitive operating system directories (e.g. `C:\Windows`, `C:\Program Files`, `/etc`, `/bin`, `/sbin`) are blocked.
- **Collection Root Jails:** All file modifications are validated to ensure relative path navigation (`../`) cannot escape the active collection root folder.

---

## 3. Workspace Trust Model

When opening a collection from an untrusted source (such as an open-source clone or untrusted zip file):

- Pre-request scripts and test assertion scripts are **disabled by default**.
- A prominent **Trust Banner** prompts the developer to review scripts before granting execution privileges.
- Trust decisions are remembered locally per collection path.

---

## 4. Privacy, Telemetry & Diagnostics

- **Zero Telemetry:** Reqit has no background trackers, analytics pixels, or usage reporting. We do not track what APIs you call or how often you use the app.
- **100% Offline-First:** The app never communicates with remote servers except for endpoints you explicitly send requests to.
- **Sanitized Bug Reports:** When using the _Report a Bug_ tool, all Bearer tokens, Authorization headers, Basic Auth credentials, session cookies, and secret keys in logs are automatically redacted before display.

---

## 5. Unsigned Release Guide

Code-signing certificates for independent open-source developers cost between $300 and $500 per year from commercial certificate authorities. Because Reqit is free community software, we publish unsigned packages.

Here is how to run the app safely:

### Windows SmartScreen

When opening `Reqit-Setup-1.0.0.exe`:

1. Click **More info**.
2. Click **Run anyway**.
3. _Alternative:_ Use the **Portable `.exe`** (`Reqit-1.0.0-win.exe`) which requires no administrative installer privileges.

### macOS Gatekeeper

When installing `Reqit-1.0.0.dmg`:

1. Drag `Reqit.app` to your `Applications` folder.
2. In Finder, **Right-click** (or `Control-click`) on `Reqit.app` and choose **Open**.
3. In the dialog, click **Open**.
4. _Terminal alternative:_ Run `xattr -cr /Applications/Reqit.app` to strip the quarantine flag.

### Linux AppImage

```bash
chmod +x Reqit-1.0.0.AppImage
./Reqit-1.0.0.AppImage
```
