import * as http from 'node:http';
import * as https from 'node:https';
import * as tls from 'node:tls';
import type * as stream from 'node:stream';
import type { ProxyOption } from './types.js';

interface AgentWithAddRequest {
  addRequest(req: http.ClientRequest, options: http.ClientRequestArgs): void;
}

/**
 * Checks whether a hostname matches any bypass pattern in the list.
 */
export function isProxyBypassed(hostname: string, bypassPatterns: string[]): boolean {
  const host = hostname.toLowerCase();

  for (const pattern of bypassPatterns) {
    const p = pattern.trim().toLowerCase();
    if (!p) continue;

    // Wildcard pattern (e.g. *.example.com or .example.com)
    if (p.startsWith('*.')) {
      const suffix = p.slice(1); // .example.com
      if (host.endsWith(suffix) || host === p.slice(2)) {
        return true;
      }
    } else if (p.startsWith('.')) {
      if (host.endsWith(p) || host === p.slice(1)) {
        return true;
      }
    } else if (host === p) {
      return true;
    }
  }

  return false;
}

/**
 * Resolves the effective proxy URL for a target URL based on the provided option.
 * Returns null if no proxy should be used.
 */
export function resolveProxyConfig(
  targetUrl: URL,
  proxyOption?: ProxyOption,
): { proxyUrl: string } | null {
  if (!proxyOption || proxyOption === 'none') {
    return null;
  }

  const hostname = targetUrl.hostname;

  // 1. System proxy mode
  if (proxyOption === 'system') {
    // Check NO_PROXY
    const noProxy = process.env.NO_PROXY || process.env.no_proxy;
    if (noProxy) {
      const bypassList = noProxy.split(',').map(s => s.trim());
      if (isProxyBypassed(hostname, bypassList)) {
        return null;
      }
    }

    const isHttps = targetUrl.protocol === 'https:';
    let systemProxy = isHttps
      ? process.env.HTTPS_PROXY || process.env.https_proxy
      : process.env.HTTP_PROXY || process.env.http_proxy;

    if (!systemProxy) {
      systemProxy = process.env.ALL_PROXY || process.env.all_proxy;
    }

    if (!systemProxy) {
      return null;
    }

    return { proxyUrl: systemProxy };
  }

  // 2. Manual proxy mode
  if (typeof proxyOption === 'object' && proxyOption.url) {
    if (proxyOption.bypass && proxyOption.bypass.length > 0) {
      if (isProxyBypassed(hostname, proxyOption.bypass)) {
        return null;
      }
    }

    return { proxyUrl: proxyOption.url };
  }

  return null;
}

/**
 * Creates an HTTP/HTTPS Agent routing requests through an HTTP/HTTPS proxy.
 * Uses HTTP CONNECT tunneling for HTTPS targets.
 */
export function createProxyAgent(
  proxyUrlString: string,
  isTargetHttps: boolean,
  validateSsl: boolean = true,
): http.Agent | https.Agent {
  let proxyUrl: URL;
  try {
    proxyUrl = new URL(
      proxyUrlString.startsWith('http') ? proxyUrlString : `http://${proxyUrlString}`,
    );
  } catch {
    proxyUrl = new URL(`http://${proxyUrlString}`);
  }

  const proxyPort = proxyUrl.port
    ? Number(proxyUrl.port)
    : proxyUrl.protocol === 'https:'
      ? 443
      : 80;
  const proxyHost = proxyUrl.hostname;

  // Case A: Target is HTTPS -> Use HTTP CONNECT tunnel
  if (isTargetHttps) {
    class HttpsProxyAgent extends https.Agent {
      public override createConnection(
        options: http.ClientRequestArgs,
        callback?: (err: Error | null, stream: stream.Duplex) => void,
      ): stream.Duplex | null | undefined {
        const targetHost =
          (options as { host?: string; hostname?: string }).host || options.hostname || 'localhost';
        const targetPort = options.port || 443;

        const connectReq = http.request({
          host: proxyHost,
          port: proxyPort,
          method: 'CONNECT',
          path: `${targetHost}:${targetPort}`,
          headers: {
            Host: `${targetHost}:${targetPort}`,
            ...(proxyUrl.username || proxyUrl.password
              ? {
                  'Proxy-Authorization': `Basic ${Buffer.from(
                    `${decodeURIComponent(proxyUrl.username)}:${decodeURIComponent(proxyUrl.password)}`,
                  ).toString('base64')}`,
                }
              : {}),
          },
        });

        connectReq.on('connect', (_res, socket) => {
          // Tunnel established: upgrade socket with TLS handshake
          const tlsSocket = tls.connect({
            socket,
            host: targetHost,
            servername: targetHost,
            rejectUnauthorized: validateSsl,
          });

          if (callback) {
            callback(null, tlsSocket);
          }
        });

        connectReq.on('error', err => {
          if (callback) {
            callback(err, null as unknown as stream.Duplex);
          }
        });

        connectReq.end();
        return connectReq.socket ?? undefined;
      }
    }

    return new HttpsProxyAgent({ rejectUnauthorized: validateSsl, keepAlive: false });
  }

  // Case B: Target is HTTP -> Forward via proxy HTTP agent
  class HttpProxyAgent extends http.Agent {
    public addRequest(req: http.ClientRequest, options: http.ClientRequestArgs): void {
      // Direct raw request to proxy, target path must be absolute URL
      const targetHost =
        (options as { host?: string; hostname?: string }).host || options.hostname || 'localhost';
      const targetPort = options.port || 80;
      const targetPath = options.path || '/';

      const fullUrl = `http://${targetHost}:${targetPort}${targetPath}`;
      req.path = fullUrl;

      if (proxyUrl.username || proxyUrl.password) {
        req.setHeader(
          'Proxy-Authorization',
          `Basic ${Buffer.from(
            `${decodeURIComponent(proxyUrl.username)}:${decodeURIComponent(proxyUrl.password)}`,
          ).toString('base64')}`,
        );
      }

      const proxyOptions = {
        ...options,
        host: proxyHost,
        hostname: proxyHost,
        port: proxyPort,
      };

      const superAddRequest = (http.Agent.prototype as unknown as AgentWithAddRequest).addRequest;
      if (typeof superAddRequest === 'function') {
        superAddRequest.call(this, req, proxyOptions);
      }
    }
  }

  return new HttpProxyAgent({ keepAlive: false });
}
