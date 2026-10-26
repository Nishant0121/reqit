/**
 * String quoting utilities for YAML serialization.
 * Ensures strings that YAML 1.2 would misread or coerce are explicitly quoted.
 */

const TRIGGER_START_CHARS = new Set([
  '{',
  '[',
  '*',
  '&',
  '!',
  '%',
  '@',
  '`',
  '|',
  '>',
  '?',
  ':',
  '-',
  ',',
  '~',
  "'",
  '"',
  '#',
]);

const RESERVED_WORDS = new Set([
  'true',
  'false',
  'yes',
  'no',
  'y',
  'n',
  'on',
  'off',
  'null',
  '~',
  'nan',
  'inf',
  '+inf',
  '-inf',
]);

/**
 * Checks whether a given string value requires quoting in YAML.
 */
export function stringNeedsQuoting(val: string, isUrl = false): boolean {
  if (isUrl) {
    return true;
  }

  if (val === '') {
    return true;
  }

  const firstChar = val[0];
  if (firstChar && TRIGGER_START_CHARS.has(firstChar)) {
    return true;
  }

  const lower = val.toLowerCase();
  if (RESERVED_WORDS.has(lower)) {
    return true;
  }

  // Pure integer or signed integer (e.g. '1', '-42', '+100', '0123')
  if (/^[-+]?\d+$/.test(val)) {
    return true;
  }

  // Floating point number (e.g. '1.23', '.5', '1e6', '-2.5e-3')
  if (/^[-+]?(\d+\.\d*|\.\d+)([eE][-+]?\d+)?$/.test(val)) {
    return true;
  }

  // Hexadecimal, binary, or octal (e.g. '0x1a', '0b1010', '0o77')
  if (/^0[xXoObB][0-9a-fA-F_]+$/.test(val)) {
    return true;
  }

  // Contains comment trigger (space followed by #)
  if (val.includes(' #')) {
    return true;
  }

  // Contains mapping trigger (: followed by space or : at end of string)
  if (val.includes(': ') || val.endsWith(':')) {
    return true;
  }

  // Leading or trailing whitespace
  if (/^\s|\s$/.test(val)) {
    return true;
  }

  return false;
}

/**
 * Determines whether a string should be formatted as a multi-line literal block scalar (|).
 */
export function isMultiLineBlock(val: string): boolean {
  return val.includes('\n');
}
