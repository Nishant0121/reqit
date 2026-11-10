import type { RequestFile } from '../../format/types.js';
import type { SnippetOptions } from '../types.js';
import { getEffectiveRequestData, escapePythonString } from '../utils.js';

function toPythonValue(val: unknown, indent = ''): string {
  if (val === null) return 'None';
  if (val === true) return 'True';
  if (val === false) return 'False';
  if (typeof val === 'string') return escapePythonString(val);
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) {
    if (val.length === 0) return '[]';
    const items = val.map(item => `${indent}    ${toPythonValue(item, indent + '    ')}`);
    return `[\n${items.join(',\n')}\n${indent}]`;
  }
  if (typeof val === 'object') {
    const keys = Object.keys(val as Record<string, unknown>);
    if (keys.length === 0) return '{}';
    const entries = keys.map(
      k =>
        `${indent}    ${escapePythonString(k)}: ${toPythonValue((val as Record<string, unknown>)[k], indent + '    ')}`,
    );
    return `{\n${entries.join(',\n')}\n${indent}}`;
  }
  return escapePythonString(String(val));
}

export function generatePythonSnippet(request: RequestFile, options?: SnippetOptions): string {
  const data = getEffectiveRequestData(request, options);
  const lines: string[] = ['import requests', ''];

  lines.push(`url = ${escapePythonString(data.url)}`);
  lines.push('');

  // Headers (omit Content-Type for multipart)
  const effectiveHeaders =
    data.body?.type === 'multipart'
      ? data.headers.filter(h => h.name.toLowerCase() !== 'content-type')
      : data.headers;

  const hasHeaders = effectiveHeaders.length > 0;
  if (hasHeaders) {
    lines.push('headers = {');
    for (const h of effectiveHeaders) {
      lines.push(`    ${escapePythonString(h.name)}: ${escapePythonString(h.value)},`);
    }
    lines.push('}');
    lines.push('');
  }

  // Body / Payload
  let payloadArg = '';
  if (data.body) {
    if (data.body.type === 'json') {
      if (data.body.jsonParsed !== undefined) {
        lines.push(`payload = ${toPythonValue(data.body.jsonParsed)}`);
        lines.push('');
        payloadArg = 'json=payload';
      } else {
        lines.push(`payload = ${escapePythonString(data.body.content || '')}`);
        lines.push('');
        payloadArg = 'data=payload';
      }
    } else if (data.body.type === 'form') {
      lines.push('payload = {');
      for (const field of data.body.form || []) {
        lines.push(`    ${escapePythonString(field.name)}: ${escapePythonString(field.value)},`);
      }
      lines.push('}');
      lines.push('');
      payloadArg = 'data=payload';
    } else if (data.body.type === 'multipart') {
      const fileFields = (data.body.form || []).filter(f => f.isFile);
      const regularFields = (data.body.form || []).filter(f => !f.isFile);

      if (fileFields.length > 0) {
        lines.push('files = {');
        for (const f of fileFields) {
          lines.push(
            `    ${escapePythonString(f.name)}: open(${escapePythonString(f.value || 'file.bin')}, "rb"),`,
          );
        }
        lines.push('}');
        lines.push('');
      }

      if (regularFields.length > 0) {
        lines.push('data = {');
        for (const f of regularFields) {
          lines.push(`    ${escapePythonString(f.name)}: ${escapePythonString(f.value)},`);
        }
        lines.push('}');
        lines.push('');
      }

      const parts: string[] = [];
      if (regularFields.length > 0) parts.push('data=data');
      if (fileFields.length > 0) parts.push('files=files');
      payloadArg = parts.join(', ');
    } else if (data.body.type === 'text') {
      lines.push(`payload = ${escapePythonString(data.body.content || '')}`);
      lines.push('');
      payloadArg = 'data=payload';
    }
  }

  // Request call
  const callArgs = ['url'];
  if (hasHeaders) {
    callArgs.push('headers=headers');
  }
  if (payloadArg) {
    callArgs.push(payloadArg);
  }
  if (data.validateSsl === false) {
    callArgs.push('verify=False');
  }

  const methodLower = data.method.toLowerCase();
  const knownMethods = new Set(['get', 'post', 'put', 'delete', 'patch', 'head', 'options']);
  if (knownMethods.has(methodLower)) {
    lines.push(`response = requests.${methodLower}(${callArgs.join(', ')})`);
  } else {
    lines.push(
      `response = requests.request(${escapePythonString(data.method)}, ${callArgs.join(', ')})`,
    );
  }

  lines.push('');
  lines.push('print("Status:", response.status_code)');
  if (data.body?.type === 'json' || data.method === 'GET') {
    lines.push('try:');
    lines.push('    print(response.json())');
    lines.push('except Exception:');
    lines.push('    print(response.text)');
  } else {
    lines.push('print(response.text)');
  }

  return lines.join('\n');
}
