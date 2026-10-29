/**
 * Shell-aware tokenizer for cURL command lines across Bash, Windows cmd, and PowerShell.
 */

/**
 * Normalizes multi-line cURL commands by stripping shell line continuation symbols.
 */
export function normalizeCurlInput(input: string): string {
  if (!input) return '';
  return (
    input
      // Bash / POSIX line continuation: \ followed by newline
      .replace(/\\\r?\n\s*/g, ' ')
      // Windows cmd.exe line continuation: ^ followed by newline
      .replace(/\^\r?\n\s*/g, ' ')
      // PowerShell line continuation: ` followed by newline
      .replace(/`\r?\n\s*/g, ' ')
      .trim()
  );
}

/**
 * Tokenizes a normalized cURL command into an array of shell argument tokens.
 */
export function tokenizeCurl(rawInput: string): string[] {
  const input = normalizeCurlInput(rawInput);
  if (!input) return [];

  const tokens: string[] = [];
  let current = '';
  let inToken = false;
  let i = 0;
  const len = input.length;

  // Skip leading "curl" or "curl.exe" if present
  while (i < len && /\s/.test(input[i]!)) i++;
  if (input.slice(i).toLowerCase().startsWith('curl.exe')) {
    const nextChar = input[i + 8];
    if (nextChar === undefined || /\s/.test(nextChar)) {
      i += 8;
    }
  } else if (input.slice(i).toLowerCase().startsWith('curl')) {
    const nextChar = input[i + 4];
    if (nextChar === undefined || /\s/.test(nextChar)) {
      i += 4;
    }
  }

  while (i < len) {
    const char = input[i]!;

    // Whitespace outside of quotes separates tokens
    if (/\s/.test(char)) {
      if (inToken) {
        tokens.push(current);
        current = '';
        inToken = false;
      }
      i++;
      continue;
    }

    inToken = true;

    // ANSI-C quoting: $'...'
    if (char === '$' && i + 1 < len && input[i + 1] === "'") {
      i += 2; // skip $'
      while (i < len) {
        if (input[i] === "'") {
          i++; // close single quote
          break;
        }
        if (input[i] === '\\' && i + 1 < len) {
          const esc = input[i + 1];
          if (esc === 'n') current += '\n';
          else if (esc === 'r') current += '\r';
          else if (esc === 't') current += '\t';
          else if (esc === '\\') current += '\\';
          else if (esc === "'") current += "'";
          else if (esc === '"') current += '"';
          else if (
            esc === 'x' &&
            i + 3 < len &&
            /^[0-9a-fA-F]{2}$/.test(input.slice(i + 2, i + 4))
          ) {
            current += String.fromCharCode(parseInt(input.slice(i + 2, i + 4), 16));
            i += 2;
          } else {
            current += esc;
          }
          i += 2;
        } else {
          current += input[i]!;
          i++;
        }
      }
      continue;
    }

    // Standard single quotes: '...'
    if (char === "'") {
      i++; // skip opening '
      while (i < len) {
        if (input[i] === "'") {
          // Check for escaped single quote in bash: '\''
          if (i + 3 < len && input.slice(i, i + 4) === "'\\''") {
            current += "'";
            i += 4;
            continue;
          }
          i++; // close single quote
          break;
        }
        current += input[i]!;
        i++;
      }
      continue;
    }

    // Double quotes: "..."
    if (char === '"') {
      i++; // skip opening "
      while (i < len) {
        if (input[i] === '"') {
          i++; // close double quote
          break;
        }
        if (input[i] === '\\' && i + 1 < len) {
          const next = input[i + 1];
          if (next === '"' || next === '\\' || next === '`' || next === '$') {
            current += next;
            i += 2;
            continue;
          }
        }
        current += input[i]!;
        i++;
      }
      continue;
    }

    // Backslash escape outside of quotes
    if (char === '\\' && i + 1 < len) {
      current += input[i + 1]!;
      i += 2;
      continue;
    }

    // Normal unquoted character
    current += char;
    i++;
  }

  if (inToken) {
    tokens.push(current);
  }

  return tokens;
}
