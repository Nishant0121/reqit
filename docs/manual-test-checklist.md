# Reqit Manual Release Test Checklist

This checklist is used to verify Reqit desktop releases across Windows (`.exe`), macOS (`.dmg`), and Linux (`.AppImage`, `.deb`) before publishing a release tag.

---

## 1. Installation & First Launch

| Check                       | Steps                                               | Expected Result                                                                                                                                      | Pass |
| --------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | :--: |
| **Clean Install (Windows)** | Run `Reqit-Setup-<version>.exe`                     | Installer launches, guides through directory selection, creates shortcuts, and launches cleanly.                                                     | [ ]  |
| **Clean Install (macOS)**   | Open `Reqit-<version>.dmg`, drag to Applications    | Mounts cleanly, app launches without security quarantine warnings when signed.                                                                       | [ ]  |
| **Clean Install (Linux)**   | Run `./Reqit-<version>.AppImage` or `dpkg -i *.deb` | App starts with desktop integration and window frame.                                                                                                | [ ]  |
| **First-Run Welcome**       | Launch app with clean app data                      | Welcome screen displays "Welcome to Reqit", hero logo, action cards ("Open Folder", "New Collection", "Explore Example"), and shortcuts cheat sheet. | [ ]  |
| **Scratchpad Fallback**     | Click "Continue to Scratchpad"                      | Welcome screen dismisses, default scratchpad editor appears with URL input and GET method.                                                           | [ ]  |

---

## 2. Bundled Example Collection

| Check                     | Steps                                                                                        | Expected Result                                                                                                               | Pass |
| ------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | :--: |
| **Load Example**          | Click "Explore Example" from Welcome screen or native menu `File -> Open Example Collection` | Complete `Httpbin Example Collection` loads in sidebar with folders: `HTTP Methods`, `Auth`, `Dynamic Data`.                  | [ ]  |
| **Send GET Request**      | Click `HTTP Methods -> GET Request`, press `Ctrl+Enter`                                      | Request executes against `https://httpbin.org/get`. Response status 200 OK displays with formatted JSON and timing waterfall. | [ ]  |
| **Environment Switching** | Switch environment dropdown in TopBar between `dev` and `local`                              | Active environment updates in TopBar and window title. Variable `{{baseUrl}}` resolves to selected environment URL.           | [ ]  |
| **Auth Request**          | Select `Auth -> Bearer Auth`, send request                                                   | Request includes `Authorization: Bearer sample-auth-token-123` and returns authenticated 200 OK.                              | [ ]  |

---

## 3. Request Builder & Execution

| Check                    | Steps                                                                              | Expected Result                                                                                                         | Pass |
| ------------------------ | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | :--: |
| **URL & Query Sync**     | Type `?query=123&sort=desc` in URL bar                                             | Params table automatically populates two rows with `query` and `sort`. Changing a row updates the URL bar in real-time. | [ ]  |
| **Request Cancellation** | Send `Dynamic Data -> Delay 1s`, hit `Escape` or click Cancel                      | Request aborts immediately, status bar indicates cancellation, no socket hangs.                                         | [ ]  |
| **Large Response**       | Request an endpoint returning > 5MB                                                | Body streams to disk without high memory spikes; "Streamed to disk" badge displays.                                     | [ ]  |
| **cURL Import (Paste)**  | Paste `curl -X POST https://httpbin.org/post -d '{"hello": "world"}'` into URL bar | URL bar detects cURL, sets method to POST, switches Body tab to JSON with parsed payload.                               | [ ]  |
| **cURL Export**          | Click "Copy as cURL" dropdown -> Select "Windows PowerShell" or "Bash"             | Formatted command is copied to clipboard with variables properly resolved.                                              | [ ]  |

---

## 4. Settings & Network Configuration

| Check                | Steps                                                                                 | Expected Result                                                                          | Pass |
| -------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | :--: |
| **Theme Switching**  | Open Settings (`Ctrl+,`) -> General -> Select "Light", "Dark", "System"               | Entire application changes color theme instantly and persists across restarts.           | [ ]  |
| **Font Sizing**      | Change UI font size to "Large" and Code Editor font size to 16                        | Font size scales immediately in the request and response editors.                        | [ ]  |
| **Request Defaults** | Change default timeout to 10000ms, toggle "Follow HTTP Redirects"                     | Sent requests respect the new default timeout and redirect hopping rules.                | [ ]  |
| **Proxy Routing**    | In Settings -> Proxy, set Manual Proxy to a test proxy (e.g. Charles, Fiddler, Squid) | Requests route through the proxy server. HTTPS endpoints utilize HTTP CONNECT tunneling. | [ ]  |
| **Proxy Bypass**     | Add `httpbin.org` to Bypass list                                                      | Requests to `httpbin.org` bypass proxy directly, while other requests use proxy.         | [ ]  |
| **Clear History**    | In Settings -> Privacy & History -> Click "Clear All History Now"                     | Confirmation prompt appears, local SQLite history records are purged completely.         | [ ]  |

---

## 5. File System & Git Operations

| Check                     | Steps                                                                     | Expected Result                                                                                            | Pass |
| ------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | :--: |
| **External Modification** | Edit a `.yaml` file externally in VS Code while open in Reqit             | Reqit silently reloads the file without losing cursor position if unmodified locally.                      | [ ]  |
| **Conflict Resolution**   | Make local dirty edit in Reqit, then edit same file externally in VS Code | Conflict banner appears: "File changed on disk". Clicking "View Diff" opens modal showing Git-style diff.  | [ ]  |
| **Secrets Protection**    | Check `.gitignore` after creating secrets                                 | `.reqit/` is confirmed present in `.gitignore`, ensuring zero accidental secret leaks to remote Git repos. | [ ]  |
| **Zero-Diff Round-Trip**  | Run `git status` after editing and saving a request in Reqit              | Only modified fields have changed; no unexpected key reordering, quoting shifts, or formatting noise.      | [ ]  |

---

## 6. Error Recovery & Stability

| Check              | Steps                                                           | Expected Result                                                                                   | Pass |
| ------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | :--: |
| **Error Boundary** | Trigger unexpected component failure                            | Error recovery screen appears with descriptive error, component stack, and "Copy Details" button. | [ ]  |
| **Window State**   | Resize window, move to secondary monitor, close and restart app | Window restores exact size, position, and maximized status on startup.                            | [ ]  |
