import type { RequestFile } from '../../format/types.js';
import type { SnippetOptions } from '../types.js';
import { getEffectiveRequestData, escapeJsString } from '../utils.js';

export function generateAxiosSnippet(request: RequestFile, options?: SnippetOptions): string {
  const data = getEffectiveRequestData(request, options);
  const lines: string[] = ["import axios from 'axios';", ''];

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

  lines.push('const response = await axios({');
  const configEntries: string[] = [];

  configEntries.push(`  method: ${escapeJsString(data.method)}`);
  configEntries.push(`  url: ${escapeJsString(data.url)}`);

  // Headers (omit Content-Type if multipart)
  const effectiveHeaders =
    data.body?.type === 'multipart'
      ? data.headers.filter(h => h.name.toLowerCase() !== 'content-type')
      : data.headers;

  if (effectiveHeaders.length > 0) {
    const headerLines = effectiveHeaders.map(
      h => `    ${escapeJsString(h.name)}: ${escapeJsString(h.value)},`,
    );
    configEntries.push(`  headers: {\n${headerLines.join('\n')}\n  }`);
  }

  // Data / Body
  if (data.body) {
    if (data.body.type === 'json') {
      if (data.body.jsonParsed !== undefined) {
        const prettyJson = JSON.stringify(data.body.jsonParsed, null, 2);
        const indented = prettyJson
          .split('\n')
          .map((l, i) => (i === 0 ? l : `    ${l}`))
          .join('\n');
        configEntries.push(`  data: ${indented}`);
      } else {
        configEntries.push(`  data: ${escapeJsString(data.body.content || '')}`);
      }
    } else if (data.body.type === 'form') {
      configEntries.push('  data: params');
    } else if (data.body.type === 'multipart') {
      configEntries.push('  data: formData');
    } else if (data.body.type === 'text') {
      configEntries.push(`  data: ${escapeJsString(data.body.content || '')}`);
    }
  }

  // Validate SSL
  if (data.validateSsl === false) {
    configEntries.push(
      '  // Note: for Node.js https.Agent({ rejectUnauthorized: false })\n  httpsAgent: new (require("https").Agent)({ rejectUnauthorized: false })',
    );
  }

  lines.push(configEntries.join(',\n'));
  lines.push('});');
  lines.push('');
  lines.push('console.log(response.data);');

  return lines.join('\n');
}
