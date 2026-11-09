export interface OAuthTokenResult {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  expiresAt?: number;
  scope?: string;
  raw?: Record<string, unknown>;
}

export interface AuthCodeUrlOptions {
  authUrl: string;
  clientId: string;
  redirectUri: string;
  scope?: string;
  state?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}

export interface ExchangeCodeOptions {
  tokenUrl: string;
  code: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  codeVerifier?: string;
}

export interface ClientCredentialsOptions {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
}

/**
 * Builds the Authorization Code URL with query parameters.
 */
export function buildAuthorizationUrl(options: AuthCodeUrlOptions): string {
  const url = new URL(options.authUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', options.clientId);
  url.searchParams.set('redirect_uri', options.redirectUri);

  if (options.scope) {
    url.searchParams.set('scope', options.scope);
  }
  if (options.state) {
    url.searchParams.set('state', options.state);
  }
  if (options.codeChallenge) {
    url.searchParams.set('code_challenge', options.codeChallenge);
    url.searchParams.set('code_challenge_method', options.codeChallengeMethod || 'S256');
  }

  return url.toString();
}

/**
 * Exchanges an authorization code for access and refresh tokens.
 */
export async function exchangeAuthorizationCode(
  options: ExchangeCodeOptions,
): Promise<OAuthTokenResult> {
  const bodyParams = new URLSearchParams();
  bodyParams.set('grant_type', 'authorization_code');
  bodyParams.set('code', options.code);
  bodyParams.set('client_id', options.clientId);
  bodyParams.set('redirect_uri', options.redirectUri);

  if (options.clientSecret) {
    bodyParams.set('client_secret', options.clientSecret);
  }
  if (options.codeVerifier) {
    bodyParams.set('code_verifier', options.codeVerifier);
  }

  const res = await fetch(options.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: bodyParams.toString(),
  });

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `Token endpoint returned non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`,
    );
  }

  if (!res.ok || json.error) {
    const errorMsg = String(json.error_description || json.error || `HTTP ${res.status}`);
    throw new Error(`OAuth token exchange failed: ${errorMsg}`);
  }

  const accessToken = String(json.access_token || '');
  if (!accessToken) {
    throw new Error('Token endpoint did not return an access_token');
  }

  const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : undefined;
  const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : undefined;

  return {
    accessToken,
    refreshToken: typeof json.refresh_token === 'string' ? json.refresh_token : undefined,
    tokenType: typeof json.token_type === 'string' ? json.token_type : 'Bearer',
    expiresIn,
    expiresAt,
    scope: typeof json.scope === 'string' ? json.scope : undefined,
    raw: json,
  };
}

/**
 * Requests an access token using Client Credentials grant.
 */
export async function fetchClientCredentialsToken(
  options: ClientCredentialsOptions,
): Promise<OAuthTokenResult> {
  const bodyParams = new URLSearchParams();
  bodyParams.set('grant_type', 'client_credentials');
  bodyParams.set('client_id', options.clientId);
  bodyParams.set('client_secret', options.clientSecret);

  if (options.scope) {
    bodyParams.set('scope', options.scope);
  }

  // Also support HTTP Basic Auth for client_id:client_secret if endpoint expects it
  const basicAuth = Buffer.from(`${options.clientId}:${options.clientSecret}`).toString('base64');

  const res = await fetch(options.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      Authorization: `Basic ${basicAuth}`,
    },
    body: bodyParams.toString(),
  });

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `Token endpoint returned non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`,
    );
  }

  if (!res.ok || json.error) {
    const errorMsg = String(json.error_description || json.error || `HTTP ${res.status}`);
    throw new Error(`Client credentials authentication failed: ${errorMsg}`);
  }

  const accessToken = String(json.access_token || '');
  if (!accessToken) {
    throw new Error('Token endpoint did not return an access_token');
  }

  const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : undefined;
  const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : undefined;

  return {
    accessToken,
    refreshToken: typeof json.refresh_token === 'string' ? json.refresh_token : undefined,
    tokenType: typeof json.token_type === 'string' ? json.token_type : 'Bearer',
    expiresIn,
    expiresAt,
    scope: typeof json.scope === 'string' ? json.scope : undefined,
    raw: json,
  };
}
