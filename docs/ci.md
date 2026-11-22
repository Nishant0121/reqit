# Running Reqit in CI/CD

Reqit includes a headless command-line runner (`@reqit/cli`) that executes your API collections in continuous integration (CI) pipelines using the exact same HTTP engine, variable scopes, scripts, and test assertions as the Reqit desktop application.

---

## 1. Quick Start

Run collections locally or in CI without installing globally using `npx`:

```bash
# Run an entire collection with a designated environment
npx @reqit/cli run ./my-api-collection --env staging

# Run a specific subfolder within a collection
npx @reqit/cli run ./my-api-collection --env staging --folder "Authentication"

# Run a single .yaml request file
npx @reqit/cli run ./my-api-collection/users/get-user.yaml --env staging
```

Or install globally:

```bash
npm install -g @reqit/cli
reqit run ./my-api-collection --env staging
```

---

## 2. CLI Options Reference

| Option              | Shorthand | Description                                                        | Default               |
| :------------------ | :-------- | :----------------------------------------------------------------- | :-------------------- |
| `--env <name>`      | `-e`      | Name of the environment file in `environments/<name>.yaml`         | —                     |
| `--folder <name>`   | `-f`      | Filter execution to a single folder or relative folder path        | Whole collection      |
| `--secrets <file>`  | `-s`      | Custom path to secrets YAML file (overrides `.reqit/secrets.yaml`) | `.reqit/secrets.yaml` |
| `--bail`            | `-b`      | Halt execution immediately on the first failed assertion or error  | `false`               |
| `--timeout <ms>`    | `-t`      | Per-request timeout in milliseconds                                | Engine default        |
| `--delay <ms>`      | `-d`      | Delay between consecutive requests in milliseconds                 | `0`                   |
| `--insecure`        | `-k`      | Disable strict SSL/TLS certificate verification                    | `false`               |
| `--reporter <list>` | `-r`      | Comma-separated list of reporters: `console`, `json`, `junit`      | `console`             |
| `--output <file>`   | `-o`      | File path to write machine-readable report (`.xml` or `.json`)     | —                     |

---

## 3. Managing Secrets in CI (`REQIT_SECRET_*`)

To prevent secret leakage, Reqit collections store secrets locally in `.reqit/secrets.yaml` (which is git-ignored).

In CI pipelines, you can provide secrets through environment variables prefixed with **`REQIT_SECRET_`**. The CLI runner automatically extracts these and injects them into the secrets resolution scope with highest priority:

```bash
export REQIT_SECRET_apiKey="live_key_987654321"
export REQIT_SECRET_bearerToken="eyJhbGciOiJIUzI1NiIs..."

npx @reqit/cli run ./collection --env prod
```

Inside your request files, reference them normally via `{{apiKey}}` or `{{bearerToken}}`.

---

## 4. GitHub Actions Workflows

### Example A: Basic Automated Test Run

Save as `.github/workflows/api-tests.yml`:

```yaml
name: API Regression Tests

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]
  schedule:
    # Run every morning at 04:00 UTC
    - cron: '0 4 * * *'

jobs:
  test:
    name: Run Reqit Collection
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js 22.x
        uses: actions/setup-node@v4
        with:
          node-version: 22.x

      - name: Run Reqit API tests
        env:
          REQIT_SECRET_api_key: ${{ secrets.PROD_API_KEY }}
          REQIT_SECRET_jwt_token: ${{ secrets.PROD_JWT_TOKEN }}
        run: |
          npx @reqit/cli run ./api-collection \
            --env staging \
            --bail
```

---

### Example B: With JUnit Test Report & Artifact Publishing

This workflow generates a standard JUnit XML test report and displays a test summary right inside GitHub Actions:

```yaml
name: API Tests with JUnit Reports

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  api-tests:
    name: Execute API Tests
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js 22.x
        uses: actions/setup-node@v4
        with:
          node-version: 22.x

      - name: Run Reqit Collection with JUnit Reporter
        env:
          REQIT_SECRET_api_key: ${{ secrets.STAGING_API_KEY }}
        run: |
          npx @reqit/cli run ./api-collection \
            --env staging \
            --reporter console,junit \
            --output test-results/junit.xml

      - name: Upload Test Report Artifact
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: api-test-results
          path: test-results/junit.xml

      - name: Publish Test Report Summary
        if: always()
        uses: dorny/test-reporter@v1
        with:
          name: Reqit Test Suite
          path: test-results/junit.xml
          reporter: java-junit
```

---

## 5. GitLab CI & Other CI Systems

### GitLab CI (`.gitlab-ci.yml`)

```yaml
stages:
  - test

api_tests:
  stage: test
  image: node:22-alpine
  variables:
    REQIT_SECRET_token: $CI_SECRET_TOKEN
  script:
    - npx @reqit/cli run ./my-collection --env production --reporter console,junit --output report.xml
  artifacts:
    when: always
    reports:
      junit: report.xml
```

---

## 6. Exit Codes

The CLI runner returns standard UNIX process exit codes:

- **`0`**: All requests completed successfully and all assertions passed.
- **`1`**: Any assertion failed, request encountered a network or timeout error, or invalid options were passed.
