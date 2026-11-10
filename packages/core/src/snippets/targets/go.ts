import type { RequestFile } from '../../format/types.js';
import type { SnippetOptions } from '../types.js';
import { getEffectiveRequestData, escapeGoString } from '../utils.js';

export function generateGoSnippet(request: RequestFile, options?: SnippetOptions): string {
  const data = getEffectiveRequestData(request, options);

  const imports = new Set<string>(['fmt', 'io', 'net/http']);
  const bodySetupLines: string[] = [];
  let bodyReaderExpr = 'nil';

  if (data.body) {
    if (data.body.type === 'json' || data.body.type === 'text') {
      imports.add('bytes');
      const content =
        data.body.type === 'json' && data.body.jsonParsed !== undefined
          ? JSON.stringify(data.body.jsonParsed, null, 2)
          : data.body.content || '';

      bodySetupLines.push(`\tpayload := []byte(${escapeGoString(content)})`);
      bodyReaderExpr = 'bytes.NewBuffer(payload)';
    } else if (data.body.type === 'form' && data.body.form && data.body.form.length > 0) {
      imports.add('net/url');
      imports.add('strings');
      bodySetupLines.push('\tdata := url.Values{}');
      for (const field of data.body.form) {
        bodySetupLines.push(
          `\tdata.Set(${escapeGoString(field.name)}, ${escapeGoString(field.value)})`,
        );
      }
      bodyReaderExpr = 'strings.NewReader(data.Encode())';
    }
  }

  if (data.validateSsl === false) {
    imports.add('crypto/tls');
  }

  const sortedImports = Array.from(imports).sort();

  const lines: string[] = ['package main', '', 'import ('];
  for (const imp of sortedImports) {
    lines.push(`\t"${imp}"`);
  }
  lines.push(')', '', 'func main() {');
  lines.push(`\turl := ${escapeGoString(data.url)}`);
  lines.push('');

  if (bodySetupLines.length > 0) {
    lines.push(...bodySetupLines);
    lines.push('');
  }

  lines.push(`\treq, err := http.NewRequest("${data.method}", url, ${bodyReaderExpr})`);
  lines.push('\tif err != nil {');
  lines.push('\t\tpanic(err)');
  lines.push('\t}');
  lines.push('');

  // Headers
  if (data.headers.length > 0) {
    for (const h of data.headers) {
      lines.push(`\treq.Header.Set(${escapeGoString(h.name)}, ${escapeGoString(h.value)})`);
    }
    lines.push('');
  }

  // Client setup
  if (data.validateSsl === false) {
    lines.push('\ttr := &http.Transport{');
    lines.push('\t\tTLSClientConfig: &tls.Config{InsecureSkipVerify: true},');
    lines.push('\t}');
    lines.push('\tclient := &http.Client{Transport: tr}');
  } else {
    lines.push('\tclient := &http.Client{}');
  }

  lines.push('\tresp, err := client.Do(req)');
  lines.push('\tif err != nil {');
  lines.push('\t\tpanic(err)');
  lines.push('\t}');
  lines.push('\tdefer resp.Body.Close()');
  lines.push('');
  lines.push('\tbody, err := io.ReadAll(resp.Body)');
  lines.push('\tif err != nil {');
  lines.push('\t\tpanic(err)');
  lines.push('\t}');
  lines.push('');
  lines.push('\tfmt.Println("Status:", resp.Status)');
  lines.push('\tfmt.Println("Body:", string(body))');
  lines.push('}');

  return lines.join('\n');
}
