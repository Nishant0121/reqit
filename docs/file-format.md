# Reqit File Format Specification (v1)

This document defines the schema, serialization rules, and directory layout for Reqit collections. Every Reqit collection is stored as transparent, human-readable YAML files directly on the filesystem.

---

## 1. Directory Structure Overview

A Reqit collection is a folder on disk containing:

```text
my-api-collection/
├── reqit.yaml                      # Collection metadata and global defaults
├── folder.yaml                     # (Optional) Folder metadata & ordering
├── environments/                   # Shared environments (version-controlled)
│   ├── dev.yaml
│   ├── staging.yaml
│   └── prod.yaml
├── .reqit/                         # Machine-local state (gitignored by default)
│   └── secrets.yaml                # Secret tokens, passwords, and private keys
├── Users/
│   ├── folder.yaml                 # Folder ordering and folder-level variables
│   ├── Get User.yaml
│   └── Create User.yaml
└── Auth/
    ├── Login.yaml
    └── Refresh Token.yaml
```

---

## 2. Collection Root (`reqit.yaml`)

Every collection must have a `reqit.yaml` in its root directory.

```yaml
version: 1
name: Petstore API
description: Full petstore REST API collection
defaults:
  headers:
    - name: Accept
      value: application/json
      enabled: true
  variables:
    baseUrl: https://api.petstore.com/v1
```

### Schema

| Field                | Type     | Required | Description                           |
| -------------------- | -------- | -------- | ------------------------------------- |
| `version`            | `number` | Yes      | Schema version (currently `1`)        |
| `name`               | `string` | Yes      | Human-readable collection name        |
| `description`        | `string` | No       | Description of the collection         |
| `defaults`           | `object` | No       | Collection-wide defaults              |
| `defaults.headers`   | `array`  | No       | Default headers added to all requests |
| `defaults.variables` | `object` | No       | Default variable values               |

---

## 3. Folder Metadata (`folder.yaml`)

Optional metadata file placed inside a subdirectory to control folder ordering and folder-level variables.

```yaml
version: 1
name: User Management
description: Endpoints for user lifecycle management
order:
  - Get User.yaml
  - Create User.yaml
  - Update User.yaml
  - Delete User.yaml
variables:
  userPrefix: /users
```

### Schema

| Field         | Type       | Required | Description                                               |
| ------------- | ---------- | -------- | --------------------------------------------------------- |
| `version`     | `number`   | Yes      | Schema version (`1`)                                      |
| `name`        | `string`   | No       | Custom folder display name                                |
| `description` | `string`   | No       | Description of the folder                                 |
| `order`       | `string[]` | No       | Array of filenames/folder names determining display order |
| `variables`   | `object`   | No       | Folder-scoped variable overrides                          |

---

## 4. Request Files (`<name>.yaml`)

Each API request is stored in its own `.yaml` file.

```yaml
version: 1
name: Create Pet
method: POST
url: '{{baseUrl}}/pets'
params:
  - name: validate
    value: 'true'
    enabled: true
headers:
  - name: Content-Type
    value: application/json
    enabled: true
auth:
  type: bearer
  token: '{{apiToken}}'
body:
  type: json
  content: |
    {
      "name": "Fido",
      "tag": "dog"
    }
```

### Supported HTTP Methods

`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`

### Supported Body Types

- `none`: No request body
- `json`: Raw JSON string (stored with YAML `|` block scalar)
- `text`: Plain text string
- `xml`: XML document string
- `form-urlencoded`: Key-value form parameters
- `form-data`: Multipart form fields (text or file paths)
- `binary`: File path for streaming upload

### Supported Auth Types

- `none`: No authentication
- `bearer`: Bearer token (`token`)
- `basic`: HTTP Basic (`username`, `password`)
- `api-key`: API key in header or query parameter (`name`, `value`, `in: 'header' | 'query'`)
- `oauth2`: Client credentials or authorization code

---

## 5. Environments (`environments/<name>.yaml`)

Environments store non-sensitive variables shared across the team and checked into Git.

```yaml
version: 1
name: dev
variables:
  baseUrl: https://dev-api.example.com
  port: 8080
  apiVersion: v1
```

---

## 6. Secrets (`.reqit/secrets.yaml`)

Sensitive values (passwords, live tokens, private keys) are isolated in `.reqit/secrets.yaml`. Reqit ensures `.reqit/` is included in `.gitignore`.

```yaml
version: 1
environments:
  dev:
    apiToken: dev_secret_token_12345
  prod:
    apiToken: prod_live_secret_99887
```

---

## 7. Deterministic Serialization & Git Friendliness

To ensure clean `git diff`s without phantom modifications:

1. **Fixed Key Ordering**: Fields are always written in canonical order:
   - Request: `version`, `name`, `description`, `method`, `url`, `params`, `headers`, `auth`, `body`, `settings`
2. **Predictable Quoting**: Strings that YAML parsers could interpret as booleans (`yes`, `no`, `true`), numbers, or special directives (starting with `{`, `[`, `*`, `&`, `!`, `%`, `@`) are automatically double-quoted.
3. **Block Scalars**: Multi-line bodies, JSON payloads, and scripts are consistently serialized using `|` block scalars.
4. **Preserved Fields**: Unknown or third-party extension fields are preserved across round-trip edits.
