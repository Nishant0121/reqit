import type { RequestFile } from '../../format/types.js';
import { generateCurl } from '../../curl/stringify.js';
import { resolveRequest } from '../../variables/request.js';
import type { SnippetOptions } from '../types.js';

/**
 * Generates a runnable cURL command snippet.
 */
export function generateCurlSnippet(request: RequestFile, options?: SnippetOptions): string {
  const shouldResolve = options?.resolveVariables !== false;
  const reqToFormat = shouldResolve
    ? resolveRequest(request, options?.scopes ?? {}, { allowUndefined: true })
    : request;

  return generateCurl(reqToFormat, { target: 'bash', multiline: true });
}
