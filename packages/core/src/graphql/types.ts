/**
 * Types for GraphQL Introspection, Schema Representation, and Autocomplete.
 */

export type GraphQLTypeKind =
  'SCALAR' | 'OBJECT' | 'INTERFACE' | 'UNION' | 'ENUM' | 'INPUT_OBJECT' | 'LIST' | 'NON_NULL';

export interface GraphQLTypeRef {
  kind: GraphQLTypeKind;
  name?: string;
  ofType?: GraphQLTypeRef;
}

export interface GraphQLArgument {
  name: string;
  description?: string;
  type: string;
  typeFormatted: string;
  defaultValue?: string;
}

export interface GraphQLField {
  name: string;
  description?: string;
  type: string;
  typeFormatted: string;
  returnTypeBase: string; // The unwrapped base type name e.g. "User"
  isList: boolean;
  isRequired: boolean;
  args: GraphQLArgument[];
  isDeprecated?: boolean;
  deprecationReason?: string;
}

export interface GraphQLEnumValue {
  name: string;
  description?: string;
  isDeprecated?: boolean;
}

export interface GraphQLNamedType {
  kind: GraphQLTypeKind;
  name: string;
  description?: string;
  fields?: GraphQLField[];
  inputFields?: GraphQLArgument[];
  enumValues?: GraphQLEnumValue[];
  possibleTypes?: string[];
  interfaces?: string[];
}

export interface GraphQLSchemaSummary {
  queryType?: string;
  mutationType?: string;
  subscriptionType?: string;
  queries: GraphQLField[];
  mutations: GraphQLField[];
  subscriptions: GraphQLField[];
  types: Record<string, GraphQLNamedType>;
  enums: Record<string, GraphQLEnumValue[]>;
  timestamp: number;
}

export interface GraphQLCompletionItem {
  label: string;
  kind: 'field' | 'argument' | 'type' | 'keyword' | 'directive';
  detail?: string;
  documentation?: string;
  insertText?: string;
}
