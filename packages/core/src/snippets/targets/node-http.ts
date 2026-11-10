import type { RequestFile } from '../../format/types.js';
import type { SnippetOptions } from '../types.js';
import { getEffectiveRequestData, escapeJsString } from '../utils.js';

export function generateNodeHttpSnippet(request: RequestFile, options?: SnippetOptions): string {
  const data = getEffectiveRequestData(request, options);
  const lines: string[] = [];

  // Determine protocol & module
  let isHttps = true;
  let hostname = 'httpbin.org';
  let port: string | undefined;
  let path = '/get';

  try {
    const varList: string[] = [];
    const tempUrl = data.url.includes('{{')
      ? data.url.replace(/\{\{[^}]+\}\}/g, match => {
          varList.push(match);
          return `varplaceholder${varList.length - 1}x`;
        })
      : data.url;

    const scheme = tempUrl.startsWith('http://') ? 'http://' : 'https://';
    const normalized = tempUrl.includes('://') ? tempUrl : `${scheme}${tempUrl}`;

    const parsed = new URL(normalized);
    isHttps = parsed.protocol !== 'http:';

    const restoreVars = (s: string): string =>
      s.replace(/varplaceholder(\d+)x/g, (_, idx) => varList[Number(idx)] || '');

    hostname = restoreVars(parsed.hostname);
    port = parsed.port || undefined;
    path = restoreVars(parsed.pathname + parsed.search);
  } catch {
    const withoutScheme = data.url.replace(/^https?:\/\//, '');
    const slashIdx = withoutScheme.indexOf('/');
    if (slashIdx !== -1) {
      hostname = withoutScheme.slice(0, slashIdx);
      path = withoutScheme.slice(slashIdx);
    } else {
      hostname = withoutScheme;
      path = '/';
    }
  }

  const moduleName = isHttps ? 'https' : 'http';
  lines.push(`const ${moduleName} = require('${moduleName}');`, '');

  // Prepare postData if body is present
  let hasPostData = false;
  if (data.body) {
    if (data.body.type === 'json') {
      if (data.body.jsonParsed !== undefined) {
        const pretty = JSON.stringify(data.body.jsonParsed, null, 2);
        lines.push(`const postData = JSON.stringify(${pretty});`, '');
      } else {
        lines.push(`const postData = ${escapeJsString(data.body.content || '')};`, '');
      }
      hasPostData = true;
    } else if (data.body.type === 'form' && data.body.form && data.body.form.length > 0) {
      lines.push('const postData = new URLSearchParams({');
      for (const field of data.body.form) {
        lines.push(`  ${escapeJsString(field.name)}: ${escapeJsString(field.value)},`);
      }
      lines.push('}).toString();', '');
      hasPostData = true;
    } else if (data.body.type === 'text') {
      lines.push(`const postData = ${escapeJsString(data.body.content || '')};`, '');
      hasPostData = true;
    }
  }

  // Options object
  lines.push('const options = {');
  lines.push(`  hostname: ${escapeJsString(hostname)},`);
  if (port) {
    lines.push(`  port: ${port},`);
  }
  lines.push(`  path: ${escapeJsString(path)},`);
  lines.push(`  method: ${escapeJsString(data.method)},`);

  const headers = [...data.headers];
  if (hasPostData && !headers.some(h => h.name.toLowerCase() === 'content-length')) {
    headers.push({ name: 'Content-Length', value: 'Buffer.byteLength(postData)' });
  }

  if (headers.length > 0) {
    lines.push('  headers: {');
    for (const h of headers) {
      if (h.name === 'Content-Length' && h.value === 'Buffer.byteLength(postData)') {
        lines.push("    'Content-Length': Buffer.byteLength(postData),");
      } else {
        lines.push(`    ${escapeJsString(h.name)}: ${escapeJsString(h.value)},`);
      }
    }
    lines.push('  },');
  }

  if (data.validateSsl === false && isHttps) {
    lines.push('  rejectUnauthorized: false,');
  }

  lines.push('};');
  lines.push('');

  // Request execution
  lines.push(`const req = ${moduleName}.request(options, (res) => {`);
  lines.push("  let data = '';");
  lines.push('');
  lines.push("  res.on('data', (chunk) => {");
  lines.push('    data += chunk;');
  lines.push('  });');
  lines.push('');
  lines.push("  res.on('end', () => {");
  lines.push('    console.log(`Status: ${res.statusCode}`);');
  lines.push('    console.log(data);');
  lines.push('  });');
  lines.push('});');
  lines.push('');
  lines.push("req.on('error', (e) => {");
  lines.push('  console.error(`Request error: ${e.message}`);');
  lines.push('});');
  lines.push('');

  if (hasPostData) {
    lines.push('req.write(postData);');
  }
  lines.push('req.end();');

  return lines.join('\n');
}
