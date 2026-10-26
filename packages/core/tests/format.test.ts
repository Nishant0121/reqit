import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FormatValidationError,
  migrate,
  parseCollection,
  parseEnvironment,
  parseFolder,
  parseRequest,
  parseSecrets,
  serializeCollection,
  serializeEnvironment,
  serializeFolder,
  serializeRequest,
  serializeSecrets,
  stringNeedsQuoting,
} from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8');
}

describe('Core YAML Format Specification (Phase 1)', () => {
  describe('Canonical Request Fixtures Round-trip (Byte-for-byte)', () => {
    const canonicalRequestFixtures = [
      'request-minimal.yaml',
      'request-full.yaml',
      'request-comments.yaml',
      'request-tricky-quoting.yaml',
      'request-disabled-headers.yaml',
      'request-empty-body.yaml',
      'request-unicode.yaml',
      'request-long-scripts.yaml',
      'request-unknown-fields.yaml',
      'request-post-form.yaml',
      'request-multipart.yaml',
    ];

    it.each(canonicalRequestFixtures)('should round-trip %s byte-for-byte', fixtureName => {
      const fixturePath = path.join(FIXTURES_DIR, fixtureName);
      const originalText = readFixture(fixtureName);

      const parsed = parseRequest(originalText, fixturePath);
      const serialized = serializeRequest(parsed);

      expect(serialized).toBe(originalText);

      // Second round-trip to guarantee idempotence: serialize(parse(serialized)) === serialized
      const secondParsed = parseRequest(serialized, fixturePath);
      const secondSerialized = serializeRequest(secondParsed);
      expect(secondSerialized).toBe(originalText);
    });
  });

  describe('Other File Types Round-trip (Folder, Collection, Environment, Secrets)', () => {
    it('should round-trip folder-canonical.yaml byte-for-byte', () => {
      const text = readFixture('folder-canonical.yaml');
      const parsed = parseFolder(text, 'folder.yaml');
      expect(parsed.name).toBe('Users');
      expect(parsed.order).toEqual(['get-user', 'create-user']);
      const serialized = serializeFolder(parsed);
      expect(serialized).toBe(text);
    });

    it('should round-trip collection-canonical.yaml byte-for-byte', () => {
      const text = readFixture('collection-canonical.yaml');
      const parsed = parseCollection(text, 'reqit.yaml');
      expect(parsed.name).toBe('My Project API');
      expect(parsed.defaults?.timeoutMs).toBe(30000);
      const serialized = serializeCollection(parsed);
      expect(serialized).toBe(text);
    });

    it('should round-trip environment-canonical.yaml byte-for-byte', () => {
      const text = readFixture('environment-canonical.yaml');
      const parsed = parseEnvironment(text, 'dev.yaml');
      expect(parsed.name).toBe('dev');
      expect(parsed.variables['baseUrl']).toBe('http://localhost:3000');
      const serialized = serializeEnvironment(parsed);
      expect(serialized).toBe(text);
    });

    it('should round-trip secrets-canonical.yaml byte-for-byte', () => {
      const text = readFixture('secrets-canonical.yaml');
      const parsed = parseSecrets(text, 'secrets.yaml');
      expect(parsed.environments['dev']?.['token']).toBe('eyJhbGciOi...');
      const serialized = serializeSecrets(parsed);
      expect(serialized).toBe(text);
    });
  });

  describe('Untouched Files & Comment Preservation', () => {
    it('produces zero diff on untouched files with complex comments', () => {
      const text = readFixture('request-comments.yaml');
      const parsed = parseRequest(text);
      const reserialized = serializeRequest(parsed);
      expect(reserialized).toBe(text);
    });

    it('preserves existing comments when a field is modified', () => {
      const text = readFixture('request-comments.yaml');
      const parsed = parseRequest(text);
      parsed.name = 'Updated Profile Name';

      const reserialized = serializeRequest(parsed);
      expect(reserialized).toContain('name: Updated Profile Name');
      expect(reserialized).toContain('# Top-level collection comment');
      expect(reserialized).toContain('# Custom tracing header');
    });
  });

  describe('Unknown Fields Preservation', () => {
    it('preserves unknown top-level and nested fields across round-trip', () => {
      const text = readFixture('request-unknown-fields.yaml');
      const parsed = parseRequest(text);

      expect(parsed['customTag']).toBe('analytics-v2');
      expect(parsed['vendorExtension']).toEqual({
        owner: 'core-platform',
        retries: 3,
      });

      const serialized = serializeRequest(parsed);
      expect(serialized).toBe(text);
    });
  });

  describe('String Quoting Rules', () => {
    it('correctly identifies strings that require quoting in YAML', () => {
      // Reserved boolean/null words
      expect(stringNeedsQuoting('true')).toBe(true);
      expect(stringNeedsQuoting('false')).toBe(true);
      expect(stringNeedsQuoting('yes')).toBe(true);
      expect(stringNeedsQuoting('no')).toBe(true);
      expect(stringNeedsQuoting('on')).toBe(true);
      expect(stringNeedsQuoting('off')).toBe(true);
      expect(stringNeedsQuoting('null')).toBe(true);

      // Numeric-looking
      expect(stringNeedsQuoting('0123')).toBe(true);
      expect(stringNeedsQuoting('123')).toBe(true);
      expect(stringNeedsQuoting('3.14')).toBe(true);
      expect(stringNeedsQuoting('0x1F')).toBe(true);

      // Trigger start chars
      expect(stringNeedsQuoting('{{variable}}')).toBe(true);
      expect(stringNeedsQuoting('@user')).toBe(true);
      expect(stringNeedsQuoting('*ptr')).toBe(true);
      expect(stringNeedsQuoting('&ref')).toBe(true);
      expect(stringNeedsQuoting('!tag')).toBe(true);
      expect(stringNeedsQuoting('%mod')).toBe(true);
      expect(stringNeedsQuoting('`code`')).toBe(true);
      expect(stringNeedsQuoting('[array]')).toBe(true);
      expect(stringNeedsQuoting('{object}')).toBe(true);

      // Normal safe strings do not require quoting
      expect(stringNeedsQuoting('application/json')).toBe(false);
      expect(stringNeedsQuoting('regular_name')).toBe(false);
      expect(stringNeedsQuoting('Create User')).toBe(false);

      // URLs are always quoted
      expect(stringNeedsQuoting('https://example.com', true)).toBe(true);
    });
  });

  describe('Error Handling and Validation (Friendly Errors)', () => {
    it('throws FormatValidationError on malformed YAML syntax with line and col info', () => {
      const text = readFixture('malformed-yaml.yaml');
      const filePath = 'path/to/malformed-yaml.yaml';

      expect(() => parseRequest(text, filePath)).toThrowError(FormatValidationError);

      try {
        parseRequest(text, filePath);
      } catch (err) {
        expect(err).toBeInstanceOf(FormatValidationError);
        const formatErr = err as FormatValidationError;
        expect(formatErr.filePath).toBe(filePath);
        expect(formatErr.message).toContain('path/to/malformed-yaml.yaml');
        expect(formatErr.message).toContain('line');
      }
    });

    it('throws FormatValidationError with field name on invalid HTTP method', () => {
      const text = readFixture('schema-invalid-method.yaml');
      const filePath = 'requests/invalid-method.yaml';

      expect(() => parseRequest(text, filePath)).toThrowError(FormatValidationError);

      try {
        parseRequest(text, filePath);
      } catch (err) {
        expect(err).toBeInstanceOf(FormatValidationError);
        const formatErr = err as FormatValidationError;
        expect(formatErr.filePath).toBe(filePath);
        expect(formatErr.message).toContain('method');
        expect(formatErr.message).toContain('Method must be one of');
      }
    });

    it('throws FormatValidationError with field name on missing required fields', () => {
      const text = readFixture('schema-missing-fields.yaml');
      const filePath = 'requests/missing-fields.yaml';

      expect(() => parseRequest(text, filePath)).toThrowError(FormatValidationError);

      try {
        parseRequest(text, filePath);
      } catch (err) {
        expect(err).toBeInstanceOf(FormatValidationError);
        const formatErr = err as FormatValidationError;
        expect(formatErr.filePath).toBe(filePath);
        expect(formatErr.message).toContain('url');
        expect(formatErr.message).toContain('Field "url" is required');
      }
    });
  });

  describe('Version Handling and Migrations', () => {
    it('returns identity for version 1 requests', () => {
      const parsed = parseRequest(readFixture('request-minimal.yaml'));
      const migrated = migrate(parsed);
      expect(migrated).toBe(parsed);
      expect(migrated.version).toBe(1);
    });

    it('throws a friendly downgrade error for future versions', () => {
      const futureData = {
        version: 99,
        name: 'Future Request',
        method: 'GET' as const,
        url: 'https://api.example.com',
      };
      expect(() => migrate(futureData, 1)).toThrowError(
        /Cannot migrate down from format version 99 to 1/,
      );
    });
  });
});
