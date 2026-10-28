export type DetectedFormat = 'json' | 'xml' | 'html' | 'text' | 'image' | 'svg';

export interface ContentTypeInfo {
  format: DetectedFormat;
  isJson: boolean;
  isXml: boolean;
  isHtml: boolean;
  isImage: boolean;
  isSvg: boolean;
  mimeType: string;
}

export function detectContentType(contentTypeHeader?: string, body?: string): ContentTypeInfo {
  const mime = (contentTypeHeader || '').toLowerCase().split(';')[0]?.trim() || '';

  if (mime === 'image/svg+xml') {
    return {
      format: 'svg',
      isJson: false,
      isXml: false,
      isHtml: false,
      isImage: true,
      isSvg: true,
      mimeType: mime,
    };
  }

  if (mime.startsWith('image/')) {
    return {
      format: 'image',
      isJson: false,
      isXml: false,
      isHtml: false,
      isImage: true,
      isSvg: false,
      mimeType: mime,
    };
  }

  if (mime === 'application/json' || mime.endsWith('+json')) {
    return {
      format: 'json',
      isJson: true,
      isXml: false,
      isHtml: false,
      isImage: false,
      isSvg: false,
      mimeType: mime,
    };
  }

  if (mime === 'text/html' || mime === 'application/xhtml+xml') {
    return {
      format: 'html',
      isJson: false,
      isXml: false,
      isHtml: true,
      isImage: false,
      isSvg: false,
      mimeType: mime,
    };
  }

  if (mime === 'application/xml' || mime === 'text/xml' || mime.endsWith('+xml')) {
    return {
      format: 'xml',
      isJson: false,
      isXml: true,
      isHtml: false,
      isImage: false,
      isSvg: false,
      mimeType: mime,
    };
  }

  // Sniff from body string if header is ambiguous
  const trimmed = (body || '').trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return {
      format: 'json',
      isJson: true,
      isXml: false,
      isHtml: false,
      isImage: false,
      isSvg: false,
      mimeType: 'application/json',
    };
  }

  if (trimmed.startsWith('<svg') || trimmed.includes('<svg xmlns="http://www.w3.org/2000/svg"')) {
    return {
      format: 'svg',
      isJson: false,
      isXml: false,
      isHtml: false,
      isImage: true,
      isSvg: true,
      mimeType: 'image/svg+xml',
    };
  }

  // Sniff Base64 image payloads or data URIs
  if (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('iVBORw0KGgo') ||
    trimmed.startsWith('/9j/') ||
    trimmed.startsWith('R0lGOD') ||
    trimmed.startsWith('UklGR')
  ) {
    let inferredMime = 'image/png';
    if (trimmed.startsWith('data:image/')) {
      inferredMime = trimmed.split(';')[0]?.replace('data:', '') || 'image/png';
    } else if (trimmed.startsWith('/9j/')) {
      inferredMime = 'image/jpeg';
    } else if (trimmed.startsWith('R0lGOD')) {
      inferredMime = 'image/gif';
    } else if (trimmed.startsWith('UklGR')) {
      inferredMime = 'image/webp';
    }
    return {
      format: 'image',
      isJson: false,
      isXml: false,
      isHtml: false,
      isImage: true,
      isSvg: false,
      mimeType: mime.startsWith('image/') ? mime : inferredMime,
    };
  }

  if (
    trimmed.startsWith('<!DOCTYPE html') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<head')
  ) {
    return {
      format: 'html',
      isJson: false,
      isXml: false,
      isHtml: true,
      isImage: false,
      isSvg: false,
      mimeType: 'text/html',
    };
  }

  if (trimmed.startsWith('<?xml') || (trimmed.startsWith('<') && trimmed.endsWith('>'))) {
    return {
      format: 'xml',
      isJson: false,
      isXml: true,
      isHtml: false,
      isImage: false,
      isSvg: false,
      mimeType: 'application/xml',
    };
  }

  return {
    format: 'text',
    isJson: false,
    isXml: false,
    isHtml: false,
    isImage: false,
    isSvg: false,
    mimeType: mime || 'text/plain',
  };
}

export function formatPretty(content: string, format: DetectedFormat): string {
  if (!content) return '';

  if (format === 'json') {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return content;
    }
  }

  if (format === 'xml' || format === 'html' || format === 'svg') {
    return formatXml(content);
  }

  return content;
}

function formatXml(xml: string): string {
  let formatted = '';
  let indent = '';
  const tab = '  ';
  xml.split(/>\s*</).forEach(node => {
    if (node.match(/^\/\w/)) indent = indent.substring(tab.length);
    formatted += indent + '<' + node + '>\r\n';
    if (node.match(/^<?\w[^>]*[^/]$/)) indent += tab;
  });
  return formatted.substring(1, formatted.length - 3);
}
