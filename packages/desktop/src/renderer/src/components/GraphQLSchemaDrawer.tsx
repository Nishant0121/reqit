import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  ChevronRight,
  ChevronDown,
  Plus,
  RefreshCw,
  Database,
  FileCode,
} from 'lucide-react';
import { Button } from './ui/Button';
import type { GraphQLSchemaSummary, GraphQLNamedType, GraphQLField } from '@reqit/core';

export interface GraphQLSchemaDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  schema: GraphQLSchemaSummary | null;
  loading?: boolean;
  onIntrospect?: () => void;
  onInsertQuerySnippet?: (snippet: string) => void;
}

export function GraphQLSchemaDrawer({
  isOpen,
  onClose,
  schema,
  loading = false,
  onIntrospect,
  onInsertQuerySnippet,
}: GraphQLSchemaDrawerProps): React.JSX.Element | null {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'operations' | 'types' | 'enums'>('operations');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    queries: true,
    mutations: true,
    subscriptions: false,
  });
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleType = (typeName: string) => {
    setExpandedTypes(prev => ({ ...prev, [typeName]: !prev[typeName] }));
  };

  // Helper to generate a starter query snippet for a field
  const generateSnippetForField = (
    operationKind: 'query' | 'mutation' | 'subscription',
    field: GraphQLField,
  ): string => {
    const hasArgs = field.args && field.args.length > 0;
    const argsSignature = hasArgs
      ? `(${field.args.map(a => `${a.name}: $${a.name}`).join(', ')})`
      : '';
    const varDefs = hasArgs ? `(${field.args.map(a => `$${a.name}: ${a.type}`).join(', ')})` : '';

    // If return type is an object or list, inspect its fields from schema
    const rawTypeName = field.type.replace(/[[\]!]/g, '');
    const returnTypeObj = schema?.types[rawTypeName];
    let selectionFields = '';

    if (returnTypeObj && returnTypeObj.fields && returnTypeObj.fields.length > 0) {
      // Pick first 3-4 scalar fields
      const scalarFields = returnTypeObj.fields
        .filter(
          f =>
            !f.type.includes('[') &&
            ['String', 'ID', 'Int', 'Float', 'Boolean'].some(s => f.type.includes(s)),
        )
        .slice(0, 4);

      if (scalarFields.length > 0) {
        selectionFields = ` {\n    ${scalarFields.map(f => f.name).join('\n    ')}\n  }`;
      } else {
        const firstFields = returnTypeObj.fields.slice(0, 3);
        selectionFields = ` {\n    ${firstFields.map(f => f.name).join('\n    ')}\n  }`;
      }
    }

    if (operationKind === 'query') {
      if (hasArgs) {
        return `query Get${capitalize(field.name)}${varDefs} {\n  ${field.name}${argsSignature}${selectionFields}\n}\n`;
      }
      return `query {\n  ${field.name}${selectionFields}\n}\n`;
    }

    if (operationKind === 'mutation') {
      return `mutation ${capitalize(field.name)}${varDefs} {\n  ${field.name}${argsSignature}${selectionFields}\n}\n`;
    }

    return `subscription On${capitalize(field.name)}${varDefs} {\n  ${field.name}${argsSignature}${selectionFields}\n}\n`;
  };

  const filteredQueries = useMemo(() => {
    if (!schema?.queries) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return schema.queries;
    return schema.queries.filter(
      f =>
        f.name.toLowerCase().includes(q) ||
        f.type.toLowerCase().includes(q) ||
        (f.description && f.description.toLowerCase().includes(q)) ||
        f.args.some(a => a.name.toLowerCase().includes(q) || a.type.toLowerCase().includes(q)),
    );
  }, [schema, searchQuery]);

  const filteredMutations = useMemo(() => {
    if (!schema?.mutations) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return schema.mutations;
    return schema.mutations.filter(
      f =>
        f.name.toLowerCase().includes(q) ||
        f.type.toLowerCase().includes(q) ||
        (f.description && f.description.toLowerCase().includes(q)) ||
        f.args.some(a => a.name.toLowerCase().includes(q) || a.type.toLowerCase().includes(q)),
    );
  }, [schema, searchQuery]);

  const filteredSubscriptions = useMemo(() => {
    if (!schema?.subscriptions) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return schema.subscriptions;
    return schema.subscriptions.filter(
      f =>
        f.name.toLowerCase().includes(q) ||
        f.type.toLowerCase().includes(q) ||
        (f.description && f.description.toLowerCase().includes(q)) ||
        f.args.some(a => a.name.toLowerCase().includes(q) || a.type.toLowerCase().includes(q)),
    );
  }, [schema, searchQuery]);

  const filteredTypes = useMemo(() => {
    if (!schema?.types) return [];
    const q = searchQuery.toLowerCase().trim();
    const typeEntries = Object.values(schema.types).filter(t => t.kind !== 'ENUM');
    if (!q) return typeEntries;
    return typeEntries.filter(
      t =>
        t.name.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.fields &&
          t.fields.some(f => f.name.toLowerCase().includes(q) || f.type.toLowerCase().includes(q))),
    );
  }, [schema, searchQuery]);

  const filteredEnums = useMemo(() => {
    if (!schema?.types) return [];
    const q = searchQuery.toLowerCase().trim();
    const enumEntries = Object.values(schema.types).filter(t => t.kind === 'ENUM');
    if (!q) return enumEntries;
    return enumEntries.filter(
      t =>
        t.name.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.enumValues && t.enumValues.some(e => e.name.toLowerCase().includes(q))),
    );
  }, [schema, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 flex w-[480px] max-w-[90vw] flex-col border-l shadow-2xl transition-all duration-200"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-strong)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-(--accent)" />
          <h2 className="text-[13px] font-semibold text-(--text-primary)">
            GraphQL Schema Explorer
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          {onIntrospect && (
            <Button
              variant="secondary"
              size="compact"
              onClick={onIntrospect}
              disabled={loading}
              title="Refresh GraphQL Introspection"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Introspecting...' : 'Refresh'}</span>
            </Button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-(--text-muted) hover:bg-(--bg-hover) hover:text-(--text-primary)"
            title="Close explorer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="border-b p-3" style={{ borderColor: 'var(--border)' }}>
        <div className="relative">
          <Search className="absolute top-2.5 left-2.5 h-3.5 w-3.5 text-(--text-muted)" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search queries, mutations, types, fields..."
            className="w-full rounded border py-1.5 pr-7 pl-8 font-mono text-[12px] outline-none"
            style={{
              backgroundColor: 'var(--bg-input)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute top-2 right-2 text-(--text-muted) hover:text-(--text-primary)"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex border-b text-[12px] font-medium"
        style={{ borderColor: 'var(--border)' }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('operations')}
          className={`flex-1 py-2 text-center transition-colors ${
            activeTab === 'operations'
              ? 'border-b-2 border-(--accent) font-semibold text-(--accent)'
              : 'text-(--text-secondary) hover:text-(--text-primary)'
          }`}
        >
          Operations (
          {(schema?.queries?.length || 0) +
            (schema?.mutations?.length || 0) +
            (schema?.subscriptions?.length || 0)}
          )
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('types')}
          className={`flex-1 py-2 text-center transition-colors ${
            activeTab === 'types'
              ? 'border-b-2 border-(--accent) font-semibold text-(--accent)'
              : 'text-(--text-secondary) hover:text-(--text-primary)'
          }`}
        >
          Types ({filteredTypes.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('enums')}
          className={`flex-1 py-2 text-center transition-colors ${
            activeTab === 'enums'
              ? 'border-b-2 border-(--accent) font-semibold text-(--accent)'
              : 'text-(--text-secondary) hover:text-(--text-primary)'
          }`}
        >
          Enums ({filteredEnums.length})
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {!schema ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileCode className="mb-2 h-8 w-8 text-(--text-muted)" />
            <p className="text-[13px] font-medium text-(--text-primary)">No Schema Loaded</p>
            <p className="mt-1 max-w-[300px] text-[12px] text-(--text-secondary)">
              Click &quot;Refresh&quot; or &quot;Introspect&quot; in the request panel to inspect
              the GraphQL endpoint.
            </p>
            {onIntrospect && (
              <Button
                variant="primary"
                size="compact"
                className="mt-4"
                onClick={onIntrospect}
                disabled={loading}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Introspect Schema</span>
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* OPERATIONS TAB */}
            {activeTab === 'operations' && (
              <div className="space-y-4">
                {/* Queries */}
                {schema.queries && schema.queries.length > 0 && (
                  <div className="rounded border" style={{ borderColor: 'var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => toggleSection('queries')}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-[12px] font-medium hover:bg-(--bg-hover)"
                    >
                      <div className="flex items-center gap-1.5">
                        {expandedSections.queries ? (
                          <ChevronDown className="h-3.5 w-3.5 text-(--text-muted)" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-(--text-muted)" />
                        )}
                        <span className="font-semibold text-(--accent)">Queries</span>
                        <span className="text-[11px] text-(--text-muted)">
                          ({filteredQueries.length})
                        </span>
                      </div>
                    </button>
                    {expandedSections.queries && (
                      <div className="divide-y border-t" style={{ borderColor: 'var(--border)' }}>
                        {filteredQueries.length === 0 ? (
                          <div className="p-3 text-[11px] text-(--text-muted)">
                            No queries match &quot;{searchQuery}&quot;
                          </div>
                        ) : (
                          filteredQueries.map(field => (
                            <OperationRow
                              key={field.name}
                              field={field}
                              operationKind="query"
                              onInsert={snippet => onInsertQuerySnippet?.(snippet)}
                              generateSnippet={f => generateSnippetForField('query', f)}
                            />
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Mutations */}
                {schema.mutations && schema.mutations.length > 0 && (
                  <div className="rounded border" style={{ borderColor: 'var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => toggleSection('mutations')}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-[12px] font-medium hover:bg-(--bg-hover)"
                    >
                      <div className="flex items-center gap-1.5">
                        {expandedSections.mutations ? (
                          <ChevronDown className="h-3.5 w-3.5 text-(--text-muted)" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-(--text-muted)" />
                        )}
                        <span className="font-semibold text-emerald-500">Mutations</span>
                        <span className="text-[11px] text-(--text-muted)">
                          ({filteredMutations.length})
                        </span>
                      </div>
                    </button>
                    {expandedSections.mutations && (
                      <div className="divide-y border-t" style={{ borderColor: 'var(--border)' }}>
                        {filteredMutations.length === 0 ? (
                          <div className="p-3 text-[11px] text-(--text-muted)">
                            No mutations match &quot;{searchQuery}&quot;
                          </div>
                        ) : (
                          filteredMutations.map(field => (
                            <OperationRow
                              key={field.name}
                              field={field}
                              operationKind="mutation"
                              onInsert={snippet => onInsertQuerySnippet?.(snippet)}
                              generateSnippet={f => generateSnippetForField('mutation', f)}
                            />
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Subscriptions */}
                {schema.subscriptions && schema.subscriptions.length > 0 && (
                  <div className="rounded border" style={{ borderColor: 'var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => toggleSection('subscriptions')}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-[12px] font-medium hover:bg-(--bg-hover)"
                    >
                      <div className="flex items-center gap-1.5">
                        {expandedSections.subscriptions ? (
                          <ChevronDown className="h-3.5 w-3.5 text-(--text-muted)" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-(--text-muted)" />
                        )}
                        <span className="font-semibold text-purple-400">Subscriptions</span>
                        <span className="text-[11px] text-(--text-muted)">
                          ({filteredSubscriptions.length})
                        </span>
                      </div>
                    </button>
                    {expandedSections.subscriptions && (
                      <div className="divide-y border-t" style={{ borderColor: 'var(--border)' }}>
                        {filteredSubscriptions.length === 0 ? (
                          <div className="p-3 text-[11px] text-(--text-muted)">
                            No subscriptions match &quot;{searchQuery}&quot;
                          </div>
                        ) : (
                          filteredSubscriptions.map(field => (
                            <OperationRow
                              key={field.name}
                              field={field}
                              operationKind="subscription"
                              onInsert={snippet => onInsertQuerySnippet?.(snippet)}
                              generateSnippet={f => generateSnippetForField('subscription', f)}
                            />
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TYPES TAB */}
            {activeTab === 'types' && (
              <div className="space-y-2">
                {filteredTypes.length === 0 ? (
                  <div className="py-6 text-center text-[12px] text-(--text-muted)">
                    No types found.
                  </div>
                ) : (
                  filteredTypes.map(t => (
                    <TypeCard
                      key={t.name}
                      type={t}
                      isExpanded={Boolean(expandedTypes[t.name])}
                      onToggle={() => toggleType(t.name)}
                    />
                  ))
                )}
              </div>
            )}

            {/* ENUMS TAB */}
            {activeTab === 'enums' && (
              <div className="space-y-2">
                {filteredEnums.length === 0 ? (
                  <div className="py-6 text-center text-[12px] text-(--text-muted)">
                    No enums found.
                  </div>
                ) : (
                  filteredEnums.map(t => (
                    <EnumCard
                      key={t.name}
                      type={t}
                      isExpanded={Boolean(expandedTypes[t.name])}
                      onToggle={() => toggleType(t.name)}
                    />
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function OperationRow({
  field,
  operationKind: _operationKind,
  onInsert,
  generateSnippet,
}: {
  field: GraphQLField;
  operationKind: 'query' | 'mutation' | 'subscription';
  onInsert: (snippet: string) => void;
  generateSnippet: (f: GraphQLField) => string;
}): React.JSX.Element {
  return (
    <div className="p-3 transition-colors hover:bg-(--bg-hover)">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 font-mono text-[12px]">
          <span className="font-semibold text-(--text-primary)">{field.name}</span>
          {field.args && field.args.length > 0 && (
            <span className="text-(--text-muted)">
              (
              {field.args.map((arg, idx) => (
                <span key={arg.name}>
                  {idx > 0 && ', '}
                  <span className="text-(--text-secondary)">{arg.name}</span>:{' '}
                  <span className="text-(--accent)">{arg.type}</span>
                </span>
              ))}
              )
            </span>
          )}
          <span className="text-(--text-muted)">: </span>
          <span className="font-medium text-emerald-400">{field.type}</span>
        </div>
        <Button
          variant="secondary"
          size="compact"
          onClick={() => onInsert(generateSnippet(field))}
          title="Insert query snippet into editor"
        >
          <Plus className="h-3 w-3" />
          <span>Insert</span>
        </Button>
      </div>
      {field.description && (
        <p className="mt-1 text-[11px] text-(--text-muted)">{field.description}</p>
      )}
    </div>
  );
}

function TypeCard({
  type,
  isExpanded,
  onToggle,
}: {
  type: GraphQLNamedType;
  isExpanded: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  return (
    <div className="rounded border" style={{ borderColor: 'var(--border)' }}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-2.5 text-left font-mono text-[12px] hover:bg-(--bg-hover)"
      >
        <div className="flex items-center gap-1.5">
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-(--text-muted)" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-(--text-muted)" />
          )}
          <span className="font-semibold text-(--text-primary)">{type.name}</span>
          <span className="text-[10px] text-(--text-muted) uppercase">[{type.kind}]</span>
        </div>
        {type.fields && (
          <span className="text-[11px] text-(--text-muted)">{type.fields.length} fields</span>
        )}
      </button>

      {isExpanded && type.fields && (
        <div
          className="divide-y border-t bg-(--bg-base) p-2"
          style={{ borderColor: 'var(--border)' }}
        >
          {type.description && (
            <p className="mb-2 text-[11px] text-(--text-muted)">{type.description}</p>
          )}
          {type.fields.map(f => (
            <div key={f.name} className="py-1 font-mono text-[11px]">
              <span className="text-(--text-primary)">{f.name}</span>
              {f.args && f.args.length > 0 && (
                <span className="text-(--text-muted)">
                  ({f.args.map(a => `${a.name}: ${a.type}`).join(', ')})
                </span>
              )}
              <span className="text-(--text-muted)">: </span>
              <span className="text-(--accent)">{f.type}</span>
              {f.description && (
                <span className="block text-[10px] text-(--text-muted)">{f.description}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EnumCard({
  type,
  isExpanded,
  onToggle,
}: {
  type: GraphQLNamedType;
  isExpanded: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  return (
    <div className="rounded border" style={{ borderColor: 'var(--border)' }}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-2.5 text-left font-mono text-[12px] hover:bg-(--bg-hover)"
      >
        <div className="flex items-center gap-1.5">
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-(--text-muted)" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-(--text-muted)" />
          )}
          <span className="font-semibold text-(--text-primary)">{type.name}</span>
        </div>
        {type.enumValues && (
          <span className="text-[11px] text-(--text-muted)">{type.enumValues.length} values</span>
        )}
      </button>

      {isExpanded && type.enumValues && (
        <div className="border-t bg-(--bg-base) p-2.5" style={{ borderColor: 'var(--border)' }}>
          {type.description && (
            <p className="mb-2 text-[11px] text-(--text-muted)">{type.description}</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {type.enumValues.map(v => (
              <span
                key={v.name}
                className="rounded border bg-(--bg-surface) px-2 py-0.5 font-mono text-[11px] text-(--text-primary)"
                style={{ borderColor: 'var(--border)' }}
              >
                {v.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
