import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as https from 'node:https';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Readable } from 'node:stream';
import * as zlib from 'node:zlib';
import type { KeyValue, RequestFile } from '../format/types.js';
import { prepareAuthHeaders } from './auth.js';
import { prepareRequestBody } from './body.js';
import {
  classifyNetworkError,
  MaxRedirectsError,
  RedirectLoopError,
  RequestAbortedError,
  TimeoutError,
} from './errors.js';
import { TimingTracker } from './timing.js';
import type { ResponseResult, SendOptions } from './types.js';
import { buildTargetUrl } from './url.js';

const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_MAX_IN_MEMORY_BYTES = 5 * 1024 * 1024; // 5 MB

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

function getDecompressedStream(res: http.IncomingMessage, encoding: string): Readable {
  switch (encoding) {
    case 'gzip': {
      const gunzip = zlib.createGunzip();
      res.pipe(gunzip);
      return gunzip;
    }
    case 'deflate': {
      const inflate = zlib.createInflate();
      res.pipe(inflate);
      return inflate;
    }
    case 'br': {
      const brotli = zlib.createBrotliDecompress();
      res.pipe(brotli);
      return brotli;
    }
    default:
      return res;
  }
}

export async function sendRequest(
  resolvedRequest: RequestFile,
  options?: SendOptions,
): Promise<ResponseResult> {
  const startTime = performance.now();

  const targetUrl = buildTargetUrl(
    resolvedRequest.url,
    resolvedRequest.params,
    resolvedRequest.auth,
  );

  const authHeaders = prepareAuthHeaders(resolvedRequest.auth);
  const preparedBody = prepareRequestBody(resolvedRequest.body);

  // Headers: request headers take precedence over defaults
  const headersRecord: Record<string, string> = {};

  // 1. Accept-Encoding default
  headersRecord['accept-encoding'] = 'gzip, deflate, br';

  // 2. Default Content-Type from body
  if (preparedBody.defaultContentType) {
    headersRecord['content-type'] = preparedBody.defaultContentType;
  }

  // 3. Auth headers (e.g. authorization, apiKey in header)
  for (const [k, v] of Object.entries(authHeaders)) {
    headersRecord[k.toLowerCase()] = v;
  }

  // 4. Request-defined headers
  if (resolvedRequest.headers && Array.isArray(resolvedRequest.headers)) {
    for (const h of resolvedRequest.headers) {
      if (h.enabled !== false && h.name) {
        headersRecord[h.name.toLowerCase()] = h.value ?? '';
      }
    }
  }

  // 5. Content-Length for bodies with buffers
  if (preparedBody.buffer && !headersRecord['content-length']) {
    headersRecord['content-length'] = String(preparedBody.buffer.length);
  }

  const isHttps = targetUrl.protocol === 'https:';
  const httpModule = isHttps ? https : http;

  const port = targetUrl.port ? Number(targetUrl.port) : isHttps ? 443 : 80;

  const validateSsl =
    options?.validateSsl ??
    (typeof resolvedRequest.validateSsl === 'boolean' ? resolvedRequest.validateSsl : true);

  const timeoutMs =
    options?.timeoutMs ??
    (typeof resolvedRequest.timeoutMs === 'number' ? resolvedRequest.timeoutMs : undefined);

  const requestOptions: https.RequestOptions = {
    method: resolvedRequest.method || 'GET',
    hostname: targetUrl.hostname,
    port,
    path: targetUrl.pathname + targetUrl.search,
    headers: headersRecord,
    rejectUnauthorized: validateSsl,
    agent: options?.agent,
  };

  const maxInMemoryBytes = options?.maxInMemoryBytes ?? DEFAULT_MAX_IN_MEMORY_BYTES;
  const tempDir = options?.tempDir || os.tmpdir();

  const timingTracker = new TimingTracker(targetUrl.hostname, isHttps);

  return new Promise<ResponseResult>((resolve, reject) => {
    let timer: NodeJS.Timeout | null = null;
    let isSettled = false;
    let tempFilePath: string | null = null;
    let fileStream: fs.WriteStream | null = null;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (options?.signal && abortListener) {
        options.signal.removeEventListener('abort', abortListener);
      }
    };

    const fail = (err: unknown) => {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      if (fileStream) {
        fileStream.destroy();
      }
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch {
          // ignore cleanup error
        }
      }
      const classified = classifyNetworkError(err, {
        hostname: targetUrl.hostname,
        port,
        timeoutMs,
      });
      reject(classified);
    };

    // Check if signal is already aborted
    if (options?.signal?.aborted) {
      fail(new RequestAbortedError());
      return;
    }

    let abortListener: (() => void) | null = null;
    if (options?.signal) {
      abortListener = () => {
        req.destroy(new RequestAbortedError());
        fail(new RequestAbortedError());
      };
      options.signal.addEventListener('abort', abortListener, { once: true });
    }

    const req = httpModule.request(requestOptions, async res => {
      timingTracker.onResponse();

      // Check if redirect should be handled
      const statusCode = res.statusCode ?? 200;
      const followRedirects =
        options?.followRedirects ??
        (typeof resolvedRequest.followRedirects === 'boolean'
          ? resolvedRequest.followRedirects
          : true);

      if (followRedirects && REDIRECT_STATUS_CODES.has(statusCode)) {
        const locationHeader = res.headers.location;
        if (locationHeader) {
          // Drain stream
          res.resume();
          cleanup();

          // Compute timing for this redirect hop
          timingTracker.onEnd();
          const hopTiming = timingTracker.compute();
          const redirectHops = [...(options?.redirectHops ?? []), hopTiming];

          const redirectCount = (options?.redirectCount ?? 0) + 1;
          const maxRedirects = options?.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
          const visitedUrls = [...(options?.visitedUrls ?? []), targetUrl.toString()];

          if (redirectCount > maxRedirects) {
            fail(new MaxRedirectsError(maxRedirects));
            return;
          }

          const nextUrl = new URL(locationHeader, targetUrl).toString();

          if (visitedUrls.includes(nextUrl)) {
            fail(new RedirectLoopError(nextUrl));
            return;
          }

          // Calculate next method and body
          let nextMethod = resolvedRequest.method;
          let nextBody = resolvedRequest.body;

          if (statusCode === 303) {
            nextMethod = 'GET';
            nextBody = undefined;
          } else if (
            (statusCode === 301 || statusCode === 302) &&
            resolvedRequest.method === 'POST'
          ) {
            nextMethod = 'GET';
            nextBody = undefined;
          }

          // Strip Authorization header on cross-origin redirects
          const isCrossOrigin = new URL(nextUrl).origin !== targetUrl.origin;
          let nextHeaders = resolvedRequest.headers;
          let nextAuth = resolvedRequest.auth;

          if (isCrossOrigin) {
            if (nextHeaders) {
              nextHeaders = nextHeaders.filter(h => h.name.toLowerCase() !== 'authorization');
            }
            if (nextAuth) {
              nextAuth = { type: 'none' };
            }
          }

          const nextRequest: RequestFile = {
            ...resolvedRequest,
            method: nextMethod,
            url: nextUrl,
            params: undefined, // query params already in nextUrl
            headers: nextHeaders,
            auth: nextAuth,
            body: nextBody,
          };

          try {
            const redirectResult = await sendRequest(nextRequest, {
              ...options,
              redirectCount,
              visitedUrls,
              redirectHops,
            });
            isSettled = true;
            resolve(redirectResult);
          } catch (redirectErr) {
            fail(redirectErr);
          }
          return;
        }
      }

      // Convert rawHeaders to KeyValue[]
      const responseHeaders: KeyValue[] = [];
      const rawHeaders = res.rawHeaders || [];
      for (let i = 0; i < rawHeaders.length; i += 2) {
        responseHeaders.push({
          name: rawHeaders[i]!,
          value: rawHeaders[i + 1]!,
        });
      }

      const getHeader = (name: string): string | undefined => {
        const lower = name.toLowerCase();
        const found = responseHeaders.find(h => h.name.toLowerCase() === lower);
        return found?.value;
      };

      const encoding = (res.headers['content-encoding'] || '').toLowerCase().trim();
      const contentStream = getDecompressedStream(res, encoding);

      const chunks: Buffer[] = [];
      let totalBytes = 0;

      contentStream.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;

        if (!tempFilePath && totalBytes > maxInMemoryBytes) {
          // Exceeded memory threshold -> start streaming to disk
          tempFilePath = path.join(tempDir, `reqit-response-${crypto.randomUUID()}.tmp`);
          fileStream = fs.createWriteStream(tempFilePath);

          fileStream.on('error', err => {
            fail(err);
          });

          // Flush already buffered chunks to file
          for (const c of chunks) {
            fileStream.write(c);
          }
          chunks.length = 0; // free memory

          fileStream.write(chunk);
        } else if (fileStream) {
          fileStream.write(chunk);
        } else {
          chunks.push(chunk);
        }
      });

      contentStream.on('error', err => {
        fail(err);
      });

      contentStream.on('end', () => {
        if (isSettled) return;
        cleanup();

        timingTracker.onEnd();
        const finalTiming = timingTracker.compute();

        const finishResponse = () => {
          isSettled = true;
          const endTime = performance.now();
          const totalMs = Math.max(0, Math.round(endTime - startTime));

          let bodyContent: string | undefined = undefined;
          let bodyBase64: string | undefined = undefined;

          if (!tempFilePath) {
            const fullBuffer = Buffer.concat(chunks);
            const contentType = getHeader('content-type') || '';
            const mime = contentType.toLowerCase().split(';')[0]?.trim() || '';
            const isBinaryMime =
              (mime.startsWith('image/') && mime !== 'image/svg+xml') ||
              mime.startsWith('audio/') ||
              mime.startsWith('video/') ||
              mime === 'application/pdf' ||
              mime === 'application/octet-stream';

            const isBinaryMagic =
              fullBuffer.length >= 4 &&
              // PNG
              ((fullBuffer[0] === 0x89 &&
                fullBuffer[1] === 0x50 &&
                fullBuffer[2] === 0x4e &&
                fullBuffer[3] === 0x47) ||
                // JPEG
                (fullBuffer[0] === 0xff && fullBuffer[1] === 0xd8 && fullBuffer[2] === 0xff) ||
                // GIF
                (fullBuffer[0] === 0x47 && fullBuffer[1] === 0x49 && fullBuffer[2] === 0x46) ||
                // WEBP
                (fullBuffer.length >= 12 &&
                  fullBuffer.toString('ascii', 0, 4) === 'RIFF' &&
                  fullBuffer.toString('ascii', 8, 12) === 'WEBP'));

            if (isBinaryMime || isBinaryMagic) {
              bodyBase64 = fullBuffer.toString('base64');
              bodyContent = bodyBase64;
            } else {
              bodyContent = fullBuffer.toString('utf-8');
            }
          }

          const jsonHelper = <T = unknown>(): T => {
            if (bodyContent === undefined) {
              throw new Error(
                'Response body was streamed to disk or is empty; cannot parse as JSON directly',
              );
            }
            return JSON.parse(bodyContent) as T;
          };

          const redirectHops = options?.redirectHops;

          resolve({
            status: statusCode,
            statusText: res.statusMessage || '',
            headers: responseHeaders,
            body: bodyContent,
            bodyBase64,
            bodyPath: tempFilePath || undefined,
            sizeBytes: totalBytes,
            totalMs,
            timing: finalTiming,
            redirectHops: redirectHops && redirectHops.length > 0 ? redirectHops : undefined,
            redirects: redirectHops && redirectHops.length > 0 ? redirectHops : undefined,
            getHeader,
            json: jsonHelper,
          });
        };

        if (fileStream) {
          fileStream.end(() => {
            finishResponse();
          });
        } else {
          finishResponse();
        }
      });
    });

    req.on('socket', socket => {
      timingTracker.hookSocket(socket);
    });

    req.on('error', err => {
      fail(err);
    });

    // Timeout handling
    if (timeoutMs && timeoutMs > 0) {
      timer = setTimeout(() => {
        req.destroy(new TimeoutError(timeoutMs));
        fail(new TimeoutError(timeoutMs));
      }, timeoutMs);
    }

    // Write body and finish request
    if (preparedBody.buffer && preparedBody.buffer.length > 0) {
      req.write(preparedBody.buffer);
    }

    req.end();
  });
}
