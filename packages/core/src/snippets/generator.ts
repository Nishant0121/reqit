import type { RequestFile } from '../format/types.js';
import type { SnippetOptions, SnippetTarget, SnippetTargetInfo } from './types.js';
import { generateCurlSnippet } from './targets/curl.js';
import { generateFetchSnippet } from './targets/fetch.js';
import { generateAxiosSnippet } from './targets/axios.js';
import { generatePythonSnippet } from './targets/python.js';
import { generateNodeHttpSnippet } from './targets/node-http.js';
import { generateGoSnippet } from './targets/go.js';
import { generateJavaSnippet } from './targets/java.js';

export const SNIPPET_TARGETS: SnippetTargetInfo[] = [
  {
    id: 'curl',
    name: 'cURL',
    category: 'Shell',
    description: 'cURL command-line tool (Bash/POSIX syntax)',
    syntaxMode: 'bash',
    extension: 'sh',
  },
  {
    id: 'fetch',
    name: 'JavaScript (fetch)',
    category: 'JavaScript',
    description: 'Native fetch API (modern browsers and Node.js 18+)',
    syntaxMode: 'javascript',
    extension: 'js',
  },
  {
    id: 'axios',
    name: 'JavaScript (axios)',
    category: 'JavaScript',
    description: 'Axios promise-based HTTP client',
    syntaxMode: 'javascript',
    extension: 'js',
  },
  {
    id: 'python',
    name: 'Python (requests)',
    category: 'Python',
    description: 'Python requests library',
    syntaxMode: 'python',
    extension: 'py',
  },
  {
    id: 'node-http',
    name: 'Node.js (http)',
    category: 'Node.js',
    description: 'Native Node.js http and https modules',
    syntaxMode: 'javascript',
    extension: 'js',
  },
  {
    id: 'go',
    name: 'Go (net/http)',
    category: 'Go',
    description: 'Go standard library net/http package',
    syntaxMode: 'go',
    extension: 'go',
  },
  {
    id: 'java',
    name: 'Java (HttpClient)',
    category: 'Java',
    description: 'Modern Java 11+ java.net.http.HttpClient',
    syntaxMode: 'java',
    extension: 'java',
  },
];

/**
 * Returns metadata for all supported code snippet targets.
 */
export function getSnippetTargets(): SnippetTargetInfo[] {
  return [...SNIPPET_TARGETS];
}

/**
 * Generates an executable code snippet in the specified language/target.
 */
export function generateSnippet(
  request: RequestFile,
  target: SnippetTarget = 'curl',
  options?: SnippetOptions,
): string {
  switch (target) {
    case 'curl':
      return generateCurlSnippet(request, options);
    case 'fetch':
      return generateFetchSnippet(request, options);
    case 'axios':
      return generateAxiosSnippet(request, options);
    case 'python':
      return generatePythonSnippet(request, options);
    case 'node-http':
      return generateNodeHttpSnippet(request, options);
    case 'go':
      return generateGoSnippet(request, options);
    case 'java':
      return generateJavaSnippet(request, options);
    default: {
      const _exhaustiveCheck: never = target;
      throw new Error(`Unsupported snippet target: ${_exhaustiveCheck}`);
    }
  }
}
