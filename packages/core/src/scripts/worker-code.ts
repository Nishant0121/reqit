/**
 * Standalone JavaScript code executed inside the sandboxed child process.
 * This runs with Node VM and sanitized execution environment.
 */
export const WORKER_BOOTSTRAP_CODE = `
const vm = require('node:vm');

process.on('message', (msg) => {
  const {
    type,
    script,
    request = {},
    response = null,
    variables = {},
    runtimeVariables = {},
    timeoutMs = 2500,
  } = msg;

  const logs = [];
  const addLog = (level, args) => {
    try {
      logs.push({
        level,
        args: args.map(a => {
          if (typeof a === 'object' && a !== null) {
            try {
              return JSON.stringify(a);
            } catch {
              return String(a);
            }
          }
          return String(a);
        }),
        timestamp: Date.now(),
      });
    } catch {
      // ignore log formatting errors
    }
  };

  const currentRuntime = Object.assign({}, runtimeVariables);
  const currentVariables = Object.assign({}, variables, currentRuntime);

  const normalizeHeaders = (hdrs) => {
    if (!Array.isArray(hdrs)) return [];
    return hdrs.map(h => ({
      name: h.name || h.key || '',
      value: h.value != null ? String(h.value) : '',
      enabled: h.enabled !== false,
    }));
  };

  let reqHeaders = normalizeHeaders(request.headers);

  let initialReqBody = '';
  if (request.body != null) {
    if (typeof request.body === 'object' && 'content' in request.body) {
      initialReqBody = request.body.content || '';
    } else if (typeof request.body === 'string') {
      initialReqBody = request.body;
    } else {
      try {
        initialReqBody = JSON.stringify(request.body);
      } catch {
        initialReqBody = String(request.body);
      }
    }
  }

  const reqObj = {
    url: String(request.url || ''),
    method: String(request.method || 'GET').toUpperCase(),
    body: initialReqBody,
    headers: {
      get(name) {
        if (!name) return undefined;
        const lower = String(name).toLowerCase();
        const found = reqHeaders.find(h => h.enabled !== false && h.name.toLowerCase() === lower);
        return found ? found.value : undefined;
      },
      set(name, value) {
        if (!name) return;
        const lower = String(name).toLowerCase();
        const strVal = value != null ? String(value) : '';
        const idx = reqHeaders.findIndex(h => h.name.toLowerCase() === lower);
        if (idx >= 0) {
          reqHeaders[idx].value = strVal;
          reqHeaders[idx].enabled = true;
        } else {
          reqHeaders.push({ name: String(name), value: strVal, enabled: true });
        }
      },
      has(name) {
        if (!name) return false;
        const lower = String(name).toLowerCase();
        return reqHeaders.some(h => h.enabled !== false && h.name.toLowerCase() === lower);
      },
      remove(name) {
        if (!name) return;
        const lower = String(name).toLowerCase();
        reqHeaders = reqHeaders.filter(h => h.name.toLowerCase() !== lower);
      },
      delete(name) {
        this.remove(name);
      },
      all() {
        const out = {};
        for (const h of reqHeaders) {
          if (h.enabled !== false) {
            out[h.name] = h.value;
          }
        }
        return out;
      },
    },
    getHeader(name) {
      return this.headers.get(name);
    },
    setHeader(name, value) {
      this.headers.set(name, value);
    },
    removeHeader(name) {
      this.headers.remove(name);
    },
    setBody(val) {
      if (typeof val === 'object' && val !== null) {
        try {
          this.body = JSON.stringify(val);
        } catch {
          this.body = String(val);
        }
      } else {
        this.body = String(val ?? '');
      }
    },
  };

  const reqitObj = {
    getVar(name) {
      if (!name) return undefined;
      const key = String(name);
      if (Object.prototype.hasOwnProperty.call(currentRuntime, key)) {
        return currentRuntime[key];
      }
      return currentVariables[key];
    },
    setVar(name, value) {
      if (!name) return;
      const key = String(name);
      currentRuntime[key] = value;
      currentVariables[key] = value;
    },
    log(...args) {
      addLog('log', args);
    },
    info(...args) {
      addLog('info', args);
    },
    warn(...args) {
      addLog('warn', args);
    },
    error(...args) {
      addLog('error', args);
    },
  };

  let resObj = undefined;
  if ((type === 'post' || type === 'tests') && response) {
    const resHeaders = normalizeHeaders(response.headers);
    resObj = {
      status: Number(response.status) || 0,
      statusText: String(response.statusText || ''),
      body: response.body != null ? String(response.body) : '',
      timeMs: Number(response.totalMs) || 0,
      durationMs: Number(response.totalMs) || 0,
      headers: {
        get(name) {
          if (!name) return undefined;
          const lower = String(name).toLowerCase();
          const found = resHeaders.find(h => h.enabled !== false && h.name.toLowerCase() === lower);
          return found ? found.value : undefined;
        },
        has(name) {
          if (!name) return false;
          const lower = String(name).toLowerCase();
          return resHeaders.some(h => h.enabled !== false && h.name.toLowerCase() === lower);
        },
        all() {
          const out = {};
          for (const h of resHeaders) {
            if (h.enabled !== false) {
              out[h.name] = h.value;
            }
          }
          return out;
        },
      },
      getHeader(name) {
        return this.headers.get(name);
      },
      json() {
        if (!this.body || !this.body.trim()) {
          throw new Error('Response body is empty, cannot parse as JSON');
        }
        try {
          return JSON.parse(this.body);
        } catch (err) {
          throw new Error('Failed to parse response body as JSON: ' + (err ? err.message : String(err)));
        }
      },
    };
  }

  const assertFn = function(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  };
  assertFn.ok = assertFn;
  assertFn.equal = (a, b, msg) => {
    if (a != b) throw new Error(msg || ('Expected ' + JSON.stringify(a) + ' == ' + JSON.stringify(b)));
  };
  assertFn.strictEqual = (a, b, msg) => {
    if (a !== b) throw new Error(msg || ('Expected ' + JSON.stringify(a) + ' === ' + JSON.stringify(b)));
  };
  assertFn.notEqual = (a, b, msg) => {
    if (a == b) throw new Error(msg || ('Expected ' + JSON.stringify(a) + ' != ' + JSON.stringify(b)));
  };
  assertFn.notStrictEqual = (a, b, msg) => {
    if (a === b) throw new Error(msg || ('Expected ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)));
  };
  assertFn.include = (haystack, needle, msg) => {
    if (typeof haystack === 'string' || Array.isArray(haystack)) {
      if (!haystack.includes(needle)) {
        throw new Error(msg || ('Expected ' + JSON.stringify(haystack) + ' to include ' + JSON.stringify(needle)));
      }
    } else {
      throw new Error('assert.include target must be string or array');
    }
  };
  assertFn.fail = (msg) => { throw new Error(msg || 'Assertion failed'); };

  const expectFn = function(actual) {
    return {
      toBe(expected) {
        if (actual !== expected) {
          throw new Error('Expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
        }
      },
      toEqual(expected) {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          throw new Error('Expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
        }
      },
      toBeTruthy() {
        if (!actual) throw new Error('Expected truthy, got ' + JSON.stringify(actual));
      },
      toBeFalsy() {
        if (actual) throw new Error('Expected falsy, got ' + JSON.stringify(actual));
      },
      toContain(needle) {
        if (!actual || typeof actual.includes !== 'function' || !actual.includes(needle)) {
          throw new Error('Expected ' + JSON.stringify(actual) + ' to contain ' + JSON.stringify(needle));
        }
      },
      toBeGreaterThan(n) {
        if (!(actual > n)) throw new Error('Expected ' + actual + ' > ' + n);
      },
      toBeLessThan(n) {
        if (!(actual < n)) throw new Error('Expected ' + actual + ' < ' + n);
      },
      toBeDefined() {
        if (actual === undefined) throw new Error('Expected defined, got undefined');
      },
      toBeNull() {
        if (actual !== null) throw new Error('Expected null, got ' + JSON.stringify(actual));
      },
    };
  };

  const sandbox = {
    req: reqObj,
    res: resObj,
    reqit: reqitObj,
    assert: assertFn,
    expect: expectFn,
    console: {
      log: (...args) => addLog('log', args),
      info: (...args) => addLog('info', args),
      warn: (...args) => addLog('warn', args),
      error: (...args) => addLog('error', args),
    },
    Object,
    Array,
    String,
    Number,
    Boolean,
    Date,
    Math,
    JSON,
    RegExp,
    Map,
    Set,
    Promise,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURI,
    decodeURI,
    encodeURIComponent,
    decodeURIComponent,
    URL,
    URLSearchParams,
    btoa: (str) => Buffer.from(String(str), 'binary').toString('base64'),
    atob: (b64) => Buffer.from(String(b64), 'base64').toString('binary'),
  };

  const context = vm.createContext(sandbox, {
    codeGeneration: { strings: false, wasm: false },
  });

  if (type === 'tests') {
    const testsList = Array.isArray(msg.tests) ? msg.tests : [];
    const testResults = [];

    for (let i = 0; i < testsList.length; i++) {
      const t = testsList[i];
      if (t.enabled === false) continue;

      const name = String(t.name || ('Assertion ' + (i + 1)));
      const assertCode = String(t.assert || '').trim();
      const testStart = Date.now();
      let passed = false;
      let errMsg = undefined;

      if (!assertCode) {
        testResults.push({
          name,
          assert: assertCode,
          passed: false,
          message: 'Empty assertion expression',
          durationMs: 0,
        });
        continue;
      }

      try {
        const compiled = new vm.Script(assertCode, {
          filename: 'test_' + (i + 1) + '.js',
          displayErrors: true,
        });

        const val = compiled.runInContext(context, {
          timeout: timeoutMs,
          displayErrors: true,
        });

        if (val === false) {
          passed = false;
          errMsg = 'Assertion evaluated to false';
        } else if (val === null) {
          passed = false;
          errMsg = 'Assertion evaluated to null';
        } else if (typeof val === 'number' && isNaN(val)) {
          passed = false;
          errMsg = 'Assertion evaluated to NaN';
        } else {
          passed = true;
        }
      } catch (err) {
        passed = false;
        errMsg = err ? err.message : String(err);
      }

      testResults.push({
        name,
        assert: assertCode,
        passed,
        message: errMsg,
        durationMs: Math.max(0, Date.now() - testStart),
      });
    }

    const allPassed = testResults.length > 0 ? testResults.every(r => r.passed) : true;
    process.send({
      success: allPassed,
      testResults,
      logs,
    });
    return;
  }

  try {
    const compiled = new vm.Script(script, {
      filename: 'script.js',
      displayErrors: true,
    });

    compiled.runInContext(context, {
      timeout: timeoutMs,
      displayErrors: true,
    });

    let modifiedRequest = undefined;
    if (type === 'pre') {
      let finalBody = reqObj.body;
      if (typeof finalBody === 'object' && finalBody !== null) {
        try {
          finalBody = JSON.stringify(finalBody);
        } catch {}
      }
      modifiedRequest = {
        url: reqObj.url,
        method: reqObj.method,
        headers: reqHeaders,
        body: finalBody,
      };
    }

    process.send({
      success: true,
      runtimeVariables: currentRuntime,
      modifiedRequest,
      logs,
    });
  } catch (err) {
    let line = undefined;
    let column = undefined;
    if (err && err.stack) {
      const match = err.stack.match(/script\\.js:(\\d+)(?::(\\d+))?/);
      if (match) {
        line = parseInt(match[1], 10);
        if (match[2]) column = parseInt(match[2], 10);
      }
    }
    process.send({
      success: false,
      error: {
        message: err ? err.message : String(err),
        line,
        column,
        stack: err ? err.stack : undefined,
      },
      runtimeVariables: currentRuntime,
      logs,
    });
  }
});
`;
