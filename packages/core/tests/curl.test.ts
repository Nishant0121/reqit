import { describe, it, expect } from 'vitest';
import { parseCurl, generateCurl, tokenizeCurl } from '../src/curl/index.js';
import type { RequestFile } from '../src/format/types.js';
interface TestAuthBasic {
  type: 'basic';
  username?: string;
  password?: string;
  basic?: {
    username?: string;
    password?: string;
  };
}

interface TestAuthBearer {
  type: 'bearer';
  token?: string;
  bearer?: {
    token?: string;
  };
}

interface TestMultipartField {
  name: string;
  value: string;
  isFile?: boolean;
  fileName?: string;
  description?: string;
}

describe('cURL Parser and Exporter (Phase 13)', () => {
  describe('Tokenizer and Multi-line Normalization', () => {
    it('normalizes bash line continuations (\\)', () => {
      const input = `curl 'https://api.com/v1' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"a": 1}'`;
      const tokens = tokenizeCurl(input);
      expect(tokens).toEqual([
        'https://api.com/v1',
        '-H',
        'Content-Type: application/json',
        '-d',
        '{"a": 1}',
      ]);
    });

    it('normalizes Windows cmd.exe line continuations (^)', () => {
      const input = `curl "https://api.com/v1" ^\n  -H "Content-Type: application/json" ^\n  -d "test"`;
      const tokens = tokenizeCurl(input);
      expect(tokens).toEqual([
        'https://api.com/v1',
        '-H',
        'Content-Type: application/json',
        '-d',
        'test',
      ]);
    });

    it('normalizes PowerShell line continuations (`) and curl.exe', () => {
      const input = `curl.exe 'https://api.com/v1' \`\n  -H 'Accept: text/plain'`;
      const tokens = tokenizeCurl(input);
      expect(tokens).toEqual(['https://api.com/v1', '-H', 'Accept: text/plain']);
    });

    it('handles ANSI-C quoting ($"...") with escape sequences', () => {
      const input = `curl https://api.com -d $'hello\\nworld\\ttab'`;
      const tokens = tokenizeCurl(input);
      expect(tokens).toEqual(['https://api.com', '-d', 'hello\nworld\ttab']);
    });

    it("handles escaped single quotes in bash ('\\'' patterns)", () => {
      const input = `curl https://api.com -d '{"name": "O'\\''Reilly"}'`;
      const tokens = tokenizeCurl(input);
      expect(tokens[2]).toBe('{"name": "O\'Reilly"}');
    });
  });

  describe('30+ Real-World cURL Commands Parser Suite', () => {
    // 1. Chrome DevTools simple GET
    it('1. Chrome DevTools GET with User-Agent and Accept-Encoding', () => {
      const cmd = `curl 'https://httpbin.org/get' \\
        -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)' \\
        -H 'Accept: text/html,application/xhtml+xml' \\
        --compressed`;
      const { request } = parseCurl(cmd);
      expect(request.method).toBe('GET');
      expect(request.url).toBe('https://httpbin.org/get');
      expect(request.headers?.some(h => h.name === 'User-Agent')).toBe(true);
      expect(request.headers?.some(h => h.name === 'Accept-Encoding')).toBe(true);
      expect(request.body?.type).toBe('none');
    });

    // 2. Chrome DevTools POST with JSON
    it('2. Chrome DevTools POST with --data-raw JSON payload', () => {
      const cmd = `curl 'https://httpbin.org/post' \\
        -H 'content-type: application/json' \\
        --data-raw '{"username":"antigravity","active":true}'`;
      const { request } = parseCurl(cmd);
      expect(request.method).toBe('POST');
      expect(request.url).toBe('https://httpbin.org/post');
      expect(request.body?.type).toBe('json');
      expect(JSON.parse(request.body?.content || '{}')).toEqual({
        username: 'antigravity',
        active: true,
      });
    });

    // 3. Firefox DevTools copy as cURL (bash)
    it('3. Firefox DevTools POST with Cookie and Referer', () => {
      const cmd = `curl "https://example.com/api/login" \\
        -X POST \\
        -H "Accept: application/json" \\
        -b "sessionid=xyz123; theme=dark" \\
        -e "https://example.com/" \\
        --data "grant_type=password"`;
      const { request } = parseCurl(cmd);
      expect(request.method).toBe('POST');
      expect(request.headers?.find(h => h.name === 'Cookie')?.value).toBe(
        'sessionid=xyz123; theme=dark',
      );
      expect(request.headers?.find(h => h.name === 'Referer')?.value).toBe('https://example.com/');
      expect(request.body?.content).toBe('grant_type=password');
    });

    // 4. Firefox DevTools copy as cURL (Windows cmd ^)
    it('4. Firefox DevTools Windows cmd with caret line continuation', () => {
      const cmd = `curl "https://httpbin.org/anything" ^
        -H "Content-Type: application/json" ^
        --data "{\\"message\\":\\"hello from windows\\"}"`;
      const { request } = parseCurl(cmd);
      expect(request.method).toBe('POST');
      expect(request.body?.type).toBe('json');
      expect(request.body?.content).toContain('hello from windows');
    });

    // 5. Edge DevTools copy as cURL (PowerShell `)
    it('5. Edge DevTools PowerShell with backtick line continuation', () => {
      const cmd = `curl.exe 'https://httpbin.org/put' \`
        -X PUT \`
        -H 'Content-Type: text/plain' \`
        -d 'Raw text payload'`;
      const { request } = parseCurl(cmd);
      expect(request.method).toBe('PUT');
      expect(request.body?.type).toBe('text');
      expect(request.body?.content).toBe('Raw text payload');
    });

    // 6. Stripe API: Basic auth with -u sk_test_: and multiple -d form parameters
    it('6. Stripe API customer creation with basic auth and multiple -d params', () => {
      const cmd = `curl https://api.stripe.com/v1/customers \\
        -u sk_test_dummy_key_123456789abcdef: \\
        -d "description=Customer for jenny.rosen@example.com" \\
        -d "email=jenny.rosen@example.com"`;
      const { request } = parseCurl(cmd);
      expect(request.method).toBe('POST');
      expect(request.auth?.type).toBe('basic');
      expect((request.auth as TestAuthBasic | undefined)?.basic?.username).toBe(
        'sk_test_dummy_key_123456789abcdef',
      );
      expect(request.body?.content).toBe(
        'description=Customer for jenny.rosen@example.com&email=jenny.rosen@example.com',
      );
    });

    // 7. GitHub API: Authorization token header
    it('7. GitHub API list issues with token header and User-Agent', () => {
      const cmd = `curl -H "Authorization: token ghp_dummy_token_123456789abcdef" \\
        -H "Accept: application/vnd.github.v3+json" \\
        -A "ReqitClient/1.0" \\
        https://api.github.com/repos/octocat/Hello-World/issues`;
      const { request } = parseCurl(cmd);
      expect(request.method).toBe('GET');
      expect(request.url).toBe('https://api.github.com/repos/octocat/Hello-World/issues');
      expect(request.headers?.find(h => h.name === 'User-Agent')?.value).toBe('ReqitClient/1.0');
      expect(request.headers?.find(h => h.name === 'Authorization')?.value).toContain('ghp_');
    });

    // 8. GitHub API: Create issue with JSON payload
    it('8. GitHub API create issue with multiline JSON body', () => {
      const cmd = `curl -X POST \\
        https://api.github.com/repos/owner/repo/issues \\
        -H "Authorization: Bearer my-token" \\
        -H "Content-Type: application/json" \\
        -d '{"title":"Found a bug","body":"Problem description"}'`;
      const { request } = parseCurl(cmd);
      expect(request.method).toBe('POST');
      expect(request.auth?.type).toBe('bearer');
      expect((request.auth as TestAuthBearer | undefined)?.bearer?.token).toBe('my-token');
      expect(request.body?.type).toBe('json');
    });

    // 9. OpenAI API: Chat Completions
    it('9. OpenAI API chat completions with Bearer token and JSON model', () => {
      const cmd = `curl https://api.openai.com/v1/chat/completions \\
        -H "Content-Type: application/json" \\
        -H "Authorization: Bearer sk-proj-12345" \\
        -d '{
          "model": "gpt-4o",
          "messages": [{"role": "user", "content": "Say hello"}]
        }'`;
      const { request } = parseCurl(cmd);
      expect(request.method).toBe('POST');
      expect(request.url).toBe('https://api.openai.com/v1/chat/completions');
      expect(request.body?.type).toBe('json');
      expect(request.auth?.type).toBe('bearer');
      expect((request.auth as TestAuthBearer | undefined)?.bearer?.token).toBe('sk-proj-12345');
    });

    // 10. Twilio API: SMS with --data-urlencode and basic auth
    it('10. Twilio SMS sending with --data-urlencode and basic auth', () => {
      const cmd = `curl -X POST https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json \\
        --data-urlencode "To=+1234567890" \\
        --data-urlencode "From=+1098765432" \\
        --data-urlencode "Body=Hello from Twilio!" \\
        -u "AC123:auth_token_456"`;
      const { request } = parseCurl(cmd);
      expect(request.method).toBe('POST');
      expect(request.auth?.type).toBe('basic');
      expect((request.auth as TestAuthBasic | undefined)?.basic?.username).toBe('AC123');
      expect((request.auth as TestAuthBasic | undefined)?.basic?.password).toBe('auth_token_456');
      expect(request.body?.type).toBe('form');
      expect(request.body?.content).toContain('To=%2B1234567890');
      expect(request.body?.content).toContain('Body=Hello%20from%20Twilio!');
    });

    // 11. Slack Webhook
    it('11. Slack incoming webhook JSON post', () => {
      const cmd = `curl -X POST -H 'Content-type: application/json' \\
        --data '{"text":"Deploy succeeded on production."}' \\
        https://hooks.slack.com/services/T00/B00/XXXX`;
      const { request } = parseCurl(cmd);
      expect(request.method).toBe('POST');
      expect(request.url).toBe('https://hooks.slack.com/services/T00/B00/XXXX');
      expect(request.body?.type).toBe('json');
    });

    // 12. Discord Webhook
    it('12. Discord webhook post with content', () => {
      const cmd = `curl -H "Content-Type: application/json" \\
        -d '{"username": "Bot", "content": "Alert!"}' \\
        https://discord.com/api/webhooks/123/abc`;
      const { request } = parseCurl(cmd);
      expect(request.method).toBe('POST');
      expect(request.body?.type).toBe('json');
    });

    // 13. Multipart file upload (-F file=@...)
    it('13. Multipart form upload with file and text fields', () => {
      const cmd = `curl -X POST https://api.example.com/upload \\
        -F "file=@/var/data/avatar.png;type=image/png" \\
        -F "user_id=usr_99"`;
      const { request } = parseCurl(cmd);
      expect(request.method).toBe('POST');
      expect(request.body?.type).toBe('multipart');
      const form = (request.body?.form || []) as TestMultipartField[];
      expect(form.length).toBe(2);
      expect(form[0]).toEqual({
        name: 'file',
        value: '/var/data/avatar.png',
        isFile: true,
        fileName: undefined,
        description: 'image/png',
      });
      expect(form[1]).toEqual({
        name: 'user_id',
        value: 'usr_99',
        isFile: false,
        fileName: undefined,
        description: undefined,
      });
    });

    // 14. Multipart form with custom filename
    it('14. Multipart form with custom filename in ;filename=', () => {
      const cmd = `curl https://example.com/files -F "document=@/tmp/raw.dat;filename=report.pdf"`;
      const { request } = parseCurl(cmd);
      expect(request.body?.type).toBe('multipart');
      const form = (request.body?.form || []) as TestMultipartField[];
      expect(form[0]?.fileName).toBe('report.pdf');
    });

    // 15. Follow redirects (-L, --location)
    it('15. Follow redirects flag (-L / --location)', () => {
      const cmd = `curl -L https://httpbin.org/redirect/3`;
      const { request } = parseCurl(cmd);
      expect(request.followRedirects).toBe(true);
    });

    // 16. Insecure SSL (-k, --insecure)
    it('16. Insecure SSL flag (-k / --insecure)', () => {
      const cmd = `curl -k https://self-signed.badssl.com/`;
      const { request } = parseCurl(cmd);
      expect(request.validateSsl).toBe(false);
    });

    // 17. Timeout flag (-m 15)
    it('17. Max time timeout flag (-m 15.5)', () => {
      const cmd = `curl -m 15.5 https://httpbin.org/delay/5`;
      const { request } = parseCurl(cmd);
      expect(request.timeoutMs).toBe(15500);
    });

    // 18. HEAD request (-I, --head)
    it('18. HEAD request flag (-I / --head)', () => {
      const cmd = `curl -I https://httpbin.org/get`;
      const { request } = parseCurl(cmd);
      expect(request.method).toBe('HEAD');
    });

    // 19. DELETE request (-X DELETE)
    it('19. DELETE request with custom query parameter', () => {
      const cmd = `curl -X DELETE "https://api.example.com/items/42?force=true"`;
      const { request } = parseCurl(cmd);
      expect(request.method).toBe('DELETE');
      expect(request.url).toBe('https://api.example.com/items/42?force=true');
      expect(request.params?.find(p => p.name === 'force')?.value).toBe('true');
    });

    // 20. PUT request with raw text
    it('20. PUT request with text payload', () => {
      const cmd = `curl -X PUT https://api.example.com/v1/status -d "SYSTEM_OK"`;
      const { request } = parseCurl(cmd);
      expect(request.method).toBe('PUT');
      expect(request.body?.type).toBe('text');
      expect(request.body?.content).toBe('SYSTEM_OK');
    });

    // 21. PATCH request with JSON
    it('21. PATCH request with JSON patch format', () => {
      const cmd = `curl -X PATCH https://api.example.com/users/1 \\
        -H "Content-Type: application/json-patch+json" \\
        -d '[{"op":"replace","path":"/email","value":"new@email.com"}]'`;
      const { request } = parseCurl(cmd);
      expect(request.method).toBe('PATCH');
      expect(request.body?.type).toBe('json');
    });

    // 22. Attached short flags (-XPOST, -uadmin:pass, -ddata)
    it('22. Attached short flags (-XPOST -uadmin:pass -dhello)', () => {
      const cmd = `curl -XPOST -uadmin:secret -dhello https://api.example.com`;
      const { request } = parseCurl(cmd);
      expect(request.method).toBe('POST');
      expect((request.auth as TestAuthBasic | undefined)?.basic?.username).toBe('admin');
      expect((request.auth as TestAuthBasic | undefined)?.basic?.password).toBe('secret');
      expect(request.body?.content).toBe('hello');
    });

    // 23. Attached long flags (--request=DELETE --url=https://...)
    it('23. Long flags with equals separator (--request=DELETE --url=...)', () => {
      const cmd = `curl --request=DELETE --url=https://api.example.com/resource --header=X-App:test`;
      const { request } = parseCurl(cmd);
      expect(request.method).toBe('DELETE');
      expect(request.url).toBe('https://api.example.com/resource');
      expect(request.headers?.find(h => h.name === 'X-App')?.value).toBe('test');
    });

    // 24. URL option flag (--url https://...)
    it('24. Explicit --url flag with spaces in query string', () => {
      const cmd = `curl --url "https://api.example.com/search?query=hello+world"`;
      const { request } = parseCurl(cmd);
      expect(request.url).toBe('https://api.example.com/search?query=hello+world');
    });

    // 25. URL without protocol prepends http://
    it('25. URL without protocol defaults to http://', () => {
      const cmd = `curl localhost:8080/health`;
      const { request } = parseCurl(cmd);
      expect(request.url).toBe('http://localhost:8080/health');
    });

    // 26. Automatic JSON body detection without Content-Type header
    it('26. Automatically detects JSON body and sets body.type=json even if Content-Type was omitted', () => {
      const cmd = `curl -X POST https://httpbin.org/post -d '{"autoDetect": true, "count": 42}'`;
      const { request } = parseCurl(cmd);
      expect(request.body?.type).toBe('json');
      expect(request.headers?.find(h => h.name === 'Content-Type')?.value).toBe('application/json');
    });

    // 27. Header removal syntax (-H "Accept:")
    it('27. Header removal syntax (-H "Accept:") creates empty value', () => {
      const cmd = `curl https://api.example.com -H "Accept:"`;
      const { request } = parseCurl(cmd);
      expect(request.headers?.find(h => h.name === 'Accept')?.value).toBe('');
    });

    // 28. ANSI-C hex escaping in body
    it('28. ANSI-C hex escaping in body ($"\\x7b...")', () => {
      const cmd = `curl https://httpbin.org/post -d $'\\x7b"escaped":true\\x7d'`;
      const { request } = parseCurl(cmd);
      expect(request.body?.type).toBe('json');
      expect(JSON.parse(request.body?.content || '{}')).toEqual({ escaped: true });
    });

    // 29. cURL without leading "curl" word
    it('29. Parses cURL command even if leading "curl" is omitted', () => {
      const cmd = `-X POST https://httpbin.org/post -H "Content-Type: application/json" -d '{"ping":"pong"}'`;
      const { request } = parseCurl(cmd);
      expect(request.method).toBe('POST');
      expect(request.url).toBe('https://httpbin.org/post');
      expect(request.body?.type).toBe('json');
    });

    // 30. Reports unsupported options in warnings list
    it('30. Warns about unsupported flags without crashing', () => {
      const cmd = `curl --proxy socks5://127.0.0.1:1080 -o output.json -s https://httpbin.org/get`;
      const { request, warnings } = parseCurl(cmd);
      expect(request.url).toBe('https://httpbin.org/get');
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some(w => w.includes('--proxy'))).toBe(true);
    });

    // 31. Preserves template variables ({{baseUrl}}, {{token}})
    it('31. Preserves {{variables}} in URL, headers, and body', () => {
      const cmd = `curl "{{baseUrl}}/users" -H "Authorization: Bearer {{token}}" -d '{"env": "{{environment}}"}'`;
      const { request } = parseCurl(cmd);
      expect(request.url).toBe('{{baseUrl}}/users');
      expect(request.headers?.find(h => h.name === 'Authorization')?.value).toBe(
        'Bearer {{token}}',
      );
      expect(request.body?.content).toContain('{{environment}}');
    });

    // 32. GraphQL POST request with query
    it('32. GraphQL request with query string', () => {
      const cmd = `curl -X POST https://api.github.com/graphql \\
        -H "Content-Type: application/json" \\
        -d '{"query":"query { viewer { login } }"}'`;
      const { request } = parseCurl(cmd);
      expect(request.method).toBe('POST');
      expect(request.body?.type).toBe('json');
    });
  });

  describe('Export then Import Round-Tripping', () => {
    it('33. Round-trips a JSON POST request across export and parse (Bash)', () => {
      const original: RequestFile = {
        version: 1,
        name: 'Create User',
        method: 'POST',
        url: 'https://api.example.com/v1/users',
        headers: [
          { name: 'Content-Type', value: 'application/json', enabled: true },
          { name: 'X-App-Version', value: '1.2.3', enabled: true },
        ],
        auth: {
          type: 'bearer',
          bearer: { token: 'secret-token-xyz' },
        },
        body: {
          type: 'json',
          content: '{"name":"John","role":"admin"}',
        },
        followRedirects: true,
        validateSsl: false,
      };

      // Generate bash cURL
      const curlCmd = generateCurl(original, { target: 'bash' });
      expect(curlCmd).toContain("curl -X POST 'https://api.example.com/v1/users'");
      expect(curlCmd).toContain("-H 'Authorization: Bearer secret-token-xyz'");

      // Re-parse
      const { request: parsed } = parseCurl(curlCmd);
      expect(parsed.method).toBe('POST');
      expect(parsed.url).toBe('https://api.example.com/v1/users');
      expect(parsed.auth?.type).toBe('bearer');
      expect((parsed.auth as TestAuthBearer | undefined)?.bearer?.token).toBe('secret-token-xyz');
      expect(parsed.headers?.find(h => h.name === 'X-App-Version')?.value).toBe('1.2.3');
      expect(parsed.followRedirects).toBe(true);
      expect(parsed.validateSsl).toBe(false);
    });

    it('34. Round-trips a Windows cmd cURL command (^ continuation)', () => {
      const original: RequestFile = {
        version: 1,
        name: 'Echo Test',
        method: 'POST',
        url: 'https://httpbin.org/post',
        headers: [{ name: 'Content-Type', value: 'application/json', enabled: true }],
        body: {
          type: 'json',
          content: '{"hello":"world"}',
        },
      };

      const cmdStr = generateCurl(original, { target: 'cmd' });
      expect(cmdStr).toContain('^');
      expect(cmdStr).toContain('"');

      const { request: parsed } = parseCurl(cmdStr);
      expect(parsed.method).toBe('POST');
      expect(parsed.url).toBe('https://httpbin.org/post');
      expect(parsed.body?.type).toBe('json');
    });

    it('35. Round-trips a PowerShell cURL command (` continuation)', () => {
      const original: RequestFile = {
        version: 1,
        name: 'PowerShell Test',
        method: 'PUT',
        url: 'https://httpbin.org/put',
        headers: [{ name: 'Content-Type', value: 'text/plain', enabled: true }],
        body: {
          type: 'text',
          content: 'PowerShell content',
        },
      };

      const psStr = generateCurl(original, { target: 'powershell' });
      expect(psStr).toContain('`');

      const { request: parsed } = parseCurl(psStr);
      expect(parsed.method).toBe('PUT');
      expect(parsed.url).toBe('https://httpbin.org/put');
      expect(parsed.body?.content).toBe('PowerShell content');
    });
  });
});
