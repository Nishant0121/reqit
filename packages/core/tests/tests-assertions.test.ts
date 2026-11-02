import { describe, it, expect } from 'vitest';
import { executeTestAssertions } from '../src/scripts/runner.js';
import type { TestAssertionInput } from '../src/scripts/types.js';

describe('Test Assertions Runner (Phase 17)', () => {
  const baseInput: Omit<TestAssertionInput, 'tests'> = {
    request: {
      url: 'https://api.example.com/items',
      method: 'GET',
      headers: [{ name: 'Accept', value: 'application/json', enabled: true }],
    },
    response: {
      status: 200,
      statusText: 'OK',
      headers: [
        { name: 'Content-Type', value: 'application/json; charset=utf-8', enabled: true },
        { name: 'X-Rate-Limit', value: '100', enabled: true },
      ],
      body: JSON.stringify({
        status: 'ok',
        items: [1, 2, 3],
        meta: { count: 3, page: 1 },
      }),
      totalMs: 142,
    },
    variables: { envName: 'dev' },
    runtimeVariables: { token: 'xyz123' },
  };

  it('evaluates all 5 quick-add helper assertions to pass', async () => {
    const input: TestAssertionInput = {
      ...baseInput,
      tests: [
        { name: 'Status is 200', assert: 'res.status === 200' },
        { name: 'Body contains string', assert: 'res.body.includes("items")' },
        {
          name: 'JSON path equals',
          assert: 'res.json().status === "ok" && res.json().meta.count === 3',
        },
        { name: 'Response time under N ms', assert: 'res.timeMs < 500' },
        { name: 'Header exists', assert: 'res.headers.has("content-type")' },
      ],
    };

    const output = await executeTestAssertions(input);

    expect(output.success).toBe(true);
    expect(output.results).toHaveLength(5);
    for (const r of output.results) {
      expect(r.passed).toBe(true);
      expect(r.message).toBeUndefined();
    }
  });

  it('correctly reports failure and failure messages when assertions do not pass', async () => {
    const input: TestAssertionInput = {
      ...baseInput,
      tests: [
        { name: 'Status is 201', assert: 'res.status === 201' },
        { name: 'Body contains foo', assert: 'res.body.includes("foobar")' },
        { name: 'Response time under 50ms', assert: 'res.timeMs < 50' },
        { name: 'Header missing', assert: 'res.headers.has("authorization")' },
      ],
    };

    const output = await executeTestAssertions(input);

    expect(output.success).toBe(false);
    expect(output.results).toHaveLength(4);
    expect(output.results[0]!.passed).toBe(false);
    expect(output.results[0]!.message).toBe('Assertion evaluated to false');

    expect(output.results[1]!.passed).toBe(false);
    expect(output.results[1]!.message).toBe('Assertion evaluated to false');

    expect(output.results[2]!.passed).toBe(false);
    expect(output.results[2]!.message).toBe('Assertion evaluated to false');

    expect(output.results[3]!.passed).toBe(false);
    expect(output.results[3]!.message).toBe('Assertion evaluated to false');
  });

  it('supports built-in assert(...) and expect(...) helper styles', async () => {
    const input: TestAssertionInput = {
      ...baseInput,
      tests: [
        { name: 'assert.equal status', assert: 'assert.equal(res.status, 200)' },
        { name: 'expect toBe', assert: 'expect(res.status).toBe(200)' },
        {
          name: 'assert.include header',
          assert: 'assert.include(res.getHeader("content-type"), "json")',
        },
        { name: 'expect toContain', assert: 'expect(res.body).toContain("meta")' },
        {
          name: 'custom assert message',
          assert: 'assert(res.status === 200, "Status must be 200")',
        },
      ],
    };

    const output = await executeTestAssertions(input);

    expect(output.success).toBe(true);
    expect(output.results).toHaveLength(5);
    expect(output.results.every(r => r.passed)).toBe(true);
  });

  it('captures custom error messages when assert or expect fails', async () => {
    const input: TestAssertionInput = {
      ...baseInput,
      tests: [
        {
          name: 'Failed assert with message',
          assert: 'assert(res.status === 404, "Expected status 404 Not Found")',
        },
        { name: 'Failed expect toBe', assert: 'expect(res.status).toBe(500)' },
      ],
    };

    const output = await executeTestAssertions(input);

    expect(output.success).toBe(false);
    expect(output.results[0]!.passed).toBe(false);
    expect(output.results[0]!.message).toBe('Expected status 404 Not Found');

    expect(output.results[1]!.passed).toBe(false);
    expect(output.results[1]!.message).toContain('Expected 500, got 200');
  });

  it('skips disabled tests', async () => {
    const input: TestAssertionInput = {
      ...baseInput,
      tests: [
        { name: 'Active test', assert: 'res.status === 200', enabled: true },
        { name: 'Disabled test', assert: 'res.status === 500', enabled: false },
      ],
    };

    const output = await executeTestAssertions(input);

    expect(output.success).toBe(true);
    expect(output.results).toHaveLength(1);
    expect(output.results[0]!.name).toBe('Active test');
  });

  it('handles empty assertion list cleanly', async () => {
    const output = await executeTestAssertions({
      ...baseInput,
      tests: [],
    });

    expect(output.success).toBe(true);
    expect(output.results).toHaveLength(0);
  });

  it('handles exceptions and syntax errors gracefully without crashing', async () => {
    const input: TestAssertionInput = {
      ...baseInput,
      tests: [
        { name: 'Syntax error', assert: 'res.status ===' },
        { name: 'Undefined property access', assert: 'res.json().nonexistent.deep.prop === true' },
      ],
    };

    const output = await executeTestAssertions(input);

    expect(output.success).toBe(false);
    expect(output.results[0]!.passed).toBe(false);
    expect(output.results[0]!.message).toBeDefined();

    expect(output.results[1]!.passed).toBe(false);
    expect(output.results[1]!.message).toContain('Cannot read propert');
  });

  it('terminates infinite loops in assertions cleanly', async () => {
    const input: TestAssertionInput = {
      ...baseInput,
      timeoutMs: 800,
      tests: [
        { name: 'Infinite loop assertion', assert: 'while (true) {}' },
        { name: 'Follow up assertion', assert: 'res.status === 200' },
      ],
    };

    const output = await executeTestAssertions(input);

    expect(output.success).toBe(false);
    expect(output.results[0]!.passed).toBe(false);
    expect(output.results[0]!.message).toMatch(/timed out/i);
  });
});
