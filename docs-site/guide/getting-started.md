# Getting Started with Reqit

Reqit is a fast, local-first API client designed for developers who want their API requests version-controlled with Git.

---

## 1. Download & Installation

Reqit is open-source and free to use. Pre-compiled binaries for every release are available on the [GitHub Releases page](https://github.com/Nishant0121/reqit/releases/latest).

| Platform                  | Recommended Package     | Description                                          |
| ------------------------- | ----------------------- | ---------------------------------------------------- |
| **Windows**               | `Reqit-Setup-1.0.0.exe` | Standard Windows Installer                           |
| **Windows Portable**      | `Reqit-1.0.0-win.exe`   | Single standalone `.exe` (No admin rights required)  |
| **macOS**                 | `Reqit-1.0.0.dmg`       | Universal macOS disk image (Apple Silicon & Intel)   |
| **Linux (AppImage)**      | `Reqit-1.0.0.AppImage`  | Standalone portable executable for all distributions |
| **Linux (Debian/Ubuntu)** | `reqit_1.0.0_amd64.deb` | Standard Debian / Ubuntu package                     |

---

## 2. Installing Unsigned Community Builds

Reqit is free community software. We do not charge subscriptions, and commercial signing certificates cost $300–$500 annually. As a result, initial downloads may show an OS warning. Here is how to run the app safely:

### Windows SmartScreen

If Windows displays _"Windows protected your PC"_:

1. Click **More info**.
2. Click **Run anyway**.
3. _Alternative:_ Right-click the `.exe` file $\rightarrow$ **Properties** $\rightarrow$ check **Unblock** at the bottom $\rightarrow$ click **OK**.
4. _Tip:_ Using the **Portable `.exe`** requires no administrative installer privileges.

### macOS Gatekeeper

If macOS warns _"Reqit cannot be opened because the developer cannot be verified"_:

1. Open **Finder** and navigate to your `Applications` folder.
2. **Right-click** (or `Control-click`) on `Reqit.app` and choose **Open**.
3. In the dialog that appears, click **Open**. (macOS remembers this choice).
4. _Terminal alternative:_ Run `xattr -cr /Applications/Reqit.app` to clear the quarantine attribute.

### Linux

1. Open your terminal in the download folder.
2. Grant execution permission:
   ```bash
   chmod +x Reqit-1.0.0.AppImage
   ./Reqit-1.0.0.AppImage
   ```

---

## 3. Quick Start: Exploring the Example Collection

1. Launch Reqit.
2. On the Welcome screen, click **Explore Example Collection** (or press the Reqit icon in the top left $\rightarrow$ _Explore Example Collection..._).
3. The bundled example collection loads with organized folders demonstrating:
   - **GET, POST, PUT, DELETE** requests.
   - **Authentication**: Bearer tokens, Basic Auth, API Key in header/query.
   - **OAuth 2.0**: PKCE and Client Credentials flows.
   - **GraphQL**: Query with variable substitution.
4. Select `HTTP Methods -> GET Request`.
5. Press <kbd>Ctrl+Enter</kbd> (or <kbd>Cmd+Enter</kbd> on macOS) to send.
6. Observe the response:
   - Formatted JSON syntax-highlighted editor.
   - Response headers table.
   - Sub-millisecond timing waterfall breakdown: DNS, TCP, TLS, TTFB, and Transfer.

---

## 4. Creating Your First Collection

1. In the top bar, click the collection dropdown and select **New Collection...** (or press <kbd>Ctrl+Alt+N</kbd>).
2. Enter your collection name (e.g., `my-api`).
3. Select an existing directory inside your backend repository or an empty folder.
4. Reqit initializes the directory structure with a root `reqit.yaml` file.
5. Click **+ Request** (<kbd>Ctrl+N</kbd>) to add an endpoint.
6. Enter `https://httpbin.org/get` in the URL bar and press <kbd>Ctrl+S</kbd> to save.
7. Open a terminal in that folder and run:
   ```bash
   git add .
   git commit -m "feat: Add initial Reqit API collection"
   ```

You are now managing your API specifications directly in version control!
