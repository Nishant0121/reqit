import YAML from 'yaml';
import { migrate } from './migrate.js';
import {
  FormatValidationError,
  validateCollectionFile,
  validateEnvironmentFile,
  validateFolderFile,
  validateRequestFile,
  validateSecretsFile,
} from './schema.js';
import { createSnapshot, RAW_DOC, RAW_SNAPSHOT, RAW_TEXT } from './symbols.js';
import type {
  CollectionFile,
  EnvironmentFile,
  FolderFile,
  RequestFile,
  SecretsFile,
} from './types.js';

function parseYAMLDocument(text: string, filePath?: string): YAML.Document {
  if (typeof text !== 'string') {
    throw new FormatValidationError(
      'Document content must be a string',
      [{ path: 'root', message: 'Expected string content' }],
      filePath,
    );
  }

  const doc = YAML.parseDocument(text, { keepSourceTokens: true });

  if (doc.errors.length > 0) {
    const issues = doc.errors.map(err => {
      const linePos = err.linePos
        ? ` (line ${err.linePos[0]?.line ?? 1}, col ${err.linePos[0]?.col ?? 1})`
        : '';
      return {
        path: 'yaml',
        message: `${err.message}${linePos}`,
      };
    });
    throw new FormatValidationError('YAML parsing failed', issues, filePath);
  }

  return doc;
}

function attachMetadata<T extends object>(data: T, doc: YAML.Document, text: string): T {
  Object.defineProperty(data, RAW_DOC, {
    value: doc,
    enumerable: false,
    writable: true,
  });
  Object.defineProperty(data, RAW_TEXT, {
    value: text,
    enumerable: false,
    writable: true,
  });
  Object.defineProperty(data, RAW_SNAPSHOT, {
    value: createSnapshot(data),
    enumerable: false,
    writable: true,
  });
  return data;
}

export function parseRequest(text: string, filePath?: string): RequestFile {
  const doc = parseYAMLDocument(text, filePath);
  const rawData = doc.toJS();
  const validated = validateRequestFile(rawData, filePath);
  const migrated = migrate(validated);
  return attachMetadata(migrated, doc, text);
}

export function parseFolder(text: string, filePath?: string): FolderFile {
  const doc = parseYAMLDocument(text, filePath);
  const rawData = doc.toJS();
  const validated = validateFolderFile(rawData, filePath);
  const migrated = migrate(validated);
  return attachMetadata(migrated, doc, text);
}

export function parseCollection(text: string, filePath?: string): CollectionFile {
  const doc = parseYAMLDocument(text, filePath);
  const rawData = doc.toJS();
  const validated = validateCollectionFile(rawData, filePath);
  const migrated = migrate(validated);
  return attachMetadata(migrated, doc, text);
}

export function parseEnvironment(text: string, filePath?: string): EnvironmentFile {
  const doc = parseYAMLDocument(text, filePath);
  const rawData = doc.toJS();
  const validated = validateEnvironmentFile(rawData, filePath);
  const migrated = migrate(validated);
  return attachMetadata(migrated, doc, text);
}

export function parseSecrets(text: string, filePath?: string): SecretsFile {
  const doc = parseYAMLDocument(text, filePath);
  const rawData = doc.toJS();
  const validated = validateSecretsFile(rawData, filePath);
  const migrated = migrate(validated);
  return attachMetadata(migrated, doc, text);
}
