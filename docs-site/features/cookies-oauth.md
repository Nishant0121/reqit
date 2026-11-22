# Cookies & OAuth 2.0 PKCE

Reqit includes enterprise-grade session cookie management and native OAuth 2.0 authorization flows.

---

## 1. Automatic Session Cookie Jar

When testing stateful web APIs, Reqit maintains an RFC 6265 compliant cookie jar per collection:

- **Automatic Capture:** Any response containing `Set-Cookie` headers is parsed and securely stored in the collection's cookie jar.
- **Automatic Forwarding:** Outgoing requests automatically send matching `Cookie` headers based on host domain, path, and expiry rules.
- **Disabling per Request:** If you need to test stateless authentication or raw requests without session cookies, toggle **Disable Cookie Jar** in the request Auth tab.

### The Cookie Manager Modal

To inspect or modify your session cookies:

1. In the top bar, click the **Cookie icon** (or press <kbd>Ctrl+K</kbd> $\rightarrow$ _Manage Cookies_).
2. Filter cookies by domain (e.g. `api.example.com`).
3. Add custom session tokens manually.
4. Delete expired cookies or click **Clear All Cookies** for a clean session state.

---

## 2. Native OAuth 2.0 Authentication

Reqit automates complex OAuth 2.0 token acquisition without requiring manual browser copy-pasting.

### Flow 1: Authorization Code Flow with PKCE

Recommended for modern single-page apps and public clients:

1. Select **Auth $\rightarrow$ OAuth 2.0** in your request.
2. Select Grant Type: **Authorization Code (with PKCE)**.
3. Configure:
   - **Auth URL:** e.g. `https://auth.example.com/oauth/authorize`
   - **Token URL:** e.g. `https://auth.example.com/oauth/token`
   - **Client ID:** Your application client ID.
   - **Scope:** e.g. `openid profile email`
4. Click **Get New Access Token**:
   - Reqit generates a cryptographic code verifier and SHA-256 `code_challenge`.
   - Reqit launches a temporary local HTTP loopback server (e.g. `http://127.0.0.1:49152/callback`).
   - Your system browser opens the authorization page.
   - Upon login, the authorization code is redirected to Reqit's local server.
   - Reqit automatically exchanges the code and code verifier for an access token!

### Flow 2: Client Credentials Flow

For machine-to-machine backend authentication:

1. Select Grant Type: **Client Credentials**.
2. Enter Token URL, Client ID, and Client Secret (stored safely using `&#123;&#123;clientSecret&#125;&#125;`).
3. Click **Fetch Token**. Reqit executes the token exchange and automatically attaches the resulting `Bearer <token>` to the outgoing request.
