import type { HttpMethod, RequestFile, KeyValue } from '../format/types.js';
import type { CurlParseResult, ParsedCurlOptions } from './types.js';
import { tokenizeCurl } from './tokenize.js';

const FLAGS_WITH_ARGUMENT = new Set([
  '-o',
  '--output',
  '-x',
  '--proxy',
  '-E',
  '--cert',
  '--cacert',
  '--key',
  '-c',
  '--cookie-jar',
  '-D',
  '--dump-header',
  '--interface',
  '--retry',
  '-w',
  '--write-out',
]);

/**
 * Derives a human-readable request name from method and URL.
 */
function deriveRequestName(method: string, urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    const pathname = parsed.pathname === '/' ? '' : parsed.pathname;
    if (pathname) {
      return `${method} ${pathname}`;
    }
    return `${method} ${parsed.hostname}`;
  } catch {
    return `${method} request`;
  }
}

/**
 * Parses a raw cURL command into a standard Reqit RequestFile.
 */
export function parseCurl(command: string): CurlParseResult {
  const tokens = tokenizeCurl(command);
  const warnings: string[] = [];

  const parsed: ParsedCurlOptions = {
    headers: [],
    params: [],
    dataChunks: [],
    urlEncodeChunks: [],
    formFields: [],
    warnings,
  };

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i]!;

    // 1. Method: -X, --request
    if (token === '-X' || token === '--request') {
      i++;
      if (i < tokens.length) {
        parsed.method = tokens[i]!.toUpperCase() as HttpMethod;
      }
    } else if (token.startsWith('-X') && token.length > 2) {
      parsed.method = token.slice(2).toUpperCase() as HttpMethod;
    } else if (token.startsWith('--request=')) {
      parsed.method = token.slice(10).toUpperCase() as HttpMethod;
    }

    // 2. URL: --url
    else if (token === '--url') {
      i++;
      if (i < tokens.length) {
        parsed.url = tokens[i];
      }
    } else if (token.startsWith('--url=')) {
      parsed.url = token.slice(6);
    }

    // 3. Headers: -H, --header
    else if (token === '-H' || token === '--header') {
      i++;
      if (i < tokens.length) {
        const headerStr = tokens[i]!;
        const colonIdx = headerStr.indexOf(':');
        if (colonIdx > 0) {
          const name = headerStr.slice(0, colonIdx).trim();
          const value = headerStr.slice(colonIdx + 1).trim();
          parsed.headers.push({ name, value, enabled: true });
        } else if (headerStr.endsWith(';')) {
          // Special curl syntax: -H "X-Custom;" removes header or sends empty value
          const name = headerStr.slice(0, -1).trim();
          parsed.headers.push({ name, value: '', enabled: true });
        } else {
          parsed.headers.push({ name: headerStr.trim(), value: '', enabled: true });
        }
      }
    } else if (token.startsWith('--header=')) {
      const headerStr = token.slice(9);
      const colonIdx = headerStr.indexOf(':');
      if (colonIdx > 0) {
        const name = headerStr.slice(0, colonIdx).trim();
        const value = headerStr.slice(colonIdx + 1).trim();
        parsed.headers.push({ name, value, enabled: true });
      }
    }

    // 4. Data / Body: -d, --data, --data-raw, --data-binary, --data-ascii
    else if (
      token === '-d' ||
      token === '--data' ||
      token === '--data-raw' ||
      token === '--data-binary' ||
      token === '--data-ascii'
    ) {
      i++;
      if (i < tokens.length) {
        parsed.dataChunks.push(tokens[i]!);
      }
    } else if (token.startsWith('-d') && token.length > 2) {
      parsed.dataChunks.push(token.slice(2));
    } else if (
      token.startsWith('--data=') ||
      token.startsWith('--data-raw=') ||
      token.startsWith('--data-binary=') ||
      token.startsWith('--data-ascii=')
    ) {
      const eqIdx = token.indexOf('=');
      parsed.dataChunks.push(token.slice(eqIdx + 1));
    }

    // 5. URL-encoded data: --data-urlencode
    else if (token === '--data-urlencode') {
      i++;
      if (i < tokens.length) {
        const raw = tokens[i]!;
        const eqIdx = raw.indexOf('=');
        if (eqIdx > 0) {
          parsed.urlEncodeChunks.push({
            name: raw.slice(0, eqIdx),
            value: raw.slice(eqIdx + 1),
          });
        } else if (raw.startsWith('=')) {
          parsed.urlEncodeChunks.push({
            value: raw.slice(1),
          });
        } else {
          parsed.urlEncodeChunks.push({
            value: raw,
          });
        }
      }
    } else if (token.startsWith('--data-urlencode=')) {
      const raw = token.slice(17);
      const eqIdx = raw.indexOf('=');
      if (eqIdx > 0) {
        parsed.urlEncodeChunks.push({
          name: raw.slice(0, eqIdx),
          value: raw.slice(eqIdx + 1),
        });
      } else {
        parsed.urlEncodeChunks.push({ value: raw });
      }
    }

    // 6. Multipart Form: -F, --form, --form-string
    else if (token === '-F' || token === '--form' || token === '--form-string') {
      i++;
      if (i < tokens.length) {
        const formStr = tokens[i]!;
        const eqIdx = formStr.indexOf('=');
        if (eqIdx > 0) {
          const name = formStr.slice(0, eqIdx);
          let value = formStr.slice(eqIdx + 1);
          let isFile = false;
          let fileName: string | undefined = undefined;
          let contentType: string | undefined = undefined;

          // Check for @filepath
          if (value.startsWith('@')) {
            isFile = true;
            value = value.slice(1);

            // Check for ;type=mime/type
            const typeIdx = value.indexOf(';type=');
            if (typeIdx > 0) {
              contentType = value.slice(typeIdx + 6);
              value = value.slice(0, typeIdx);
            }

            // Check for ;filename=customname
            const fnIdx = value.indexOf(';filename=');
            if (fnIdx > 0) {
              fileName = value.slice(fnIdx + 10);
              value = value.slice(0, fnIdx);
            }
          }

          parsed.formFields.push({
            name,
            value,
            isFile,
            fileName,
            contentType,
          });
        }
      }
    }

    // 7. Basic Auth: -u, --user
    else if (token === '-u' || token === '--user') {
      i++;
      if (i < tokens.length) {
        const userStr = tokens[i]!;
        const colonIdx = userStr.indexOf(':');
        if (colonIdx >= 0) {
          parsed.user = {
            username: userStr.slice(0, colonIdx),
            password: userStr.slice(colonIdx + 1),
          };
        } else {
          parsed.user = { username: userStr, password: '' };
        }
      }
    } else if (token.startsWith('-u') && token.length > 2) {
      const userStr = token.slice(2);
      const colonIdx = userStr.indexOf(':');
      if (colonIdx >= 0) {
        parsed.user = {
          username: userStr.slice(0, colonIdx),
          password: userStr.slice(colonIdx + 1),
        };
      } else {
        parsed.user = { username: userStr, password: '' };
      }
    } else if (token.startsWith('--user=')) {
      const userStr = token.slice(7);
      const colonIdx = userStr.indexOf(':');
      if (colonIdx >= 0) {
        parsed.user = {
          username: userStr.slice(0, colonIdx),
          password: userStr.slice(colonIdx + 1),
        };
      } else {
        parsed.user = { username: userStr, password: '' };
      }
    }

    // 8. User-Agent: -A, --user-agent
    else if (token === '-A' || token === '--user-agent') {
      i++;
      if (i < tokens.length) {
        parsed.headers.push({ name: 'User-Agent', value: tokens[i]!, enabled: true });
      }
    } else if (token.startsWith('--user-agent=')) {
      parsed.headers.push({ name: 'User-Agent', value: token.slice(13), enabled: true });
    }

    // 9. Cookie: -b, --cookie
    else if (token === '-b' || token === '--cookie') {
      i++;
      if (i < tokens.length) {
        const val = tokens[i]!;
        if (val.includes('=')) {
          parsed.headers.push({ name: 'Cookie', value: val, enabled: true });
        } else {
          warnings.push(`Cookie jar file reading from '${val}' is not supported directly.`);
        }
      }
    } else if (token.startsWith('--cookie=')) {
      const val = token.slice(9);
      if (val.includes('=')) {
        parsed.headers.push({ name: 'Cookie', value: val, enabled: true });
      }
    }

    // 10. Referer: -e, --referer
    else if (token === '-e' || token === '--referer') {
      i++;
      if (i < tokens.length) {
        parsed.headers.push({ name: 'Referer', value: tokens[i]!, enabled: true });
      }
    }

    // 11. Follow Redirects: -L, --location
    else if (token === '-L' || token === '--location') {
      parsed.followRedirects = true;
    }

    // 12. Insecure / Skip SSL: -k, --insecure
    else if (token === '-k' || token === '--insecure') {
      parsed.validateSsl = false;
    }

    // 13. Compressed: --compressed
    else if (token === '--compressed') {
      parsed.compressed = true;
      const hasEncoding = parsed.headers.some(h => h.name.toLowerCase() === 'accept-encoding');
      if (!hasEncoding) {
        parsed.headers.push({
          name: 'Accept-Encoding',
          value: 'gzip, deflate, br',
          enabled: true,
        });
      }
    }

    // 14. Timeout: -m, --max-time
    else if (token === '-m' || token === '--max-time') {
      i++;
      if (i < tokens.length) {
        const secs = parseFloat(tokens[i]!);
        if (!isNaN(secs)) {
          parsed.timeoutMs = Math.round(secs * 1000);
        }
      }
    }

    // 15. Head request: -I, --head
    else if (token === '-I' || token === '--head') {
      parsed.method = 'HEAD';
    }

    // 16. Skip / Warn on common unsupported flags with argument
    else if (FLAGS_WITH_ARGUMENT.has(token)) {
      i++; // skip argument
      warnings.push(`Option '${token} ${tokens[i] || ''}' was ignored.`);
    }

    // 17. Skip silent/verbose/misc flags
    else if (
      token === '-s' ||
      token === '--silent' ||
      token === '-S' ||
      token === '--show-error' ||
      token === '-v' ||
      token === '--verbose' ||
      token === '-i' ||
      token === '--include' ||
      token === '-N' ||
      token === '--no-buffer'
    ) {
      // Ignored non-protocol flags
    }

    // 18. Positional argument: target URL
    else if (!token.startsWith('-')) {
      if (!parsed.url) {
        parsed.url = token;
      } else {
        warnings.push(`Unrecognized positional argument '${token}' was ignored.`);
      }
    }

    // 19. Unrecognized flag
    else {
      warnings.push(`Unrecognized flag '${token}' was ignored.`);
    }

    i++;
  }

  // Finalize URL
  let finalUrl = parsed.url?.trim() || '';
  if (!finalUrl) {
    finalUrl = 'https://httpbin.org/get';
    warnings.push('No URL specified in cURL command; defaulted to https://httpbin.org/get.');
  } else if (!/^https?:\/\//i.test(finalUrl) && !finalUrl.startsWith('{{')) {
    // If protocol missing and not starting with a template variable, default to http://
    finalUrl = `http://${finalUrl}`;
  }

  // Extract query parameters from URL if present
  const extractedParams: KeyValue[] = [];
  try {
    const parsedObj = new URL(finalUrl);
    parsedObj.searchParams.forEach((val, key) => {
      extractedParams.push({ name: key, value: val, enabled: true });
    });
  } catch {
    // Ignore URL parse error
  }

  // Finalize Method
  let finalMethod = parsed.method;
  if (!finalMethod) {
    if (
      parsed.dataChunks.length > 0 ||
      parsed.urlEncodeChunks.length > 0 ||
      parsed.formFields.length > 0
    ) {
      finalMethod = 'POST';
    } else {
      finalMethod = 'GET';
    }
  }

  // Finalize Auth
  let auth: RequestFile['auth'] = undefined;
  if (parsed.user) {
    auth = {
      type: 'basic',
      basic: {
        username: parsed.user.username,
        password: parsed.user.password || '',
      },
    };
  } else {
    // Check if Authorization header is present
    const authHdr = parsed.headers.find(h => h.name.toLowerCase() === 'authorization');
    if (authHdr && authHdr.value.startsWith('Bearer ')) {
      auth = {
        type: 'bearer',
        bearer: {
          token: authHdr.value.slice(7).trim(),
        },
      };
    }
  }

  // Finalize Body
  let body: RequestFile['body'] = undefined;

  // Case A: Multipart form (-F)
  if (parsed.formFields.length > 0) {
    body = {
      type: 'multipart',
      form: parsed.formFields.map(f => ({
        name: f.name,
        value: f.value,
        isFile: f.isFile,
        fileName: f.fileName,
        description: f.contentType,
      })),
    };
    // Clean up explicit multipart Content-Type header (browser/engine attaches boundary)
    parsed.headers = parsed.headers.filter(
      h =>
        !h.name.toLowerCase().startsWith('content-type') ||
        !h.value.toLowerCase().includes('multipart'),
    );
  }
  // Case B: URL-encoded chunks (--data-urlencode)
  else if (parsed.urlEncodeChunks.length > 0) {
    const encodedBody = parsed.urlEncodeChunks
      .map(chunk => {
        if (chunk.name) {
          return `${encodeURIComponent(chunk.name)}=${encodeURIComponent(chunk.value)}`;
        }
        return encodeURIComponent(chunk.value);
      })
      .join('&');

    const fullContent =
      parsed.dataChunks.length > 0 ? `${parsed.dataChunks.join('&')}&${encodedBody}` : encodedBody;

    body = {
      type: 'form',
      content: fullContent,
      form: parsed.urlEncodeChunks
        .filter(c => Boolean(c.name))
        .map(c => ({ name: c.name!, value: c.value })),
    };

    const hasContentType = parsed.headers.some(h => h.name.toLowerCase() === 'content-type');
    if (!hasContentType) {
      parsed.headers.push({
        name: 'Content-Type',
        value: 'application/x-www-form-urlencoded',
        enabled: true,
      });
    }
  }
  // Case C: Raw / JSON data chunks (-d, --data, --data-raw)
  else if (parsed.dataChunks.length > 0) {
    const combinedData = parsed.dataChunks.join('&');
    const isJsonHeader = parsed.headers.some(
      h => h.name.toLowerCase() === 'content-type' && h.value.toLowerCase().includes('json'),
    );

    let isJson = false;
    let formattedJson = combinedData;

    const trimmed = combinedData.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        const parsedJson = JSON.parse(trimmed);
        formattedJson = JSON.stringify(parsedJson, null, 2);
        isJson = true;
      } catch {
        isJson = false;
      }
    }

    if (isJson || isJsonHeader) {
      body = {
        type: 'json',
        content: isJson ? formattedJson : combinedData,
      };
      if (!isJsonHeader) {
        parsed.headers.push({
          name: 'Content-Type',
          value: 'application/json',
          enabled: true,
        });
      }
    } else {
      body = {
        type: 'text',
        content: combinedData,
      };
    }
  } else {
    body = {
      type: 'none',
    };
  }

  const name = deriveRequestName(finalMethod, finalUrl);

  const request: RequestFile = {
    version: 1,
    name,
    method: finalMethod,
    url: finalUrl,
    headers: parsed.headers.length > 0 ? parsed.headers : undefined,
    params: extractedParams.length > 0 ? extractedParams : undefined,
    auth,
    body,
    followRedirects: parsed.followRedirects,
    validateSsl: parsed.validateSsl,
    timeoutMs: parsed.timeoutMs,
  };

  return { request, warnings };
}
