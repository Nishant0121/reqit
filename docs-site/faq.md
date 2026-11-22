# Frequently Asked Questions (FAQ)

### Where does Reqit store collections and requests?

Directly on your local file system as plain folders and `.yaml` files. Reqit does not have a proprietary database or cloud server. You choose where the folder lives—typically inside your backend code repository.

### Why YAML instead of JSON or a custom format?

- **Git Diff Readability:** JSON requires trailing commas, escapes multi-line strings as ugly `\n` blocks, and easily creates Git merge conflicts.
- **Portability:** Unlike tools that invent custom file formats (such as `.bru`), standard YAML can be read and written by every modern programming language (Python, Node.js, Go, Rust, Java, C#) without installing proprietary plugins.
- **Comments and Formatting:** YAML natively supports comments and clean multi-line string blocks (`|`).

### How do teams collaborate without a cloud account?

Through your existing **Git workflow** (GitHub, GitLab, Bitbucket):

1. Add your Reqit collection folder to your repository: `git add api/ && git commit -m "Add API collection"`.
2. Push to your branch and open a Pull Request.
3. Your teammates review API changes, added endpoints, and test assertions using the exact same code review process they use for backend code.

### How are secrets protected from being committed to Git?

Reqit keeps all sensitive values (passwords, private API keys, bearer tokens) in `.reqit/secrets.yaml`. Reqit automatically verifies that `.reqit/` is present in your repository's `.gitignore`. In automated CI pipelines, you inject secrets via standard environment variables: `REQIT_SECRET_<varName>`.

### Can I run collections headless in CI/CD?

Yes! Use `@reqit/cli`:

```bash
npx @reqit/cli run ./api --env staging --reporter cli,junit --output ./results
```

The CLI exits with code `0` on success or code `1` if any assertions fail, allowing you to gate your deployment pipeline.

### Does Reqit track telemetry or user analytics?

**No.** Reqit has zero tracking pixels, zero analytics libraries, and zero telemetry. We believe developer tools should be private, fast, and respectful of your data.

### How do automatic updates work?

Reqit checks GitHub Releases for new releases. When an update is published, a non-intrusive update prompt appears with release notes. You can choose to download and restart when convenient.
