import type { RequestFile } from '../../format/types.js';
import type { SnippetOptions } from '../types.js';
import { getEffectiveRequestData, escapeJsString } from '../utils.js';

export function generateFetchSnippet(request: RequestFile, options?: SnippetOptions): string {
  const data = getEffectiveRequestData(request, options);
  const lines: string[] = [];

  const isGet = data.method === 'GET';
  const hasHeaders = data.headers.length > 0;
  const hasBody = Boolean(data.body);

  // Pre-fetch setup for Form / Multipart
  if (data.body?.type === 'form' && data.body.form && data.body.form.length > 0) {
    lines.push('const params = new URLSearchParams();');
    for (const field of data.body.form) {
      lines.push(`params.append(${escapeJsString(field.name)}, ${escapeJsString(field.value)});`);
    }
    lines.push('');
  } else if (data.body?.type === 'multipart' && data.body.form && data.body.form.length > 0) {
    lines.push('const formData = new FormData();');
    for (const field of data.body.form) {
      if (field.isFile) {
        lines.push(
          `// Note: replace with your File or Blob reference\nformData.append(${escapeJsString(field.name)}, fileInput.files[0]);`,
        );
      } else {
        lines.push(
          `formData.append(${escapeJsString(field.name)}, ${escapeJsString(field.value)});`,
        );
      }
    }
    lines.push('');
  }

  // Build fetch call
  const urlArg = escapeJsString(data.url);

  if (isGet && !hasHeaders && !hasBody) {
    lines.push(`const response = await fetch(${urlArg});`);
  } else {
    lines.push(`const response = await fetch(${urlArg}, {`);

    const optionsEntries: string[] = [];

    // Method
    if (!isGet || hasBody) {
      optionsEntries.push(`  method: ${escapeJsString(data.method)}`);
    }

    // Headers (for multipart, fetch automatically sets boundary with FormData, so omit Content-Type)
    const effectiveHeaders =
      data.body?.type === 'multipart'
        ? data.headers.filter(h => h.name.toLowerCase() !== 'content-type')
        : data.headers;

    if (effectiveHeaders.length > 0) {
      const headerLines = effectiveHeaders.map(
        h => `    ${escapeJsString(h.name)}: ${escapeJsString(h.value)},`,
      );
      optionsEntries.push(`  headers: {\n${headerLines.join('\n')}\n  }`);
    }

    // Body
    if (data.body) {
      if (data.body.type === 'json') {
        if (data.body.jsonParsed !== undefined) {
          const prettyJson = JSON.stringify(data.body.jsonParsed, null, 2);
          const indented = prettyJson
            .split('\n')
            .map((l, i) => (i === 0 ? l : `    ${l}`))
            .join('\n');
          optionsEntries.push(`  body: JSON.stringify(${indented})`);
        } else {
          optionsEntries.push(`  body: ${escapeJsString(data.body.content || '')}`);
        }
      } else if (data.body.type === 'form') {
        optionsEntries.push('  body: params');
      } else if (data.body.type === 'multipart') {
        optionsEntries.push('  body: formData');
      } else if (data.body.type === 'text') {
        optionsEntries.push(`  body: ${escapeJsString(data.body.content || '')}`);
      }
    }

    lines.push(optionsEntries.join(',\n'));
    lines.push('});');
  }

  // Response consumption
  lines.push('');
  if (data.body?.type === 'json' || isGet) {
    lines.push('const data = await response.json();');
  } else {
    lines.push('const data = await response.text();');
  }
  lines.push('console.log(data);');

  return lines.join('\n');
}
