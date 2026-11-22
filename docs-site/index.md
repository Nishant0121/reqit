---
layout: home

hero:
  name: 'Reqit'
  text: 'Git-Native Desktop API Client'
  tagline: 'Your requests live as human-readable YAML files in your repository, right next to your code. Fast, offline-first, zero cloud bloat.'
  image:
    src: /logo.svg
    alt: Reqit Logo
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Download v1.0.0
      link: https://github.com/Nishant0121/reqit/releases/latest
    - theme: alt
      text: View on GitHub
      link: https://github.com/Nishant0121/reqit

features:
  - icon: 📂
    title: Plain YAML on Disk
    details: Every request, folder, environment, and secret rule is a clean .yaml file. Review API modifications in pull requests alongside your backend code.
  - icon: ⚡
    title: Sub-Millisecond Timing
    details: Deep timing breakdown with DNS lookup, TCP handshake, TLS negotiation, TTFB, and download transfer waterfalls for every request.
  - icon: 🔄
    title: Live File Sync
    details: Real-time file watcher syncs external edits from git checkout or your favorite IDE instantly with built-in three-way diff conflict resolution.
  - icon: 🔒
    title: Hierarchical Variables & Secrets
    details: 5-layer cascading variable scoping. Passwords, API tokens, and credentials in .reqit/secrets.yaml are guaranteed never to touch Git.
  - icon: 📜
    title: Scripting & Test Assertions
    details: Isolated Node.js sandbox for pre-request dynamic setup and post-request test assertions using familiar reqit.test() and reqit.expect() syntax.
  - icon: 🚀
    title: Headless CLI & CI/CD Runner
    details: Run entire collections headless in GitHub Actions, GitLab CI, or terminal using @reqit/cli with JUnit and HTML test reports.
---

## Why Developers Love Reqit

Modern proprietary API clients store your requests in their own cloud servers or opaque SQLite databases behind account paywalls. That breaks modern developer workflows:

```text
my-project/
├── src/                          <- Your application code
├── api/                          <- Your Reqit collection
│   ├── reqit.yaml                <- Collection configuration
│   ├── auth/
│   │   ├── folder.yaml           <- Ordered execution rules
│   │   ├── login.yaml
│   │   └── refresh-token.yaml
│   ├── users/
│   │   ├── folder.yaml
│   │   ├── get-user.yaml
│   │   └── create-user.yaml
│   └── environments/
│       ├── dev.yaml
│       └── prod.yaml
├── .reqit/
│   └── secrets.yaml              <- Gitignored, never committed
└── package.json
```

- **Zero Cloud Lock-in:** 100% offline-first. No mandatory user accounts, no logins, no tracking.
- **Git Pull Request Reviews:** Request modifications show up as clean line diffs in GitHub/GitLab PRs.
- **Automated CI Integration:** Run the exact same collection in CI pipelines using `@reqit/cli`.
