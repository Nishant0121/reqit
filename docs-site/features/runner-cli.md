# Collection Runner & Headless CLI

Reqit provides two ways to execute automated test suites across collections: an interactive **Desktop Runner** and a headless **Command-Line Interface (`@reqit/cli`)** for CI/CD pipelines.

---

## 1. Desktop Collection Runner

The Desktop Runner allows you to execute entire collections or specific subfolders sequentially with live feedback:

1. Click the **Run** button on any folder in the sidebar (or press <kbd>Ctrl+K</kbd> $\rightarrow$ _Run Collection..._).
2. Configure runner options:
   - **Environment:** Select active environment (`local`, `staging`, `production`).
   - **Iteration Count:** Number of consecutive runs.
   - **Data File (CSV / JSON):** Load external test rows for data-driven testing. Each column header automatically maps to a variable like `{{username}}`.
   - **Delay (ms):** Add a pause between sequential requests to prevent API rate-limiting.
   - **Stop on Failure:** Halt execution immediately if any test assertion fails.
3. Watch real-time execution with status badges, request durations, and test assertion logs.
4. Export the summary report as a standalone **HTML Report** or **JSON Report** for audits.

---

## 2. Headless CLI (`@reqit/cli`)

The Reqit CLI brings the exact same HTTP engine and test assertion sandbox into your terminal and continuous integration workflows.

### Installation

```bash
# Global install
npm install -g @reqit/cli

# Or run directly with npx
npx @reqit/cli run ./api-collection --env staging
```

### CLI Command Options

```bash
reqit run <collection-path> [options]
```

| Flag                     | Description                                               | Default           |
| ------------------------ | --------------------------------------------------------- | ----------------- |
| `-e, --env <name>`       | Name of environment from `environments/<name>.yaml`       | None              |
| `-f, --folder <path>`    | Target subfolder to run instead of entire collection      | Entire collection |
| `-n, --iterations <num>` | Number of test iterations to execute                      | `1`               |
| `-d, --data <file>`      | Path to external CSV or JSON data file                    | None              |
| `--delay <ms>`           | Delay between consecutive requests in milliseconds        | `0`               |
| `--bail`                 | Terminate run immediately on first failure                | `false`           |
| `-r, --reporter <list>`  | Comma-separated reporters: `cli`, `junit`, `html`, `json` | `cli`             |
| `-o, --output <dir>`     | Destination directory for generated report artifacts      | `./reports`       |
| `-v, --verbose`          | Print detailed request & response headers                 | `false`           |

---

## 3. GitHub Actions CI/CD Integration

To run Reqit tests automatically on every Pull Request and prevent regressions:

```yaml
name: API Regression Suite

on:
  push:
    branches: [master, main]
  pull_request:
    branches: [master, main]

jobs:
  api-tests:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install Reqit CLI
        run: npm install -g @reqit/cli

      - name: Run API Collection
        env:
          # Inject sensitive secrets securely from GitHub Secrets
          REQIT_SECRET_apiKey: ${{ secrets.STAGING_API_KEY }}
          REQIT_SECRET_dbPassword: ${{ secrets.STAGING_DB_PASSWORD }}
        run: |
          reqit run ./api \
            --env staging \
            --reporter cli,junit,html \
            --output ./test-results \
            --bail

      - name: Publish Test Report Artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: api-test-results
          path: ./test-results
```

### Exit Codes

- `0`: All requests and assertions passed.
- `1`: One or more assertions failed, or network error occurred.
- `2`: Configuration error (invalid directory path, missing environment).
