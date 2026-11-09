import * as http from 'node:http';
import * as crypto from 'node:crypto';
import { shell } from 'electron';
import {
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  fetchClientCredentialsToken,
  generateCodeChallenge,
  generateCodeVerifier,
  type OAuthTokenResult,
  loadSecrets,
} from '@reqit/core';
import { fileService } from './file-service.js';

import type { OAuthAuthCodeConfig, OAuthClientCredentialsConfig } from '../../shared/ipc-types.js';

export type { OAuthAuthCodeConfig, OAuthClientCredentialsConfig };

export class OAuthService {
  /**
   * Performs Authorization Code Grant flow with PKCE and a local loopback server.
   */
  public async startAuthCodeFlow(config: OAuthAuthCodeConfig): Promise<OAuthTokenResult> {
    const defaultPort = 41920;
    const redirectUri = config.redirectUri || `http://127.0.0.1:${defaultPort}/callback`;
    const targetUrlObj = new URL(redirectUri);
    const port = Number(targetUrlObj.port) || defaultPort;

    const usePkce = config.usePkce !== false;
    let codeVerifier: string | undefined = undefined;
    let codeChallenge: string | undefined = undefined;

    if (usePkce) {
      codeVerifier = generateCodeVerifier(64);
      codeChallenge = generateCodeChallenge(codeVerifier);
    }

    const state = crypto.randomBytes(16).toString('hex');

    const authUrl = buildAuthorizationUrl({
      authUrl: config.authUrl,
      clientId: config.clientId,
      redirectUri,
      scope: config.scope,
      state,
      codeChallenge,
      codeChallengeMethod: usePkce ? 'S256' : undefined,
    });

    // Start loopback HTTP server to receive authorization code
    const code = await new Promise<string>((resolve, reject) => {
      const server: http.Server = http.createServer((req, res) => {
        const reqUrl = new URL(req.url || '/', `http://127.0.0.1:${port}`);

        if (reqUrl.pathname === targetUrlObj.pathname) {
          clearTimeout(timeout);
          const returnedCode = reqUrl.searchParams.get('code');
          const returnedState = reqUrl.searchParams.get('state');
          const error = reqUrl.searchParams.get('error');
          const errorDesc = reqUrl.searchParams.get('error_description');

          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <!DOCTYPE html>
              <html>
                <head><title>Reqit Authentication Failed</title><style>body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; } .card { background: #1e293b; padding: 2rem; border-radius: 8px; text-align: center; border: 1px solid #ef4444; } h2 { color: #f87171; margin-top: 0; } p { color: #94a3b8; }</style></head>
                <body>
                  <div class="card">
                    <h2>Authentication Failed</h2>
                    <p>${error}: ${errorDesc || 'Access denied'}</p>
                  </div>
                </body>
              </html>
            `);
            server.close();
            reject(new Error(`OAuth authorization denied: ${error} (${errorDesc || ''})`));
            return;
          }

          if (returnedState !== state) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('State mismatch error');
            server.close();
            reject(new Error('OAuth state parameter mismatch (possible CSRF)'));
            return;
          }

          if (!returnedCode) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Missing code parameter');
            server.close();
            reject(new Error('OAuth callback did not return a code parameter'));
            return;
          }

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <!DOCTYPE html>
            <html>
              <head><title>Reqit Authentication Successful</title><style>body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; } .card { background: #1e293b; padding: 2rem; border-radius: 8px; text-align: center; border: 1px solid #10b981; } h2 { color: #34d399; margin-top: 0; } p { color: #94a3b8; }</style></head>
              <body>
                <div class="card">
                  <h2>Authentication Successful!</h2>
                  <p>You can now close this tab and return to Reqit.</p>
                </div>
              </body>
            </html>
          `);

          server.close();
          resolve(returnedCode);
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });

      const timeout = setTimeout(() => {
        try {
          server.close();
        } catch {
          // Ignore error if server is already closed
        }
        reject(new Error('OAuth authorization timed out (2 minutes)'));
      }, 120000);

      server.on('error', err => {
        clearTimeout(timeout);
        reject(new Error(`Failed to bind OAuth loopback server on port ${port}: ${err.message}`));
      });

      server.listen(port, '127.0.0.1', () => {
        // Open authorization URL in default system browser
        shell.openExternal(authUrl);
      });
    });

    // Exchange authorization code for tokens
    const tokenResult = await exchangeAuthorizationCode({
      tokenUrl: config.tokenUrl,
      code,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri,
      codeVerifier,
    });

    // Save token to .reqit/secrets.yaml if collection path is available
    await this.persistTokenToSecrets(config, tokenResult);

    return tokenResult;
  }

  /**
   * Fetches an access token using Client Credentials grant.
   */
  public async fetchClientCredentials(
    config: OAuthClientCredentialsConfig,
  ): Promise<OAuthTokenResult> {
    const tokenResult = await fetchClientCredentialsToken({
      tokenUrl: config.tokenUrl,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      scope: config.scope,
    });

    await this.persistTokenToSecrets(config, tokenResult);
    return tokenResult;
  }

  private async persistTokenToSecrets(
    config: { collectionPath?: string; activeEnvironment?: string; tokenName?: string },
    tokenResult: OAuthTokenResult,
  ): Promise<void> {
    if (!config.collectionPath) return;

    try {
      const secrets = (await loadSecrets(config.collectionPath)) || {
        version: 1,
        environments: {},
      };
      const envName =
        config.activeEnvironment && config.activeEnvironment !== 'none'
          ? config.activeEnvironment
          : 'default';

      if (!secrets.environments[envName]) {
        secrets.environments[envName] = {};
      }

      const keyName = config.tokenName || 'oauth_access_token';
      secrets.environments[envName]![keyName] = tokenResult.accessToken;

      if (tokenResult.refreshToken) {
        secrets.environments[envName]![`${keyName}_refresh`] = tokenResult.refreshToken;
      }

      await fileService.saveSecrets({ rootPath: config.collectionPath, secrets });
    } catch (err) {
      console.error('Failed to store OAuth token into secrets file:', err);
    }
  }
}

export const oauthService = new OAuthService();
