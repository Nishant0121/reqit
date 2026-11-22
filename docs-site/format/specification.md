# File Format Specification

Reqit uses human-readable **YAML** for all files. Every file is designed to be easily readable in Git diffs, cleanly parsed by standard libraries in any programming language, and deterministic across operating systems.

---

## Directory Architecture

A Reqit collection is simply a folder on disk structured as follows:

```text
my-api-collection/
├── reqit.yaml                 # Root collection metadata & global variables
├── folder.yaml                # (Optional) Root-level ordering & settings
├── auth/
│   ├── folder.yaml            # Subfolder settings & request execution order
│   ├── login.yaml             # Request: POST /auth/login
│   └── refresh-token.yaml     # Request: POST /auth/refresh
├── users/
│   ├── folder.yaml
│   ├── get-user.yaml          # Request: GET /users/:id
│   └── create-user.yaml       # Request: POST /users
├── environments/
│   ├── local.yaml             # Environment variables for localhost
│   ├── staging.yaml
│   └── production.yaml
└── .reqit/
    └── secrets.yaml           # Secrets & credentials (MUST BE GITIGNORED)
```

---

## 1. Request File (`*.yaml`)

Each request is saved as an individual `.yaml` file.

```yaml
version: '1.0.0'
name: 'Create User'
method: 'POST'
url: '{{baseUrl}}/api/v1/users'

headers:
  - name: 'Content-Type'
    value: 'application/json'
    enabled: true
  - name: 'Accept'
    value: 'application/json'
    enabled: true

params:
  - name: 'sendWelcomeEmail'
    value: 'true'
    enabled: true

auth:
  type: 'bearer'
  token: '{{jwtToken}}'

body:
  type: 'json'
  content: |
    {
      "name": "Jane Doe",
      "email": "jane@example.com",
      "role": "admin"
    }

preScript: |
  // Generate random correlation id
  reqit.variables.set('correlationId', 'req_' + Date.now());

tests: |
  reqit.test('Status code is 201 Created', function() {
    reqit.expect(reqit.response.status).toBe(201);
  });

  reqit.test('User ID returned', function() {
    var data = reqit.response.json();
    reqit.expect(data.id).toBeDefined();
    reqit.variables.set('createdUserId', data.id);
  });
```

### Body Types

The `body.type` field supports:

- `none`: No payload.
- `json`: Raw JSON string with block scalar `|`.
- `text`: Plain text.
- `xml`: XML document.
- `graphql`: Contains `body.content` (GraphQL query) and optional `body.variables` (JSON variables string).
- `form`: Array of `{ name, value, enabled }`.
- `multipart`: Array of `{ name, value, type: 'text' | 'file', enabled }`.
- `binary`: File path for raw streaming upload.

---

## 2. Collection Root (`reqit.yaml`)

Defines collection-wide defaults and variables:

```yaml
version: '1.0.0'
name: 'Acme Payments API'
description: 'Core backend services and payment processing collection.'

variables:
  baseUrl: 'https://api.acmepay.com'
  apiVersion: 'v2'
  defaultTimeout: 30000

auth:
  type: 'apikey'
  key: 'X-API-KEY'
  value: '{{apiKey}}'
  in: 'header'
```

---

## 3. Folder Configuration (`folder.yaml`)

Controls display order and execution sequence for the collection runner:

```yaml
version: '1.0.0'
name: 'Authentication'
description: 'OAuth 2.0 and token exchange endpoints.'

# Explicit execution sequence in Runner & UI
order:
  - 'login.yaml'
  - 'verify-mfa.yaml'
  - 'refresh-token.yaml'

variables:
  scope: 'read:users write:users'
```

---

## 4. Environments (`environments/*.yaml`)

Switch between different target infrastructures seamlessly:

```yaml
version: '1.0.0'
name: 'local'
color: '#10b981' # Emerald green badge in UI

variables:
  baseUrl: 'http://localhost:8080'
  dbHost: '127.0.0.1'
  debugLogging: 'true'
```

---

## 5. Secrets File (`.reqit/secrets.yaml`)

Stores sensitive credentials that must never be checked into version control. Reqit automatically checks `.gitignore` on startup to ensure `.reqit/` is ignored:

```yaml
version: '1.0.0'
secrets:
  apiKey: 'live_secret_sk_9a8b7c6d5e4f'
  jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  dbPassword: 'superSecretPassword123'
```

---

## Deterministic Serialization Rules

To guarantee clean, conflict-free Git diffs across operating systems:

1. **Sorted Keys:** Top-level keys (`version`, `name`, `method`, `url`, `headers`, etc.) are written in deterministic order.
2. **2-Space Indentation:** Strict 2-space indentation without tab characters.
3. **LF Line Endings:** All files are normalized to Unix Line Feeds (`\n`) on save.
4. **Multi-line Block Scalars (`|`):** Body content and scripts preserve natural formatting without escaped quotes or ugly inline `\n` characters.
