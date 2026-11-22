/**
 * Formats/prettifies a GraphQL query string with consistent 2-space indentation.
 */
export function formatGraphQLQuery(rawQuery: string): string {
  const trimmed = rawQuery.trim();
  if (!trimmed) return '';

  // 1. Tokenize into GraphQL lexical tokens
  const tokens: string[] = [];
  let i = 0;

  while (i < trimmed.length) {
    const ch = trimmed[i]!;

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === '#') {
      let comment = '';
      while (i < trimmed.length && trimmed[i] !== '\n') {
        comment += trimmed[i];
        i++;
      }
      tokens.push(comment);
      continue;
    }

    if (ch === '"') {
      let str = '"';
      i++;
      while (i < trimmed.length) {
        const sc = trimmed[i]!;
        str += sc;
        if (sc === '"' && trimmed[i - 1] !== '\\') {
          i++;
          break;
        }
        i++;
      }
      tokens.push(str);
      continue;
    }

    if (['{', '}', '(', ')', ':', ',', '=', '$', '!'].includes(ch)) {
      tokens.push(ch);
      i++;
      continue;
    }

    // Word / identifier / number
    let word = '';
    while (i < trimmed.length && /[a-zA-Z0-9_.-]/.test(trimmed[i]!)) {
      word += trimmed[i];
      i++;
    }
    if (word) {
      tokens.push(word);
    } else {
      tokens.push(ch);
      i++;
    }
  }

  // 2. Format tokens into indented query
  let result = '';
  let indentLevel = 0;
  let inParen = 0;

  for (let tIdx = 0; tIdx < tokens.length; tIdx++) {
    const token = tokens[tIdx]!;
    const prev = tIdx > 0 ? tokens[tIdx - 1] : undefined;
    const next = tIdx < tokens.length - 1 ? tokens[tIdx + 1] : undefined;

    if (token === '{') {
      if (prev && !['\n', '{'].includes(prev)) {
        result += ' ';
      }
      result += '{\n';
      indentLevel++;
      result += '  '.repeat(indentLevel);
    } else if (token === '}') {
      indentLevel = Math.max(0, indentLevel - 1);
      result =
        result.trimEnd() + '\n' + '  '.repeat(indentLevel) + '}\n' + '  '.repeat(indentLevel);
    } else if (token === '(') {
      inParen++;
      result += '(';
    } else if (token === ')') {
      inParen = Math.max(0, inParen - 1);
      result += ')';
    } else if (token === ':') {
      result += ': ';
    } else if (token === ',') {
      result += ', ';
    } else if (token === '$') {
      result += '$';
    } else if (token === '!') {
      result += '!';
    } else if (token.startsWith('#')) {
      result += token + '\n' + '  '.repeat(indentLevel);
    } else {
      // Identifier or literal
      if (prev === ':') {
        // space already appended after ':'
      } else if (prev === '$') {
        // no space after '$'
      } else if (prev === '(') {
        // no space right after '('
      } else if (prev === ',') {
        // no extra space needed
      } else if (
        inParen === 0 &&
        prev &&
        prev !== '{' &&
        prev !== '\n' &&
        next !== '(' &&
        next !== '{' &&
        next !== ':'
      ) {
        // A sibling field inside braces: start on new line!
        result += '\n' + '  '.repeat(indentLevel);
      } else if (prev && prev !== '(' && !result.endsWith(' ') && !result.endsWith('\n')) {
        result += ' ';
      }
      result += token;
    }
  }

  return (
    result
      .split('\n')
      .map(l => l.trimEnd())
      .filter((l, idx, arr) => !(l === '' && arr[idx - 1] === ''))
      .join('\n')
      .trim() + '\n'
  );
}
