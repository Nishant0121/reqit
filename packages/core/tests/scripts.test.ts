import { describe, expect, it } from 'vitest';
import {
  executePostResponseScript,
  executePreRequestScript,
  formatScriptError,
} from '../src/scripts/index.js';

describe('Script Sandbox & Execution Engine (Phase 16)', () => {
  describe('Pre-request scripts', () => {
    it('can read and modify request URL, headers, and body', async () => {
      const result = await executePreRequestScript({
        script: `
          req.url = req.url + '?token=pre123';
          req.method = 'POST';
          req.headers.set('X-Custom-Header', 'Value-123');
          req.setBody({ message: 'hello from script' });
          reqit.setVar('runtimeKey', 'runtimeVal');
          console.log('Pre-request executed successfully');
        `,
        request: {
          url: 'https://api.example.com/data',
          method: 'GET',
          headers: [{ name: 'Accept', value: 'application/json' }],
          body: '',
        },
      });

      expect(result.success).toBe(true);
      expect(result.modifiedRequest?.url).toBe('https://api.example.com/data?token=pre123');
      expect(result.modifiedRequest?.method).toBe('POST');
      expect(
        result.modifiedRequest?.headers?.some(
          h => h.name === 'X-Custom-Header' && h.value === 'Value-123',
        ),
      ).toBe(true);
      expect(result.modifiedRequest?.body).toBe('{"message":"hello from script"}');
      expect(result.runtimeVariables.runtimeKey).toBe('runtimeVal');
      expect(result.logs.some(l => l.args.includes('Pre-request executed successfully'))).toBe(
        true,
      );
    });

    it('can access existing variables via reqit.getVar', async () => {
      const result = await executePreRequestScript({
        script: `
          const base = reqit.getVar('baseUrl');
          const prefix = reqit.getVar('prefix');
          req.url = base + '/' + prefix;
          reqit.setVar('combined', base + '/' + prefix);
        `,
        request: {
          url: '{{baseUrl}}/placeholder',
          method: 'GET',
        },
        variables: {
          baseUrl: 'https://prod.service.com',
          prefix: 'v1/items',
        },
      });

      expect(result.success).toBe(true);
      expect(result.modifiedRequest?.url).toBe('https://prod.service.com/v1/items');
      expect(result.runtimeVariables.combined).toBe('https://prod.service.com/v1/items');
    });
  });

  describe('Post-response scripts', () => {
    it('can access response status, headers, body, json(), and durationMs', async () => {
      const result = await executePostResponseScript({
        script: `
          const data = res.json();
          reqit.setVar('sessionToken', data.token);
          reqit.setVar('statusCode', res.status);
          reqit.log('Got token:', data.token);
          console.info('Response status:', res.statusText);
        `,
        request: {
          url: 'https://auth.example.com/login',
          method: 'POST',
        },
        response: {
          status: 200,
          statusText: 'OK',
          headers: [{ name: 'Content-Type', value: 'application/json' }],
          body: JSON.stringify({ token: 'jwt-xyz-987', userId: 42 }),
          totalMs: 125,
        },
      });

      expect(result.success).toBe(true);
      expect(result.runtimeVariables.sessionToken).toBe('jwt-xyz-987');
      expect(result.runtimeVariables.statusCode).toBe(200);
      expect(result.logs.length).toBeGreaterThanOrEqual(2);
      expect(result.logs.some(l => l.args.some(a => a.includes('jwt-xyz-987')))).toBe(true);
    });

    it('handles non-JSON response gracefully when calling res.json()', async () => {
      const result = await executePostResponseScript({
        script: `
          res.json();
        `,
        request: {
          url: 'https://example.com/html',
          method: 'GET',
        },
        response: {
          status: 500,
          statusText: 'Internal Server Error',
          body: '<html><body>Server Error</body></html>',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Failed to parse response body as JSON');
    });
  });

  describe('Error handling & line numbers', () => {
    it('captures accurate line and column numbers on error', async () => {
      const result = await executePreRequestScript({
        script: `// Line 1
// Line 2
const x = undefined;
x.nonExistentMethod(); // Line 4
`,
        request: { url: 'https://example.com', method: 'GET' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.line).toBe(4);
      expect(formatScriptError(result.error!)).toContain('(line 4');
    });
  });

  describe('Sandbox security & isolation', () => {
    it('prevents access to process, require, and dangerous Node APIs', async () => {
      const result = await executePreRequestScript({
        script: `
          let hasProcess = typeof process !== 'undefined';
          let hasRequire = typeof require !== 'undefined';
          let hasFs = false;
          try {
            hasFs = typeof fs !== 'undefined';
          } catch(e) {}
          reqit.setVar('securityReport', { hasProcess, hasRequire, hasFs });
        `,
        request: { url: 'https://example.com', method: 'GET' },
      });

      expect(result.success).toBe(true);
      expect(result.runtimeVariables.securityReport).toEqual({
        hasProcess: false,
        hasRequire: false,
        hasFs: false,
      });
    });

    it('prevents constructor escape attempts to break sandbox', async () => {
      const result = await executePreRequestScript({
        script: `
          let escaped = false;
          try {
            const func = ({}).constructor.constructor('return process')();
            escaped = true;
          } catch(e) {
            reqit.setVar('escapeError', e.message);
          }
          reqit.setVar('escaped', escaped);
        `,
        request: { url: 'https://example.com', method: 'GET' },
      });

      expect(result.success).toBe(true);
      expect(result.runtimeVariables.escaped).toBe(false);
      expect(String(result.runtimeVariables.escapeError)).toContain(
        'Code generation from strings disallowed',
      );
    });

    it('terminates infinite loops cleanly via hard timeout', async () => {
      const result = await executePreRequestScript({
        script: `
          while (true) {
            // Infinite loop
          }
        `,
        request: { url: 'https://example.com', method: 'GET' },
        timeoutMs: 1000,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timed out');
    });

    it('handles huge memory allocations without crashing parent process', async () => {
      const result = await executePreRequestScript({
        script: `
          const chunks = [];
          while (true) {
            chunks.push('x'.repeat(2 * 1024 * 1024));
          }
        `,
        request: { url: 'https://example.com', method: 'GET' },
        memoryLimitMb: 32,
        timeoutMs: 3000,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toMatch(/memory limit|timed out|terminated/i);
    });
  });
});
