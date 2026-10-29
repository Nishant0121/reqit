import React, { useState } from 'react';
import {
  Sparkles,
  AlertCircle,
  AlertTriangle,
  CircleOff,
  Braces,
  FileText,
  ListFilter,
  Paperclip,
} from 'lucide-react';
import { Tabs } from './ui/Tabs';
import { KeyValueTable, type KeyValueRow } from './ui/KeyValueTable';
import { VariableInput, type VariableDetail } from './ui/VariableInput';
import { CodeEditor } from './editor/CodeEditor';
import { MultipartTable } from './MultipartTable';
import { COMMON_HEADER_NAMES, getHeaderValueSuggestions } from '../lib/http-constants';
import { strings } from '../lib/strings';
import type { MultipartRow } from '../stores/requestStore';
import { detectHardcodedSecrets } from '@reqit/core/format';

export type AuthType = 'none' | 'bearer' | 'basic' | 'apiKey';
export type BodyType = 'none' | 'json' | 'text' | 'form' | 'multipart';

const BODY_TYPE_OPTIONS = [
  { id: 'none', label: 'None', icon: CircleOff },
  { id: 'json', label: 'JSON', icon: Braces },
  { id: 'text', label: 'Text', icon: FileText },
  { id: 'form', label: 'Form URL-encoded', icon: ListFilter },
  { id: 'multipart', label: 'Multipart', icon: Paperclip },
] as const;

export interface RequestPanelProps {
  params: KeyValueRow[];
  onParamsChange: (rows: KeyValueRow[]) => void;
  headers: KeyValueRow[];
  onHeadersChange: (rows: KeyValueRow[]) => void;
  authType: AuthType;
  onAuthTypeChange: (type: AuthType) => void;
  bearerToken: string;
  onBearerTokenChange: (token: string) => void;
  basicUser: string;
  onBasicUserChange: (u: string) => void;
  basicPass: string;
  onBasicPassChange: (p: string) => void;
  apiKeyName: string;
  onApiKeyNameChange: (k: string) => void;
  apiKeyValue: string;
  onApiKeyValueChange: (v: string) => void;
  apiKeyIn: 'header' | 'query';
  onApiKeyInChange: (inLoc: 'header' | 'query') => void;
  bodyType: BodyType;
  onBodyTypeChange: (type: BodyType) => void;
  bodyContent: string;
  onBodyContentChange: (content: string) => void;
  bodyFormRows: KeyValueRow[];
  onBodyFormRowsChange: (rows: KeyValueRow[]) => void;
  bodyMultipartRows: MultipartRow[];
  onBodyMultipartRowsChange: (rows: MultipartRow[]) => void;
  knownVariables?: string[];
  variablesMap?: Record<string, VariableDetail>;
  onOpenSecrets?: () => void;
}

export function RequestPanel({
  params,
  onParamsChange,
  headers,
  onHeadersChange,
  authType,
  onAuthTypeChange,
  bearerToken,
  onBearerTokenChange,
  basicUser,
  onBasicUserChange,
  basicPass,
  onBasicPassChange,
  apiKeyName,
  onApiKeyNameChange,
  apiKeyValue,
  onApiKeyValueChange,
  apiKeyIn,
  onApiKeyInChange,
  bodyType,
  onBodyTypeChange,
  bodyContent,
  onBodyContentChange,
  bodyFormRows,
  onBodyFormRowsChange,
  bodyMultipartRows,
  onBodyMultipartRowsChange,
  knownVariables,
  variablesMap,
  onOpenSecrets,
}: RequestPanelProps): React.JSX.Element {
  const [activeSubTab, setActiveSubTab] = useState<
    'params' | 'headers' | 'auth' | 'body' | 'scripts'
  >('params');

  const [jsonFormatError, setJsonFormatError] = useState<string | null>(null);

  const activeParamsCount = params.filter(p => p.enabled && p.key.trim() !== '').length;
  const activeHeadersCount = headers.filter(h => h.enabled && h.key.trim() !== '').length;

  // Check for hardcoded secrets
  const hardcodedFindings = React.useMemo(() => {
    return detectHardcodedSecrets({
      version: 1,
      name: 'check',
      method: 'GET',
      url: '',
      headers: headers.filter(h => h.enabled).map(h => ({ name: h.key, value: h.value })),
      auth:
        authType === 'bearer'
          ? { type: 'bearer', token: bearerToken }
          : authType === 'basic'
            ? { type: 'basic', username: basicUser, password: basicPass }
            : authType === 'apiKey'
              ? { type: 'apikey', key: apiKeyName, value: apiKeyValue, in: apiKeyIn }
              : undefined,
    });
  }, [headers, authType, bearerToken, basicUser, basicPass, apiKeyName, apiKeyValue, apiKeyIn]);

  // Beautify JSON handler
  const handleBeautifyJson = () => {
    if (!bodyContent.trim()) return;
    try {
      const parsed = JSON.parse(bodyContent);
      const formatted = JSON.stringify(parsed, null, 2);
      onBodyContentChange(formatted);
      setJsonFormatError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setJsonFormatError(msg);
    }
  };

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      {/* Sub Tabs */}
      <Tabs
        items={[
          { id: 'params', label: strings.requestPanel.params, count: activeParamsCount },
          { id: 'headers', label: strings.requestPanel.headers, count: activeHeadersCount },
          { id: 'auth', label: strings.requestPanel.auth },
          { id: 'body', label: strings.requestPanel.body },
          { id: 'scripts', label: strings.requestPanel.scripts },
        ]}
        activeId={activeSubTab}
        onChange={id => setActiveSubTab(id as typeof activeSubTab)}
        className="px-3"
      />

      {/* Sub Tab Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Hardcoded Secret Warning Banner (Phase 11) */}
        {hardcodedFindings.length > 0 && (
          <div
            className="mb-3 px-3 py-2 rounded border flex items-center justify-between text-[12px] shrink-0"
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              borderColor: 'rgba(245, 158, 11, 0.4)',
              color: 'var(--text-primary)',
            }}
          >
            <div className="flex items-center gap-2 overflow-hidden mr-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="truncate">
                <span className="font-semibold text-amber-400">Hardcoded Token Warning:</span>{' '}
                <span className="text-[var(--text-secondary)]">
                  {hardcodedFindings[0]?.reason || 'Sensitive credential detected in plain text.'}
                </span>
              </div>
            </div>
            {onOpenSecrets && (
              <button
                type="button"
                onClick={onOpenSecrets}
                className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 shrink-0 transition-fast"
              >
                Move to Secrets
              </button>
            )}
          </div>
        )}
        {/* PARAMS TAB */}
        {activeSubTab === 'params' && (
          <KeyValueTable
            rows={params}
            onChange={onParamsChange}
            keyPlaceholder={strings.requestPanel.keyPlaceholder}
            valuePlaceholder={strings.requestPanel.valuePlaceholder}
            descriptionPlaceholder={strings.requestPanel.descriptionPlaceholder}
            knownVariables={knownVariables}
            variablesMap={variablesMap}
            showDescription
          />
        )}

        {/* HEADERS TAB with Autocomplete */}
        {activeSubTab === 'headers' && (
          <KeyValueTable
            rows={headers}
            onChange={onHeadersChange}
            keyPlaceholder={strings.requestPanel.keyPlaceholder}
            valuePlaceholder={strings.requestPanel.valuePlaceholder}
            descriptionPlaceholder={strings.requestPanel.descriptionPlaceholder}
            keySuggestions={COMMON_HEADER_NAMES}
            valueSuggestions={getHeaderValueSuggestions}
            knownVariables={knownVariables}
            variablesMap={variablesMap}
            showDescription
          />
        )}

        {/* AUTH TAB */}
        {activeSubTab === 'auth' && (
          <div className="max-w-md space-y-4">
            <div>
              <label
                className="block text-[12px] font-medium mb-1.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                {strings.requestPanel.authType}
              </label>
              <select
                value={authType}
                onChange={e => onAuthTypeChange(e.target.value as AuthType)}
                className="h-[28px] px-2 text-[13px] bg-transparent border rounded-[4px] app-focus-ring outline-none cursor-pointer w-full font-sans"
                style={{
                  borderColor: 'var(--border-strong)',
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-input)',
                }}
              >
                <option
                  value="none"
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                >
                  {strings.requestPanel.noAuth}
                </option>
                <option
                  value="bearer"
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                >
                  {strings.requestPanel.bearerToken}
                </option>
                <option
                  value="basic"
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                >
                  {strings.requestPanel.basicAuth}
                </option>
                <option
                  value="apiKey"
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                >
                  {strings.requestPanel.apiKey}
                </option>
              </select>
            </div>

            {/* Bearer Auth */}
            {authType === 'bearer' && (
              <div>
                <label
                  className="block text-[12px] font-medium mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {strings.requestPanel.bearerToken}
                </label>
                <VariableInput
                  value={bearerToken}
                  onChange={onBearerTokenChange}
                  knownVariables={knownVariables}
                  variablesMap={variablesMap}
                  placeholder={strings.requestPanel.tokenPlaceholder}
                />
              </div>
            )}

            {/* Basic Auth */}
            {authType === 'basic' && (
              <div className="space-y-3">
                <div>
                  <label
                    className="block text-[12px] font-medium mb-1"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {strings.requestPanel.usernamePlaceholder}
                  </label>
                  <VariableInput
                    value={basicUser}
                    onChange={onBasicUserChange}
                    knownVariables={knownVariables}
                    variablesMap={variablesMap}
                    placeholder={strings.requestPanel.usernamePlaceholder}
                  />
                </div>
                <div>
                  <label
                    className="block text-[12px] font-medium mb-1"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {strings.requestPanel.passwordPlaceholder}
                  </label>
                  <VariableInput
                    value={basicPass}
                    onChange={onBasicPassChange}
                    knownVariables={knownVariables}
                    variablesMap={variablesMap}
                    placeholder={strings.requestPanel.passwordPlaceholder}
                  />
                </div>
              </div>
            )}

            {/* API Key Auth */}
            {authType === 'apiKey' && (
              <div className="space-y-3">
                <div>
                  <label
                    className="block text-[12px] font-medium mb-1"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {strings.requestPanel.keyPlaceholder}
                  </label>
                  <VariableInput
                    value={apiKeyName}
                    onChange={onApiKeyNameChange}
                    knownVariables={knownVariables}
                    variablesMap={variablesMap}
                    placeholder="X-API-Key"
                  />
                </div>
                <div>
                  <label
                    className="block text-[12px] font-medium mb-1"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {strings.requestPanel.valuePlaceholder}
                  </label>
                  <VariableInput
                    value={apiKeyValue}
                    onChange={onApiKeyValueChange}
                    knownVariables={knownVariables}
                    variablesMap={variablesMap}
                    placeholder={strings.requestPanel.valuePlaceholder}
                  />
                </div>
                <div>
                  <label
                    className="block text-[12px] font-medium mb-1.5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Add to
                  </label>
                  <div
                    className="inline-flex items-center p-0.5 rounded-[6px] border select-none transition-fast"
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: 'var(--border)',
                    }}
                    role="radiogroup"
                    aria-label="API key location"
                  >
                    {[
                      { id: 'header', label: 'Header' },
                      { id: 'query', label: 'Query params' },
                    ].map(opt => {
                      const isSelected = apiKeyIn === opt.id;
                      return (
                        <label
                          key={opt.id}
                          className="relative flex items-center h-[26px] px-3 rounded-[4px] text-[12px] font-medium cursor-pointer transition-fast overflow-hidden"
                          style={{
                            backgroundColor: isSelected ? 'var(--bg-elevated)' : 'transparent',
                            color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                            border: `1px solid ${isSelected ? 'var(--border-strong)' : 'transparent'}`,
                            boxShadow: isSelected ? '0 1px 2px rgba(0, 0, 0, 0.25)' : 'none',
                          }}
                        >
                          <input
                            type="radio"
                            name="apiKeyIn"
                            value={opt.id}
                            checked={isSelected}
                            onChange={() => onApiKeyInChange(opt.id as 'header' | 'query')}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                          />
                          <span className="pointer-events-none relative z-0">{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* BODY TAB */}
        {activeSubTab === 'body' && (
          <div className="flex flex-col h-full space-y-3">
            {/* Format selector */}
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2.5">
                <span
                  className="text-[12px] font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Type:
                </span>
                <div
                  className="inline-flex items-center p-0.5 rounded-[6px] border select-none transition-fast"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderColor: 'var(--border)',
                  }}
                  role="radiogroup"
                  aria-label="Request body format"
                >
                  {BODY_TYPE_OPTIONS.map(opt => {
                    const isSelected = bodyType === opt.id;
                    const Icon = opt.icon;
                    return (
                      <label
                        key={opt.id}
                        className="relative flex items-center gap-1.5 h-[26px] px-2.5 rounded-[4px] text-[12px] font-medium cursor-pointer transition-fast overflow-hidden"
                        style={{
                          backgroundColor: isSelected ? 'var(--bg-elevated)' : 'transparent',
                          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                          border: `1px solid ${isSelected ? 'var(--border-strong)' : 'transparent'}`,
                          boxShadow: isSelected ? '0 1px 2px rgba(0, 0, 0, 0.25)' : 'none',
                        }}
                      >
                        <input
                          type="radio"
                          name="body-type-selector"
                          value={opt.id}
                          checked={isSelected}
                          onChange={() => {
                            onBodyTypeChange(opt.id);
                            setJsonFormatError(null);
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                        />
                        <Icon
                          className="w-4 h-4 shrink-0 transition-fast pointer-events-none relative z-0"
                          style={{
                            color: isSelected ? 'var(--accent)' : 'var(--text-muted)',
                          }}
                        />
                        <span className="pointer-events-none relative z-0">{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Beautify Button for JSON */}
              {bodyType === 'json' && (
                <button
                  type="button"
                  onClick={handleBeautifyJson}
                  className="inline-flex items-center gap-1.5 h-[28px] px-3 text-[12px] font-medium border rounded-[4px] hover:bg-[var(--bg-hover)] transition-fast app-focus-ring"
                  style={{
                    borderColor: 'var(--border-strong)',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                  }}
                  title="Format and prettify JSON"
                >
                  <Sparkles className="w-4 h-4 text-[var(--accent)]" strokeWidth={1.75} />
                  <span>Beautify</span>
                </button>
              )}
            </div>

            {/* JSON Error Warning */}
            {jsonFormatError && (
              <div
                className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] rounded-[4px] border"
                style={{
                  backgroundColor: 'var(--danger-subtle)',
                  borderColor: 'var(--danger)',
                  color: 'var(--danger)',
                }}
              >
                <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                <span>Invalid JSON: {jsonFormatError}</span>
              </div>
            )}

            {/* None Empty State */}
            {bodyType === 'none' && (
              <div
                className="flex items-center justify-center h-32 border border-dashed rounded-[4px] text-[12px]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                This request does not have a body.
              </div>
            )}

            {/* JSON Editor */}
            {bodyType === 'json' && (
              <div className="flex-1 min-h-[160px]">
                <CodeEditor
                  value={bodyContent}
                  onChange={val => {
                    onBodyContentChange(val);
                    if (jsonFormatError) setJsonFormatError(null);
                  }}
                  mode="json"
                  background="base"
                  minHeight="180px"
                  maxHeight="320px"
                />
              </div>
            )}

            {/* Plain Text Editor */}
            {bodyType === 'text' && (
              <div className="flex-1 min-h-[160px]">
                <CodeEditor
                  value={bodyContent}
                  onChange={onBodyContentChange}
                  mode="text"
                  background="base"
                  minHeight="180px"
                  maxHeight="320px"
                />
              </div>
            )}

            {/* Form URL-encoded Editor */}
            {bodyType === 'form' && (
              <div className="flex-1 min-h-[160px]">
                <KeyValueTable
                  rows={bodyFormRows}
                  onChange={onBodyFormRowsChange}
                  keyPlaceholder="Field name"
                  valuePlaceholder="Field value"
                  knownVariables={knownVariables}
                  showDescription
                />
              </div>
            )}

            {/* Multipart Editor with File Picker */}
            {bodyType === 'multipart' && (
              <div className="flex-1 min-h-[160px]">
                <MultipartTable
                  rows={bodyMultipartRows}
                  onChange={onBodyMultipartRowsChange}
                  knownVariables={knownVariables}
                />
              </div>
            )}
          </div>
        )}

        {/* SCRIPTS TAB */}
        {activeSubTab === 'scripts' && (
          <div className="text-[12px] p-4 text-center" style={{ color: 'var(--text-muted)' }}>
            Pre-request and post-response scripts can be configured here.
          </div>
        )}
      </div>
    </div>
  );
}
