import type { OpenApiSchema } from './types.js';

/**
 * Resolves a JSON pointer like "#/components/schemas/User" or "#/definitions/User"
 * against a root document object.
 */
export function resolveRef(ref: string, rootDoc: Record<string, unknown>): unknown {
  if (!ref.startsWith('#/')) {
    // Relative or external reference - not supported in offline resolver
    return null;
  }

  const parts = ref
    .slice(2)
    .split('/')
    .map(p => p.replace(/~1/g, '/').replace(/~0/g, '~'));

  let current: unknown = rootDoc;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }

  return current;
}

/**
 * Resolves a schema that might be a `$ref` or contain `$ref`.
 */
export function dereferenceSchema(
  schema: OpenApiSchema | undefined,
  rootDoc: Record<string, unknown>,
  visitedRefs: Set<string> = new Set(),
): OpenApiSchema | undefined {
  if (!schema) return undefined;

  if (schema.$ref) {
    if (visitedRefs.has(schema.$ref)) {
      // Avoid infinite circular loops
      return { type: 'object' };
    }
    const nextVisited = new Set(visitedRefs);
    nextVisited.add(schema.$ref);

    const resolved = resolveRef(schema.$ref, rootDoc);
    if (resolved && typeof resolved === 'object') {
      return dereferenceSchema(resolved as OpenApiSchema, rootDoc, nextVisited);
    }
    return { type: 'object' };
  }

  return schema;
}

/**
 * Infers a realistic example string based on property name and format.
 */
function inferStringExample(propertyName?: string, format?: string): string {
  if (format) {
    switch (format.toLowerCase()) {
      case 'date-time':
        return '2026-01-01T12:00:00.000Z';
      case 'date':
        return '2026-01-01';
      case 'time':
        return '12:00:00';
      case 'email':
        return 'user@example.com';
      case 'uuid':
        return '123e4567-e89b-12d3-a456-426614174000';
      case 'uri':
      case 'url':
        return 'https://api.example.com';
      case 'ipv4':
        return '192.168.1.1';
      case 'ipv6':
        return '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
      case 'hostname':
        return 'example.com';
      case 'password':
        return '••••••••';
      case 'byte':
      case 'binary':
        return 'dGVzdA==';
    }
  }

  if (propertyName) {
    const lower = propertyName.toLowerCase();
    if (lower.includes('email')) return 'user@example.com';
    if (lower.includes('name') && !lower.includes('filename')) return 'John Doe';
    if (lower.includes('phone')) return '+1-555-0199';
    if (lower.includes('url') || lower.includes('uri') || lower.includes('link'))
      return 'https://example.com';
    if (lower.includes('id')) return 'id_12345';
    if (lower.includes('title')) return 'Sample Title';
    if (lower.includes('status')) return 'active';
    if (lower.includes('description')) return 'A sample description text.';
    if (lower.includes('token') || lower.includes('secret') || lower.includes('key'))
      return 'token_sample_123';
  }

  return 'string';
}

/**
 * Recursively generates an example JavaScript value from an OpenAPI / Swagger schema.
 */
export function generateExampleFromSchema(
  schema: OpenApiSchema | undefined,
  rootDoc: Record<string, unknown> = {},
  options: {
    propertyName?: string;
    depth?: number;
    maxDepth?: number;
    visitedRefs?: Set<string>;
  } = {},
): unknown {
  if (!schema) return null;

  const depth = options.depth || 0;
  const maxDepth = options.maxDepth || 8;
  const visitedRefs = options.visitedRefs || new Set<string>();

  if (depth > maxDepth) {
    return null;
  }

  // 1. Direct examples on schema
  if (schema.example !== undefined) {
    return schema.example;
  }
  if (Array.isArray(schema.examples) && schema.examples.length > 0) {
    const first = schema.examples[0];
    if (first && typeof first === 'object' && 'value' in (first as Record<string, unknown>)) {
      return (first as Record<string, unknown>).value;
    }
    return first;
  }
  if (schema.default !== undefined) {
    return schema.default;
  }

  // 2. Resolve $ref
  if (schema.$ref) {
    if (visitedRefs.has(schema.$ref)) {
      return null;
    }
    const nextVisited = new Set(visitedRefs);
    nextVisited.add(schema.$ref);

    const resolved = resolveRef(schema.$ref, rootDoc);
    if (resolved && typeof resolved === 'object') {
      return generateExampleFromSchema(resolved as OpenApiSchema, rootDoc, {
        propertyName: options.propertyName,
        depth: depth + 1,
        maxDepth,
        visitedRefs: nextVisited,
      });
    }
    return null;
  }

  // 3. Enum
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum[0];
  }

  // 4. allOf - merge schemas
  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    const mergedObj: Record<string, unknown> = {};
    for (const sub of schema.allOf) {
      const subEx = generateExampleFromSchema(sub, rootDoc, {
        depth: depth + 1,
        maxDepth,
        visitedRefs,
      });
      if (subEx && typeof subEx === 'object' && !Array.isArray(subEx)) {
        Object.assign(mergedObj, subEx);
      }
    }
    return mergedObj;
  }

  // 5. oneOf / anyOf - take first branch
  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0 && schema.oneOf[0]) {
    return generateExampleFromSchema(schema.oneOf[0], rootDoc, {
      propertyName: options.propertyName,
      depth: depth + 1,
      maxDepth,
      visitedRefs,
    });
  }
  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0 && schema.anyOf[0]) {
    return generateExampleFromSchema(schema.anyOf[0], rootDoc, {
      propertyName: options.propertyName,
      depth: depth + 1,
      maxDepth,
      visitedRefs,
    });
  }

  // 6. Type normalization
  let type = schema.type;
  if (Array.isArray(type)) {
    type = type.find(t => t !== 'null') || type[0];
  }

  // If no type specified but properties exist -> object
  if (!type && schema.properties) {
    type = 'object';
  }
  // If items exist -> array
  if (!type && schema.items) {
    type = 'array';
  }

  switch (type) {
    case 'string':
      return inferStringExample(options.propertyName, schema.format);

    case 'integer':
    case 'number': {
      if (schema.minimum !== undefined) {
        return schema.minimum;
      }
      return 0;
    }

    case 'boolean':
      return true;

    case 'array': {
      if (schema.items) {
        const itemExample = generateExampleFromSchema(schema.items, rootDoc, {
          depth: depth + 1,
          maxDepth,
          visitedRefs,
        });
        return itemExample !== null ? [itemExample] : [];
      }
      return [];
    }

    case 'object': {
      const obj: Record<string, unknown> = {};
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          obj[key] = generateExampleFromSchema(propSchema, rootDoc, {
            propertyName: key,
            depth: depth + 1,
            maxDepth,
            visitedRefs,
          });
        }
      }
      return obj;
    }

    default:
      if (schema.properties) {
        const obj: Record<string, unknown> = {};
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          obj[key] = generateExampleFromSchema(propSchema, rootDoc, {
            propertyName: key,
            depth: depth + 1,
            maxDepth,
            visitedRefs,
          });
        }
        return obj;
      }
      return null;
  }
}
