# reqit-cli

> Headless command-line runner and CI/CD test automation tool for [Reqit](https://github.com/Nishant0121/reqit).

Run your local-first, Git-native Reqit API collections directly in your terminal, GitHub Actions, or GitLab CI pipelines.

---

## Installation

```bash
# Install globally
npm install -g reqit-cli

# Or run instantly with npx (no install required)
npx reqit-cli run ./api-collection --env staging
```

---

## Quick Start

```bash
# Run an entire collection with an environment
reqit run ./api --env staging

# Run a specific subfolder
reqit run ./api --folder "auth" --env prod

# Run with data-driven parameterized iterations (CSV or JSON)
reqit run ./api --data ./test-users.csv --iterations 5

# Generate JUnit XML and HTML test reports for CI/CD
reqit run ./api --env staging --reporter cli,junit,html --output ./test-results --bail
```

---

## CLI Options

```text
Usage: reqit run <collection-path> [options]

Arguments:
  collection-path          Path to the Reqit collection directory on disk

Options:
  -e, --env <name>         Name of environment from environments/<name>.yaml
  -f, --folder <path>      Target subfolder to run instead of entire collection
  -n, --iterations <num>   Number of test iterations to execute (default: 1)
  -d, --data <file>        Path to external CSV or JSON data file
  --delay <ms>             Delay between consecutive requests in ms (default: 0)
  --bail                   Terminate run immediately on first test failure
  -r, --reporter <list>    Reporters: cli, junit, html, json (default: "cli")
  -o, --output <dir>       Output directory for generated reports (default: "./reports")
  -v, --verbose            Print detailed request & response headers
  -h, --help               Display help for command
```

---

## CI/CD Pipeline Example (GitHub Actions)

```yaml
name: API Regression Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install reqit-cli
        run: npm install -g reqit-cli

      - name: Run API Tests
        env:
          # Inject secrets securely from GitHub repository secrets
          REQIT_SECRET_apiKey: ${{ secrets.STAGING_API_KEY }}
        run: |
          reqit run ./api --env staging --reporter cli,junit --output ./results --bail

      - name: Publish Test Results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: ./results
```

---

## Documentation

For full documentation on file formats, scripting API, assertions, and desktop app downloads, visit:
**[https://nishant0121.github.io/reqit/](https://nishant0121.github.io/reqit/)**

---

## License

[MIT](https://github.com/Nishant0121/reqit/blob/master/LICENSE) © Reqit Contributors
