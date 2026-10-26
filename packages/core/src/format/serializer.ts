import YAML from 'yaml';
import { isMultiLineBlock, stringNeedsQuoting } from './quoting.js';
import { createSnapshot, RAW_DOC, RAW_SNAPSHOT, RAW_TEXT } from './symbols.js';
import type {
  Auth,
  Body,
  CollectionDefaults,
  CollectionFile,
  EnvironmentFile,
  FolderFile,
  KeyValue,
  RequestFile,
  Scripts,
  SecretsFile,
  TestAssertion,
} from './types.js';

export const REQUEST_FIELD_ORDER = [
  'version',
  'name',
  'method',
  'url',
  'params',
  'headers',
  'auth',
  'body',
  'scripts',
  'tests',
  'docs',
];

export const FOLDER_FIELD_ORDER = ['version', 'name', 'order', 'headers', 'auth', 'docs'];

export const COLLECTION_FIELD_ORDER = ['version', 'name', 'defaults', 'docs'];

export const ENVIRONMENT_FIELD_ORDER = ['version', 'name', 'variables'];

export const SECRETS_FIELD_ORDER = ['version', 'environments'];

const REQUEST_SPACE_BEFORE = new Set([
  'params',
  'headers',
  'auth',
  'body',
  'scripts',
  'tests',
  'docs',
]);

const FOLDER_SPACE_BEFORE = new Set(['order', 'headers', 'auth', 'docs']);
const COLLECTION_SPACE_BEFORE = new Set(['defaults', 'docs']);
const ENVIRONMENT_SPACE_BEFORE = new Set(['variables']);
const SECRETS_SPACE_BEFORE = new Set(['environments']);

function sortKeys(keys: string[], fixedOrder: string[]): string[] {
  const known = fixedOrder.filter(k => keys.includes(k));
  const unknown = keys.filter(k => !fixedOrder.includes(k)).sort();
  return [...known, ...unknown];
}

function createScalarNode(val: unknown, keyName = ''): YAML.Scalar {
  if (val === null || val === undefined) {
    return new YAML.Scalar(null);
  }

  if (typeof val === 'string') {
    const s = new YAML.Scalar(val);
    if (keyName === 'url') {
      s.type = 'QUOTE_SINGLE';
    } else if (
      ['content', 'pre', 'post', 'docs'].includes(keyName) &&
      (isMultiLineBlock(val) || val.endsWith('\n'))
    ) {
      s.type = 'BLOCK_LITERAL';
    } else if (stringNeedsQuoting(val)) {
      s.type = 'QUOTE_SINGLE';
    }
    return s;
  }

  return new YAML.Scalar(val);
}

function serializeKeyValue(kv: KeyValue): YAML.YAMLMap {
  const map = new YAML.YAMLMap();
  const keys = sortKeys(Object.keys(kv), ['name', 'value', 'enabled']);

  for (const key of keys) {
    const val = kv[key];
    if (val === undefined) continue;

    const keyScalar = new YAML.Scalar(key);
    let valNode: YAML.Node;

    if (key === 'value') {
      valNode = createScalarNode(val, 'value');
    } else if (key === 'name') {
      valNode = createScalarNode(val, 'name');
    } else if (key === 'enabled') {
      valNode = new YAML.Scalar(Boolean(val));
    } else {
      valNode = createScalarNode(val, key);
    }

    map.items.push(new YAML.Pair(keyScalar, valNode));
  }

  return map;
}

function serializeAuth(auth: Auth): YAML.YAMLMap {
  const map = new YAML.YAMLMap();
  const fixedOrder = ['type', 'token', 'username', 'password', 'key', 'value', 'in'];
  const keys = sortKeys(Object.keys(auth), fixedOrder);

  for (const key of keys) {
    const val = (auth as Record<string, unknown>)[key];
    if (val === undefined) continue;

    const keyScalar = new YAML.Scalar(key);
    const valNode = createScalarNode(val, key);
    map.items.push(new YAML.Pair(keyScalar, valNode));
  }

  return map;
}

function serializeBody(body: Body): YAML.YAMLMap {
  const map = new YAML.YAMLMap();
  const keys = sortKeys(Object.keys(body), ['type', 'content', 'form']);

  for (const key of keys) {
    const val = (body as Record<string, unknown>)[key];
    if (val === undefined) continue;

    const keyScalar = new YAML.Scalar(key);
    let valNode: YAML.Node;

    if (key === 'form' && Array.isArray(val)) {
      const seq = new YAML.YAMLSeq();
      for (const item of val) {
        seq.items.push(serializeKeyValue(item as KeyValue));
      }
      valNode = seq;
    } else {
      valNode = createScalarNode(val, key);
    }

    map.items.push(new YAML.Pair(keyScalar, valNode));
  }

  return map;
}

function serializeScripts(scripts: Scripts): YAML.YAMLMap {
  const map = new YAML.YAMLMap();
  const keys = sortKeys(Object.keys(scripts), ['pre', 'post']);

  for (const key of keys) {
    const val = (scripts as Record<string, unknown>)[key];
    if (val === undefined) continue;

    const keyScalar = new YAML.Scalar(key);
    const valNode = createScalarNode(val, key);
    map.items.push(new YAML.Pair(keyScalar, valNode));
  }

  return map;
}

function serializeTestAssertion(test: TestAssertion): YAML.YAMLMap {
  const map = new YAML.YAMLMap();
  const keys = sortKeys(Object.keys(test), ['name', 'assert']);

  for (const key of keys) {
    const val = (test as Record<string, unknown>)[key];
    if (val === undefined) continue;

    const keyScalar = new YAML.Scalar(key);
    const valNode = createScalarNode(val, key);
    map.items.push(new YAML.Pair(keyScalar, valNode));
  }

  return map;
}

function serializeCollectionDefaults(defaults: CollectionDefaults): YAML.YAMLMap {
  const map = new YAML.YAMLMap();
  const keys = sortKeys(Object.keys(defaults), [
    'timeoutMs',
    'followRedirects',
    'validateSsl',
    'headers',
    'auth',
  ]);

  for (const key of keys) {
    const val = (defaults as Record<string, unknown>)[key];
    if (val === undefined) continue;

    const keyScalar = new YAML.Scalar(key);
    let valNode: YAML.Node;

    if (key === 'headers' && Array.isArray(val)) {
      const seq = new YAML.YAMLSeq();
      for (const item of val) {
        seq.items.push(serializeKeyValue(item as KeyValue));
      }
      valNode = seq;
    } else if (key === 'auth' && typeof val === 'object' && val !== null) {
      valNode = serializeAuth(val as Auth);
    } else {
      valNode = createScalarNode(val, key);
    }

    map.items.push(new YAML.Pair(keyScalar, valNode));
  }

  return map;
}

function serializeGenericValue(val: unknown, keyName = ''): YAML.Node {
  if (val === null || val === undefined) {
    return new YAML.Scalar(null);
  }

  if (Array.isArray(val)) {
    const seq = new YAML.YAMLSeq();
    for (const item of val) {
      seq.items.push(serializeGenericValue(item, keyName));
    }
    return seq;
  }

  if (typeof val === 'object') {
    const map = new YAML.YAMLMap();
    const sortedKeys = Object.keys(val as Record<string, unknown>).sort();
    for (const k of sortedKeys) {
      const v = (val as Record<string, unknown>)[k];
      if (v === undefined) continue;
      const keyScalar = new YAML.Scalar(k);
      const valNode = serializeGenericValue(v, k);
      map.items.push(new YAML.Pair(keyScalar, valNode));
    }
    return map;
  }

  return createScalarNode(val, keyName);
}

function serializeValueForKey(key: string, val: unknown): YAML.Node {
  if (key === 'params' || key === 'headers') {
    if (Array.isArray(val)) {
      const seq = new YAML.YAMLSeq();
      for (const item of val) {
        seq.items.push(serializeKeyValue(item as KeyValue));
      }
      return seq;
    }
  }

  if (key === 'auth' && typeof val === 'object' && val !== null) {
    return serializeAuth(val as Auth);
  }

  if (key === 'body' && typeof val === 'object' && val !== null) {
    return serializeBody(val as Body);
  }

  if (key === 'scripts' && typeof val === 'object' && val !== null) {
    return serializeScripts(val as Scripts);
  }

  if (key === 'tests' && Array.isArray(val)) {
    const seq = new YAML.YAMLSeq();
    for (const item of val) {
      seq.items.push(serializeTestAssertion(item as TestAssertion));
    }
    return seq;
  }

  if (key === 'defaults' && typeof val === 'object' && val !== null) {
    return serializeCollectionDefaults(val as CollectionDefaults);
  }

  if (key === 'order' && Array.isArray(val)) {
    const seq = new YAML.YAMLSeq();
    for (const item of val) {
      seq.items.push(createScalarNode(item, 'orderItem'));
    }
    return seq;
  }

  if (key === 'variables' && typeof val === 'object' && val !== null) {
    const map = new YAML.YAMLMap();
    for (const [varKey, varVal] of Object.entries(val as Record<string, unknown>)) {
      map.items.push(new YAML.Pair(new YAML.Scalar(varKey), createScalarNode(varVal, varKey)));
    }
    return map;
  }

  if (key === 'environments' && typeof val === 'object' && val !== null) {
    const map = new YAML.YAMLMap();
    for (const [envName, envVars] of Object.entries(val as Record<string, unknown>)) {
      const envMap = new YAML.YAMLMap();
      if (typeof envVars === 'object' && envVars !== null) {
        for (const [k, v] of Object.entries(envVars as Record<string, unknown>)) {
          envMap.items.push(new YAML.Pair(new YAML.Scalar(k), createScalarNode(v, k)));
        }
      }
      map.items.push(new YAML.Pair(new YAML.Scalar(envName), envMap));
    }
    return map;
  }

  return serializeGenericValue(val, key);
}

function serializeDocument(
  data: Record<string, unknown>,
  fixedOrder: string[],
  spaceBeforeSet: Set<string>,
): string {
  // 1. Untouched parsed object check: produces exact zero diff
  const rawSnapshot = (data as unknown as Record<symbol, unknown>)[RAW_SNAPSHOT];
  const rawText = (data as unknown as Record<symbol, unknown>)[RAW_TEXT];
  if (
    typeof rawSnapshot === 'string' &&
    rawSnapshot === createSnapshot(data) &&
    typeof rawText === 'string'
  ) {
    return rawText;
  }

  // 2. If RAW_DOC is present on modified object, sync modifications to retain comments
  const rawDoc = (data as unknown as Record<symbol, unknown>)[RAW_DOC];
  if (rawDoc instanceof YAML.Document && rawDoc.contents instanceof YAML.YAMLMap) {
    const rootMap = rawDoc.contents;
    const originalJS = (rawDoc.toJS() || {}) as Record<string, unknown>;
    const keys = sortKeys(Object.keys(data), fixedOrder);

    // Remove deleted keys from AST
    for (let i = rootMap.items.length - 1; i >= 0; i--) {
      const pair = rootMap.items[i];
      if (pair && pair.key && typeof (pair.key as YAML.Scalar).value === 'string') {
        const k = (pair.key as YAML.Scalar).value as string;
        if (!(k in data) || data[k] === undefined) {
          rootMap.items.splice(i, 1);
        }
      }
    }

    // Update / insert keys in fixed order
    for (const key of keys) {
      const val = data[key];
      if (val === undefined) continue;

      const existingPair = rootMap.items.find(
        p => p && p.key && (p.key as YAML.Scalar).value === key,
      );

      // Only update nodes that actually changed to preserve internal comments
      const isModified = !existingPair || JSON.stringify(originalJS[key]) !== JSON.stringify(val);

      if (isModified) {
        const valNode = serializeValueForKey(key, val);
        if (existingPair) {
          existingPair.value = valNode;
        } else {
          const keyScalar = new YAML.Scalar(key);
          if (spaceBeforeSet.has(key)) {
            keyScalar.spaceBefore = true;
          }
          rootMap.items.push(new YAML.Pair(keyScalar, valNode));
        }
      }

      if (existingPair && spaceBeforeSet.has(key)) {
        (existingPair.key as YAML.Scalar).spaceBefore = true;
      }
    }

    // Sort items to match fixed field order
    rootMap.items.sort((a, b) => {
      const keyA = (a.key as YAML.Scalar)?.value as string;
      const keyB = (b.key as YAML.Scalar)?.value as string;
      return keys.indexOf(keyA) - keys.indexOf(keyB);
    });

    return rawDoc.toString();
  }

  // 3. Fresh serialization from scratch
  const doc = new YAML.Document();
  const rootMap = new YAML.YAMLMap();

  const keys = sortKeys(Object.keys(data), fixedOrder);

  for (const key of keys) {
    const val = data[key];
    if (val === undefined) continue;

    const keyScalar = new YAML.Scalar(key);
    if (spaceBeforeSet.has(key)) {
      keyScalar.spaceBefore = true;
    }

    const valNode = serializeValueForKey(key, val);
    rootMap.items.push(new YAML.Pair(keyScalar, valNode));
  }

  doc.contents = rootMap;
  return doc.toString();
}

export function serializeRequest(request: RequestFile): string {
  return serializeDocument(
    request as unknown as Record<string, unknown>,
    REQUEST_FIELD_ORDER,
    REQUEST_SPACE_BEFORE,
  );
}

export function serializeFolder(folder: FolderFile): string {
  return serializeDocument(
    folder as unknown as Record<string, unknown>,
    FOLDER_FIELD_ORDER,
    FOLDER_SPACE_BEFORE,
  );
}

export function serializeCollection(collection: CollectionFile): string {
  return serializeDocument(
    collection as unknown as Record<string, unknown>,
    COLLECTION_FIELD_ORDER,
    COLLECTION_SPACE_BEFORE,
  );
}

export function serializeEnvironment(environment: EnvironmentFile): string {
  return serializeDocument(
    environment as unknown as Record<string, unknown>,
    ENVIRONMENT_FIELD_ORDER,
    ENVIRONMENT_SPACE_BEFORE,
  );
}

export function serializeSecrets(secrets: SecretsFile): string {
  return serializeDocument(
    secrets as unknown as Record<string, unknown>,
    SECRETS_FIELD_ORDER,
    SECRETS_SPACE_BEFORE,
  );
}
