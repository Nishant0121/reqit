import type { PostmanCollectionV21, PostmanEnvironmentV21 } from './types.js';

/**
 * Strips UTF-8 BOM, zero-width characters, and markdown code fences.
 */
export function cleanJsonString(input: string): string {
  if (typeof input !== 'string') return input;
  let str = input
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B\u200C\u200D]/g, '')
    .trim();

  // Strip wrapping markdown code fences if present (e.g. ```json ... ```)
  if (str.startsWith('```')) {
    str = str.replace(/^```[a-zA-Z0-9_-]*\r?\n?/, '');
    str = str.replace(/\r?\n?```\s*$/, '');
    str = str.trim();
  }

  return str;
}

/**
 * Strips JavaScript/JSONC comments and trailing commas outside string literals.
 */
export function stripCommentsAndTrailingCommas(str: string): string {
  let insideString = false;
  let stringChar: string | null = null;
  let isEscaped = false;
  let out = '';

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const next = str[i + 1];

    if (insideString) {
      out += ch;
      if (isEscaped) {
        isEscaped = false;
      } else if (ch === '\\') {
        isEscaped = true;
      } else if (ch === stringChar) {
        insideString = false;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      insideString = true;
      stringChar = ch;
      out += ch;
      continue;
    }

    // Single line comment: // ...
    if (ch === '/' && next === '/') {
      while (i < str.length && str[i] !== '\n' && str[i] !== '\r') {
        i++;
      }
      if (i < str.length) {
        out += str[i];
      }
      continue;
    }

    // Multi-line comment: /* ... */
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < str.length - 1 && !(str[i] === '*' && str[i + 1] === '/')) {
        i++;
      }
      i++; // skip closing '/'
      continue;
    }

    out += ch;
  }

  // Remove trailing commas before } or ]
  return out.replace(/,\s*([\]}])/g, '$1');
}

/**
 * Scans a string and returns all top-level JSON objects or arrays ({...} or [...]),
 * properly skipping string literals, escapes, and comments.
 */
export function findTopLevelJsonChunks(input: string): string[] {
  let insideString = false;
  let stringChar: string | null = null;
  let isEscaped = false;
  let depth = 0;
  let startIndex = -1;
  const chunks: string[] = [];

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];

    if (insideString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (ch === '\\') {
        isEscaped = true;
      } else if (ch === stringChar) {
        insideString = false;
        stringChar = null;
      }
      continue;
    }

    // Skip single-line comments: // ...
    if (ch === '/' && next === '/') {
      while (i < input.length && input[i] !== '\n' && input[i] !== '\r') {
        i++;
      }
      continue;
    }

    // Skip multi-line comments: /* ... */
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < input.length - 1 && !(input[i] === '*' && input[i + 1] === '/')) {
        i++;
      }
      i++;
      continue;
    }

    // String entry
    if (ch === '"' || ch === "'") {
      insideString = true;
      stringChar = ch;
      continue;
    }

    // Bracket tracking
    if (ch === '{' || ch === '[') {
      if (depth === 0) {
        startIndex = i;
      }
      depth++;
    } else if (ch === '}' || ch === ']') {
      if (depth > 0) {
        depth--;
        if (depth === 0 && startIndex !== -1) {
          chunks.push(input.slice(startIndex, i + 1));
          startIndex = -1;
        }
      }
    }
  }

  return chunks;
}

/**
 * Parses all root JSON objects out of a string, even if multiple objects are concatenated
 * or trailing text/fences exist after the first JSON object.
 */
export function parseAllJsonObjects(rawInput: string): unknown[] {
  const cleaned = cleanJsonString(rawInput);
  if (!cleaned) return [];

  // 1. Fast path: try standard JSON.parse first
  try {
    return [JSON.parse(cleaned)];
  } catch {
    // Proceed to chunked / resilient extraction
  }

  // 2. Find all top-level {...} or [...] chunks
  const chunks = findTopLevelJsonChunks(cleaned);
  const objects: unknown[] = [];

  for (const chunk of chunks) {
    try {
      objects.push(JSON.parse(chunk));
    } catch {
      try {
        objects.push(JSON.parse(stripCommentsAndTrailingCommas(chunk)));
      } catch {
        // chunk could not be parsed as JSON
      }
    }
  }

  if (objects.length > 0) {
    return objects;
  }

  // 3. Fallback: try stripped raw input
  try {
    return [JSON.parse(stripCommentsAndTrailingCommas(cleaned))];
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to parse Postman collection JSON: ${errMsg}. Please verify the file contains valid JSON.`,
    );
  }
}

export interface ExtractedPostmanResult {
  collection: PostmanCollectionV21;
  embeddedEnvironment?: PostmanEnvironmentV21;
}

/**
 * Finds and extracts a Postman Collection (and optional Environment) from any JSON input.
 * Supports:
 * - Direct Postman Collection JSON
 * - Concatenated Collection + Environment JSON
 * - Postman Backup Dumps ({ version: 1, collections: [...], environments: [...] })
 * - Arrays of collections ([ { info: ... } ])
 * - Strings with markdown fences or trailing non-JSON text
 */
export function extractPostmanCollection(input: string | unknown): ExtractedPostmanResult {
  let parsedCandidates: unknown[] = [];

  if (typeof input === 'string') {
    parsedCandidates = parseAllJsonObjects(input);
  } else if (Array.isArray(input)) {
    parsedCandidates = input;
  } else if (input && typeof input === 'object') {
    parsedCandidates = [input];
  }

  if (parsedCandidates.length === 0) {
    throw new Error('Invalid Postman input: content is empty or contains no JSON objects.');
  }

  // Handle Postman Data Dump format: { collections: [...], environments: [...] }
  const first = parsedCandidates[0] as Record<string, unknown>;
  if (
    first &&
    typeof first === 'object' &&
    Array.isArray(first.collections) &&
    first.collections.length > 0
  ) {
    const col = first.collections[0] as PostmanCollectionV21;
    let env: PostmanEnvironmentV21 | undefined = undefined;
    if (Array.isArray(first.environments) && first.environments.length > 0) {
      env = first.environments[0] as PostmanEnvironmentV21;
    }
    return { collection: col, embeddedEnvironment: env };
  }

  // If parsedCandidates contains multiple objects, find collection and environment
  let collectionCandidate: PostmanCollectionV21 | undefined = undefined;
  let environmentCandidate: PostmanEnvironmentV21 | undefined = undefined;

  for (const item of parsedCandidates) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;

    // Collection signature: has info, item, or schema containing collection.json
    const hasInfo = Boolean(obj.info && typeof obj.info === 'object');
    const hasItem = Array.isArray(obj.item);
    const hasCollectionSchema =
      typeof obj.schema === 'string' && obj.schema.includes('collection.json');

    if (!collectionCandidate && (hasInfo || hasItem || hasCollectionSchema)) {
      collectionCandidate = obj as unknown as PostmanCollectionV21;
      continue;
    }

    // Environment signature: has values array and name string, or _postman_variable_scope === 'environment'
    const hasValues = Array.isArray(obj.values);
    const isEnvScope = obj._postman_variable_scope === 'environment';

    if (!environmentCandidate && (hasValues || isEnvScope)) {
      environmentCandidate = obj as unknown as PostmanEnvironmentV21;
    }
  }

  // Fallback: if no explicit signature, use the first object as collection
  if (!collectionCandidate && parsedCandidates.length > 0) {
    const fallback = parsedCandidates[0];
    if (fallback && typeof fallback === 'object') {
      collectionCandidate = fallback as unknown as PostmanCollectionV21;
    }
  }

  if (!collectionCandidate) {
    throw new Error('Invalid Postman collection format: root must be a JSON object.');
  }

  return {
    collection: collectionCandidate,
    embeddedEnvironment: environmentCandidate,
  };
}
