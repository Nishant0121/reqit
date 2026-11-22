import type {
  GraphQLArgument,
  GraphQLEnumValue,
  GraphQLField,
  GraphQLNamedType,
  GraphQLSchemaSummary,
  GraphQLTypeRef,
} from './types.js';

/**
 * Standard GraphQL introspection query supported by all standard GraphQL servers.
 */
export const INTROSPECTION_QUERY = `
query IntrospectionQuery {
  __schema {
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types {
      kind
      name
      description
      fields(includeDeprecated: true) {
        name
        description
        isDeprecated
        deprecationReason
        args {
          name
          description
          defaultValue
          type {
            ...TypeRef
          }
        }
        type {
          ...TypeRef
        }
      }
      inputFields {
        name
        description
        defaultValue
        type {
          ...TypeRef
        }
      }
      interfaces {
        ...TypeRef
      }
      enumValues(includeDeprecated: true) {
        name
        description
        isDeprecated
        deprecationReason
      }
      possibleTypes {
        ...TypeRef
      }
    }
  }
}

fragment TypeRef on __Type {
  kind
  name
  ofType {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
        }
      }
    }
  }
}
`.trim();

/**
 * Recursively formats a GraphQL type ref into standard SDL syntax e.g. "[User!]!"
 */
export function formatTypeRef(typeRef: GraphQLTypeRef | undefined): {
  formatted: string;
  baseName: string;
  isList: boolean;
  isRequired: boolean;
} {
  if (!typeRef) {
    return { formatted: 'Unknown', baseName: 'Unknown', isList: false, isRequired: false };
  }

  let current: GraphQLTypeRef | undefined = typeRef;
  let isRequired = false;
  let isList = false;

  if (current.kind === 'NON_NULL') {
    isRequired = true;
    current = current.ofType;
  }

  function renderInner(ref: GraphQLTypeRef | undefined): string {
    if (!ref) return 'Unknown';
    if (ref.kind === 'NON_NULL') {
      return `${renderInner(ref.ofType)}!`;
    }
    if (ref.kind === 'LIST') {
      isList = true;
      return `[${renderInner(ref.ofType)}]`;
    }
    return ref.name || 'Unknown';
  }

  function getBase(ref: GraphQLTypeRef | undefined): string {
    if (!ref) return 'Unknown';
    if (ref.ofType) return getBase(ref.ofType);
    return ref.name || 'Unknown';
  }

  const baseName = getBase(typeRef);
  const formatted = renderInner(typeRef);

  return {
    formatted,
    baseName,
    isList,
    isRequired,
  };
}

/**
 * Parses raw introspection result JSON into structured GraphQLSchemaSummary.
 */
export function parseIntrospectionResponse(raw: unknown): GraphQLSchemaSummary {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid introspection response: expected an object.');
  }

  const rawObj = raw as Record<string, unknown>;
  let schemaData: Record<string, unknown> | null = null;

  if (
    rawObj.data &&
    typeof rawObj.data === 'object' &&
    (rawObj.data as Record<string, unknown>).__schema
  ) {
    schemaData = (rawObj.data as Record<string, unknown>).__schema as Record<string, unknown>;
  } else if (rawObj.__schema && typeof rawObj.__schema === 'object') {
    schemaData = rawObj.__schema as Record<string, unknown>;
  }

  if (!schemaData) {
    if (Array.isArray(rawObj.errors) && rawObj.errors.length > 0) {
      const msg = (rawObj.errors[0] as { message?: string })?.message || 'GraphQL error';
      throw new Error(`GraphQL introspection failed: ${msg}`);
    }
    throw new Error('Invalid introspection response: __schema field not found.');
  }

  const queryTypeName = (schemaData.queryType as { name?: string })?.name;
  const mutationTypeName = (schemaData.mutationType as { name?: string })?.name;
  const subscriptionTypeName = (schemaData.subscriptionType as { name?: string })?.name;

  const rawTypes = Array.isArray(schemaData.types)
    ? (schemaData.types as Record<string, unknown>[])
    : [];

  const typesMap: Record<string, GraphQLNamedType> = {};
  const enumsMap: Record<string, GraphQLEnumValue[]> = {};

  for (const t of rawTypes) {
    const name = t.name as string;
    if (!name) continue;

    // Filter out internal introspection meta-types unless needed
    const kind = t.kind as GraphQLNamedType['kind'];
    const desc = t.description as string | undefined;

    let fields: GraphQLField[] | undefined;
    if (Array.isArray(t.fields)) {
      fields = (t.fields as Record<string, unknown>[]).map(f => {
        const typeInfo = formatTypeRef(f.type as GraphQLTypeRef);
        const args: GraphQLArgument[] = Array.isArray(f.args)
          ? (f.args as Record<string, unknown>[]).map(a => {
              const aType = formatTypeRef(a.type as GraphQLTypeRef).formatted;
              return {
                name: a.name as string,
                description: a.description as string | undefined,
                type: aType,
                typeFormatted: aType,
                defaultValue: a.defaultValue ? String(a.defaultValue) : undefined,
              };
            })
          : [];

        return {
          name: f.name as string,
          description: f.description as string | undefined,
          type: typeInfo.formatted,
          typeFormatted: typeInfo.formatted,
          returnTypeBase: typeInfo.baseName,
          isList: typeInfo.isList,
          isRequired: typeInfo.isRequired,
          args,
          isDeprecated: Boolean(f.isDeprecated),
          deprecationReason: f.deprecationReason as string | undefined,
        };
      });
    }

    let inputFields: GraphQLArgument[] | undefined;
    if (Array.isArray(t.inputFields)) {
      inputFields = (t.inputFields as Record<string, unknown>[]).map(inf => {
        const infType = formatTypeRef(inf.type as GraphQLTypeRef).formatted;
        return {
          name: inf.name as string,
          description: inf.description as string | undefined,
          type: infType,
          typeFormatted: infType,
          defaultValue: inf.defaultValue ? String(inf.defaultValue) : undefined,
        };
      });
    }

    let enumValues: GraphQLEnumValue[] | undefined;
    if (Array.isArray(t.enumValues)) {
      enumValues = (t.enumValues as Record<string, unknown>[]).map(ev => ({
        name: ev.name as string,
        description: ev.description as string | undefined,
        isDeprecated: Boolean(ev.isDeprecated),
      }));
      if (!name.startsWith('__')) {
        enumsMap[name] = enumValues;
      }
    }

    const namedType: GraphQLNamedType = {
      kind,
      name,
      description: desc,
      fields,
      inputFields,
      enumValues,
      possibleTypes: Array.isArray(t.possibleTypes)
        ? (t.possibleTypes as Record<string, unknown>[]).map(pt => pt.name as string)
        : undefined,
      interfaces: Array.isArray(t.interfaces)
        ? (t.interfaces as Record<string, unknown>[]).map(it => it.name as string)
        : undefined,
    };

    typesMap[name] = namedType;
  }

  const queries =
    queryTypeName && typesMap[queryTypeName]?.fields ? typesMap[queryTypeName]!.fields! : [];
  const mutations =
    mutationTypeName && typesMap[mutationTypeName]?.fields
      ? typesMap[mutationTypeName]!.fields!
      : [];
  const subscriptions =
    subscriptionTypeName && typesMap[subscriptionTypeName]?.fields
      ? typesMap[subscriptionTypeName]!.fields!
      : [];

  return {
    queryType: queryTypeName,
    mutationType: mutationTypeName,
    subscriptionType: subscriptionTypeName,
    queries,
    mutations,
    subscriptions,
    types: typesMap,
    enums: enumsMap,
    timestamp: Date.now(),
  };
}
