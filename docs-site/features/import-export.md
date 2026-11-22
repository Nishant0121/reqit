# Importing cURL, Postman & OpenAPI

Migrating to Reqit takes seconds. You never have to manually re-type requests or rebuild collections.

---

## 1. Instant cURL Import & Export

### Importing cURL

Reqit features intelligent clipboard interception in the URL bar:

1. Copy any `curl ...` command (for example, _Copy as cURL_ from Chrome or Firefox DevTools).
2. Click into Reqit's URL bar and press <kbd>Ctrl+V</kbd> (or press <kbd>Ctrl+I</kbd>).
3. Reqit instantly parses the method, URL, headers, query parameters, basic authentication, and request payload into your draft request!

### Exporting to cURL

In the URL bar, the **cURL** split-button allows exporting any request:

- **Formats:**
  - **Bash / macOS / Linux:** Single-quoted syntax with line breaks (`\`).
  - **PowerShell:** Properly escaped for `curl.exe` in Windows PowerShell.
  - **Windows CMD:** Escaped for traditional `cmd.exe`.
- **Variable Resolution:**
  - **Resolved:** Replaces `&#123;&#123;baseUrl&#125;&#125;` with its live active environment value.
  - **Raw:** Preserves literal `&#123;&#123;variable&#125;&#125;` template syntax for team sharing.

---

## 2. Postman Collection Import

Import your existing Postman `v2.1` collections and environments:

1. Click the collection menu $\rightarrow$ **Import Postman Collection...**.
2. Select your exported `collection.json` and optional `environment.json`.
3. Choose your destination directory on disk.
4. Reqit converts the entire structure into:
   - Nested directories matching your folder hierarchy.
   - Deterministic `folder.yaml` files preserving your execution order.
   - Clean `*.yaml` files for each request.
   - Environments mapped to `environments/<name>.yaml`.

---

## 3. OpenAPI & Swagger Specification Import

Reqit includes a native OpenAPI 3.0 and 3.1 parser:

1. Open the Command Palette (<kbd>Ctrl+K</kbd>) $\rightarrow$ _Import OpenAPI / Swagger Spec..._.
2. Provide your spec:
   - **Local File:** `.json`, `.yaml`, or `.yml`.
   - **Remote URL:** e.g. `https://petstore.swagger.io/v2/swagger.json`.
3. Review the **Interactive Import Preview**:
   - Inspect all operations grouped by tags or route paths.
   - Inspect generated request names and methods.
4. Select your Import Mode:
   - **Add New:** Adds missing endpoints without overwriting existing files.
   - **Merge:** Updates existing requests while preserving custom test scripts.
   - **Clean:** Overwrites the target folder with the fresh specification.
5. Click **Import Operations**. Reqit creates complete requests with query parameters, headers, and sample JSON payloads.
