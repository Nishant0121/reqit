import type {
  GraphQLCompletionItem,
  GraphQLField,
  GraphQLNamedType,
  GraphQLSchemaSummary,
} from './types.js';

const KEYWORD_COMPLETIONS: GraphQLCompletionItem[] = [
  { label: 'query', kind: 'keyword', detail: 'GraphQL Operation', insertText: 'query ' },
  { label: 'mutation', kind: 'keyword', detail: 'GraphQL Operation', insertText: 'mutation ' },
  {
    label: 'subscription',
    kind: 'keyword',
    detail: 'GraphQL Operation',
    insertText: 'subscription ',
  },
  { label: 'fragment', kind: 'keyword', detail: 'GraphQL Fragment', insertText: 'fragment ' },
  {
    label: '__typename',
    kind: 'field',
    detail: 'String!',
    documentation: 'The name of the current Object type at runtime.',
  },
];

/**
 * Basic tokenizer / scope analyzer to determine current type and field scope at the cursor.
 */
function analyzeScope(
  textBeforeCursor: string,
  schema: GraphQLSchemaSummary,
): {
  inArgs: boolean;
  activeFieldName?: string;
  enclosingTypeName?: string;
  isRoot: boolean;
} {
  // Check if inside parentheses (arguments)
  const lastOpenParen = textBeforeCursor.lastIndexOf('(');
  const lastCloseParen = textBeforeCursor.lastIndexOf(')');
  const inArgs = lastOpenParen > lastCloseParen;

  let activeFieldName: string | undefined;
  if (inArgs) {
    // Find identifier right before the '('
    const beforeParen = textBeforeCursor.slice(0, lastOpenParen).trim();
    const match = beforeParen.match(/([a-zA-Z0-9_]+)$/);
    if (match) {
      activeFieldName = match[1];
    }
  }

  // Count braces to trace nesting level
  let braceDepth = 0;
  let inString = false;
  const fieldStack: string[] = [];
  let token = '';

  for (let i = 0; i < textBeforeCursor.length; i++) {
    const ch = textBeforeCursor[i];
    if (ch === '"' && textBeforeCursor[i - 1] !== '\\') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch && /[a-zA-Z0-9_]/.test(ch)) {
      token += ch;
    } else {
      if (token && !['query', 'mutation', 'subscription', 'fragment', 'on'].includes(token)) {
        // Lookahead to see if next non-whitespace is '{' or '('
        const remainder = textBeforeCursor.slice(i).trim();
        if (remainder.startsWith('{') || remainder.startsWith('(')) {
          fieldStack.push(token);
        }
      }
      token = '';
    }

    if (ch === '{') {
      braceDepth++;
    } else if (ch === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
      if (fieldStack.length > 0) {
        fieldStack.pop();
      }
    }
  }

  if (braceDepth === 0) {
    return { inArgs: false, isRoot: true };
  }

  // Determine root operation type (query or mutation)
  const isMutation = /\bmutation\b/.test(textBeforeCursor.slice(0, textBeforeCursor.indexOf('{')));
  const isSubscription = /\bsubscription\b/.test(
    textBeforeCursor.slice(0, textBeforeCursor.indexOf('{')),
  );

  let currentTypeName: string | undefined = isMutation
    ? schema.mutationType || 'Mutation'
    : isSubscription
      ? schema.subscriptionType || 'Subscription'
      : schema.queryType || 'Query';

  // Walk through fieldStack to resolve nested type names
  for (const fieldName of fieldStack) {
    if (!currentTypeName) break;
    const typeDef: GraphQLNamedType | undefined = schema.types[currentTypeName];
    if (!typeDef || !typeDef.fields) break;

    const matchedField: GraphQLField | undefined = typeDef.fields.find(f => f.name === fieldName);
    if (matchedField) {
      currentTypeName = matchedField.returnTypeBase;
    }
  }

  return {
    inArgs,
    activeFieldName,
    enclosingTypeName: currentTypeName,
    isRoot: braceDepth <= 1 && fieldStack.length === 0,
  };
}

/**
 * Returns autocomplete suggestions based on query text, cursor position, and schema.
 */
export function getGraphQLCompletions(
  query: string,
  cursorOffset: number,
  schema?: GraphQLSchemaSummary | null,
): GraphQLCompletionItem[] {
  const textBefore = query.slice(0, cursorOffset);
  const trimmed = textBefore.trim();

  // If no schema, return basic keywords
  if (!schema) {
    return KEYWORD_COMPLETIONS;
  }

  // If cursor is before first '{' or completely empty, suggest operations
  if (!textBefore.includes('{') || trimmed.length === 0) {
    return KEYWORD_COMPLETIONS;
  }

  const scope = analyzeScope(textBefore, schema);

  // 1. Arguments completion: inside `( ... )`
  if (scope.inArgs && scope.activeFieldName) {
    let targetField: GraphQLField | undefined;

    // Search in enclosing type's fields
    if (scope.enclosingTypeName && schema.types[scope.enclosingTypeName]?.fields) {
      targetField = schema.types[scope.enclosingTypeName]!.fields!.find(
        f => f.name === scope.activeFieldName,
      );
    }

    // Fallback: search in root queries or mutations
    if (!targetField) {
      targetField =
        schema.queries.find(f => f.name === scope.activeFieldName) ||
        schema.mutations.find(f => f.name === scope.activeFieldName);
    }

    if (targetField && targetField.args.length > 0) {
      return targetField.args.map(arg => ({
        label: arg.name,
        kind: 'argument',
        detail: arg.typeFormatted,
        documentation: arg.description,
        insertText: `${arg.name}: `,
      }));
    }
  }

  // 2. Field completions on enclosing type
  if (scope.enclosingTypeName && schema.types[scope.enclosingTypeName]) {
    const typeDef = schema.types[scope.enclosingTypeName];
    if (typeDef?.fields && typeDef.fields.length > 0) {
      const items: GraphQLCompletionItem[] = typeDef.fields.map(f => ({
        label: f.name,
        kind: 'field',
        detail: f.typeFormatted,
        documentation: f.description,
        insertText: f.args.length > 0 ? `${f.name}` : f.name,
      }));

      // Add __typename
      items.push({
        label: '__typename',
        kind: 'field',
        detail: 'String!',
        documentation: 'The name of the current Object type at runtime.',
      });

      return items;
    }
  }

  // 3. Fallback: if at root level of query, offer all root queries/mutations
  if (scope.isRoot) {
    return schema.queries.map(q => ({
      label: q.name,
      kind: 'field',
      detail: q.typeFormatted,
      documentation: q.description,
    }));
  }

  return KEYWORD_COMPLETIONS;
}
