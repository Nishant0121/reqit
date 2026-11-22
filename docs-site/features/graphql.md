# GraphQL Support & Schema Explorer

Reqit provides full-featured GraphQL support, including schema introspection, interactive schema browsing, and context-aware autocomplete.

---

## 1. Composing GraphQL Queries

1. In any request, set the **Body** tab to **GraphQL**.
2. Reqit splits the editor into two dedicated panels:
   - **Query Editor:** Syntax-highlighted GraphQL query, mutation, or subscription document.
   - **Variables Editor:** JSON editor for parameterized variables passed to the query.

```graphql
query GetUserProfile($id: ID!, $includeHistory: Boolean = false) {
  user(id: $id) {
    id
    username
    email
    orders @include(if: $includeHistory) {
      id
      total
      status
    }
  }
}
```

```json
{
  "id": "usr_9988",
  "includeHistory": true
}
```

---

## 2. Schema Introspection

To enable autocomplete and inspect available types:

1. Enter your GraphQL endpoint in the URL bar (e.g. `https://api.spacex.land/graphql`).
2. Attach any necessary authentication headers (Bearer token, API key, etc.).
3. Click the **Introspect Schema** button in the GraphQL toolbar.
4. Reqit executes a standard GraphQL introspection query and caches the schema definition locally for that endpoint.

---

## 3. Schema Explorer Panel

Click **Schema Explorer** to slide out the interactive type browser:

- **Root Operations:** Browse all available queries, mutations, and subscriptions.
- **Type Definitions:** Inspect object types, scalar types, enums, unions, and input types.
- **Fields & Arguments:** View argument types, required flags (`!`), and descriptions.
- **Click to Insert Snippet:** Click any field or operation in the explorer to generate and insert a starter query snippet directly into your active query editor!

---

## 4. Storage in YAML

GraphQL requests are saved in the exact same portable YAML format:

```yaml
version: '1.0.0'
name: 'Get User Profile'
method: 'POST'
url: '{{graphqlEndpoint}}'

body:
  type: 'graphql'
  content: |
    query GetUserProfile($id: ID!) {
      user(id: $id) {
        id
        email
      }
    }
  variables: |
    {
      "id": "{{userId}}"
    }
```
