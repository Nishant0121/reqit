import { describe, it, expect } from 'vitest';
import { detectContentType, formatPretty } from './content-type';

describe('content-type detection and pretty formatter', () => {
  it('detects JSON from header and body', () => {
    expect(detectContentType('application/json').format).toBe('json');
    expect(detectContentType('application/problem+json').isJson).toBe(true);
    expect(detectContentType(undefined, '{"hello":"world"}').format).toBe('json');
  });

  it('detects HTML from header and doctype', () => {
    expect(detectContentType('text/html; charset=utf-8').isHtml).toBe(true);
    expect(detectContentType(undefined, '<!DOCTYPE html><html><body>Hi</body></html>').isHtml).toBe(
      true,
    );
  });

  it('detects XML from header and declaration', () => {
    expect(detectContentType('application/xml').isXml).toBe(true);
    expect(detectContentType(undefined, '<?xml version="1.0"?><note>Test</note>').isXml).toBe(true);
  });

  it('detects images and SVGs', () => {
    expect(detectContentType('image/png').isImage).toBe(true);
    expect(detectContentType('image/svg+xml').isSvg).toBe(true);
  });

  it('pretty formats JSON cleanly', () => {
    const raw = '{"a":1,"b":[2,3]}';
    const formatted = formatPretty(raw, 'json');
    expect(formatted).toBe('{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}');
  });
});
