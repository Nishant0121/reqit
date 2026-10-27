import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Body } from '../format/types.js';

export interface PreparedBody {
  buffer?: Buffer;
  defaultContentType?: string;
}

const MIME_TYPES: Record<string, string> = {
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.xml': 'application/xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.csv': 'text/csv',
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

export function prepareRequestBody(body?: Body): PreparedBody {
  if (!body || body.type === 'none') {
    return {};
  }

  const bodyType = body.type.toLowerCase();

  // 1. JSON
  if (bodyType === 'json') {
    const content = typeof body.content === 'string' ? body.content : '';
    return {
      buffer: Buffer.from(content, 'utf-8'),
      defaultContentType: 'application/json; charset=utf-8',
    };
  }

  // 2. Plain Text / GraphQL / other raw strings
  if (bodyType === 'text' || bodyType === 'graphql') {
    const content = typeof body.content === 'string' ? body.content : '';
    return {
      buffer: Buffer.from(content, 'utf-8'),
      defaultContentType:
        bodyType === 'graphql' ? 'application/graphql' : 'text/plain; charset=utf-8',
    };
  }

  // 3. Form urlencoded
  if (bodyType === 'form' || bodyType === 'form-urlencoded') {
    if (body.form && Array.isArray(body.form)) {
      const searchParams = new URLSearchParams();
      for (const item of body.form) {
        if (item.enabled !== false && item.name) {
          searchParams.append(item.name, item.value ?? '');
        }
      }
      return {
        buffer: Buffer.from(searchParams.toString(), 'utf-8'),
        defaultContentType: 'application/x-www-form-urlencoded; charset=utf-8',
      };
    }

    const content = typeof body.content === 'string' ? body.content : '';
    return {
      buffer: Buffer.from(content, 'utf-8'),
      defaultContentType: 'application/x-www-form-urlencoded; charset=utf-8',
    };
  }

  // 4. Multipart form data
  if (bodyType === 'multipart' || bodyType === 'multipart/form-data') {
    const boundary = '----ReqitBoundary' + crypto.randomBytes(12).toString('hex');
    const chunks: Buffer[] = [];

    if (body.form && Array.isArray(body.form)) {
      for (const item of body.form) {
        if (item.enabled === false || !item.name) {
          continue;
        }

        const isFileField = item.type === 'file' || item.isFile === true;
        const rawValue = item.value ?? '';

        if (isFileField && rawValue) {
          let resolvedPath = rawValue;
          if (resolvedPath.startsWith('@')) {
            resolvedPath = resolvedPath.slice(1);
          }

          let fileBuffer: Buffer;
          let filename = path.basename(resolvedPath);

          if (fs.existsSync(resolvedPath)) {
            fileBuffer = fs.readFileSync(resolvedPath);
          } else {
            // If file path does not exist on disk, treat the value as content or empty
            fileBuffer = Buffer.from(rawValue, 'utf-8');
            filename = item.name + '.dat';
          }

          const mimeType = getMimeType(resolvedPath);
          const header = `--${boundary}\r\nContent-Disposition: form-data; name="${item.name}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`;
          chunks.push(Buffer.from(header, 'utf-8'));
          chunks.push(fileBuffer);
          chunks.push(Buffer.from('\r\n', 'utf-8'));
        } else {
          // Regular text field
          const header = `--${boundary}\r\nContent-Disposition: form-data; name="${item.name}"\r\n\r\n`;
          chunks.push(Buffer.from(header, 'utf-8'));
          chunks.push(Buffer.from(rawValue, 'utf-8'));
          chunks.push(Buffer.from('\r\n', 'utf-8'));
        }
      }
    }

    // Closing boundary
    chunks.push(Buffer.from(`--${boundary}--\r\n`, 'utf-8'));

    return {
      buffer: Buffer.concat(chunks),
      defaultContentType: `multipart/form-data; boundary=${boundary}`,
    };
  }

  // Fallback for custom or raw content
  const content = typeof body.content === 'string' ? body.content : '';
  return {
    buffer: Buffer.from(content, 'utf-8'),
    defaultContentType: 'application/octet-stream',
  };
}
