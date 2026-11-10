import type { RequestFile } from '../../format/types.js';
import type { SnippetOptions } from '../types.js';
import { getEffectiveRequestData, escapeJavaString } from '../utils.js';

export function generateJavaSnippet(request: RequestFile, options?: SnippetOptions): string {
  const data = getEffectiveRequestData(request, options);

  const lines: string[] = [
    'import java.io.IOException;',
    'import java.net.URI;',
    'import java.net.http.HttpClient;',
    'import java.net.http.HttpRequest;',
    'import java.net.http.HttpResponse;',
    '',
    'public class Main {',
    '    public static void main(String[] args) throws IOException, InterruptedException {',
    '        HttpClient client = HttpClient.newHttpClient();',
    '',
  ];

  // Request Builder
  lines.push('        HttpRequest request = HttpRequest.newBuilder()');
  lines.push(`            .uri(URI.create(${escapeJavaString(data.url)}))`);

  // Headers
  for (const h of data.headers) {
    lines.push(`            .header(${escapeJavaString(h.name)}, ${escapeJavaString(h.value)})`);
  }

  // Body & Method
  const method = data.method.toUpperCase();
  let bodyPublisher = 'HttpRequest.BodyPublishers.noBody()';

  if (data.body) {
    let bodyString = '';
    if (data.body.type === 'json') {
      bodyString =
        data.body.jsonParsed !== undefined
          ? JSON.stringify(data.body.jsonParsed)
          : data.body.content || '';
    } else if (data.body.type === 'form' && data.body.form && data.body.form.length > 0) {
      bodyString = data.body.form
        .map(f => `${encodeURIComponent(f.name)}=${encodeURIComponent(f.value)}`)
        .join('&');
    } else if (data.body.type === 'text') {
      bodyString = data.body.content || '';
    }

    if (bodyString) {
      bodyPublisher = `HttpRequest.BodyPublishers.ofString(${escapeJavaString(bodyString)})`;
    }
  }

  if (method === 'GET') {
    lines.push('            .GET()');
  } else if (method === 'POST') {
    lines.push(`            .POST(${bodyPublisher})`);
  } else if (method === 'PUT') {
    lines.push(`            .PUT(${bodyPublisher})`);
  } else if (method === 'DELETE' && bodyPublisher === 'HttpRequest.BodyPublishers.noBody()') {
    lines.push('            .DELETE()');
  } else {
    lines.push(`            .method(${escapeJavaString(method)}, ${bodyPublisher})`);
  }

  lines.push('            .build();');
  lines.push('');
  lines.push(
    '        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());',
  );
  lines.push('');
  lines.push('        System.out.println("Status: " + response.statusCode());');
  lines.push('        System.out.println("Response: " + response.body());');
  lines.push('    }');
  lines.push('}');

  return lines.join('\n');
}
