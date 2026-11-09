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
  Plus,
  Trash2,
  FlaskConical,
  Cookie as CookieIcon,
  KeyRound,
  RefreshCw,
} from 'lucide-react';
import { Tabs } from './ui/Tabs';
import { KeyValueTable, type KeyValueRow } from './ui/KeyValueTable';
import { VariableInput, type VariableDetail } from './ui/VariableInput';
import { CodeEditor } from './editor/CodeEditor';
import { MultipartTable } from './MultipartTable';
import { COMMON_HEADER_NAMES, getHeaderValueSuggestions } from '../lib/http-constants';
import { strings } from '../lib/strings';
import type { MultipartRow, TestAssertionItem } from '../stores/requestStore';
import { detectHardcodedSecrets, type Auth } from '@reqit/core/format';

export type AuthType = 'none' | 'bearer' | 'basic' | 'apiKey' | 'oauth2' | 'digest' | 'awsv4';
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
  // Extra Auth: OAuth 2.0
  oauthGrantType?: 'authorization_code' | 'client_credentials';
  onOauthGrantTypeChange?: (grantType: 'authorization_code' | 'client_credentials') => void;
  oauthAuthUrl?: string;
  onOauthAuthUrlChange?: (url: string) => void;
  oauthTokenUrl?: string;
  onOauthTokenUrlChange?: (url: string) => void;
  oauthClientId?: string;
  onOauthClientIdChange?: (id: string) => void;
  oauthClientSecret?: string;
  onOauthClientSecretChange?: (secret: string) => void;
  oauthScope?: string;
  onOauthScopeChange?: (scope: string) => void;
  oauthRedirectUri?: string;
  onOauthRedirectUriChange?: (uri: string) => void;
  oauthUsePkce?: boolean;
  onOauthUsePkceChange?: (usePkce: boolean) => void;
  oauthAccessToken?: string;
  onOauthAccessTokenChange?: (token: string) => void;
  // Extra Auth: Digest
  digestUser?: string;
  onDigestUserChange?: (u: string) => void;
  digestPass?: string;
  onDigestPassChange?: (p: string) => void;
  digestRealm?: string;
  onDigestRealmChange?: (r: string) => void;
  // Extra Auth: AWS SigV4
  awsAccessKeyId?: string;
  onAwsAccessKeyIdChange?: (k: string) => void;
  awsSecretAccessKey?: string;
  onAwsSecretAccessKeyChange?: (s: string) => void;
  awsRegion?: string;
  onAwsRegionChange?: (r: string) => void;
  awsService?: string;
  onAwsServiceChange?: (s: string) => void;
  awsSessionToken?: string;
  onAwsSessionTokenChange?: (t: string) => void;
  // Cookie jar
  disableCookieJar?: boolean;
  onDisableCookieJarChange?: (disabled: boolean) => void;
  onOpenCookieManager?: () => void;
  collectionPath?: string;
  activeEnvironment?: string;
  bodyType: BodyType;
  onBodyTypeChange: (type: BodyType) => void;
  bodyContent: string;
  onBodyContentChange: (content: string) => void;
  bodyFormRows: KeyValueRow[];
  onBodyFormRowsChange: (rows: KeyValueRow[]) => void;
  bodyMultipartRows: MultipartRow[];
  onBodyMultipartRowsChange: (rows: MultipartRow[]) => void;
  preScript?: string;
  onPreScriptChange?: (script: string) => void;
  postScript?: string;
  onPostScriptChange?: (script: string) => void;
  tests?: TestAssertionItem[];
  onTestsChange?: (tests: TestAssertionItem[]) => void;
  isWorkspaceTrusted?: boolean;
  onTrustWorkspace?: () => void;
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
  // Extra Auth: OAuth 2.0
  oauthGrantType = 'authorization_code',
  onOauthGrantTypeChange,
  oauthAuthUrl = '',
  onOauthAuthUrlChange,
  oauthTokenUrl = '',
  onOauthTokenUrlChange,
  oauthClientId = '',
  onOauthClientIdChange,
  oauthClientSecret = '',
  onOauthClientSecretChange,
  oauthScope = '',
  onOauthScopeChange,
  oauthRedirectUri = '',
  onOauthRedirectUriChange,
  oauthUsePkce = true,
  onOauthUsePkceChange,
  oauthAccessToken = '',
  onOauthAccessTokenChange,
  // Extra Auth: Digest
  digestUser = '',
  onDigestUserChange,
  digestPass = '',
  onDigestPassChange,
  digestRealm = '',
  onDigestRealmChange,
  // Extra Auth: AWS SigV4
  awsAccessKeyId = '',
  onAwsAccessKeyIdChange,
  awsSecretAccessKey = '',
  onAwsSecretAccessKeyChange,
  awsRegion = 'us-east-1',
  onAwsRegionChange,
  awsService = '',
  onAwsServiceChange,
  awsSessionToken = '',
  onAwsSessionTokenChange,
  // Cookie jar
  disableCookieJar = false,
  onDisableCookieJarChange,
  onOpenCookieManager,
  collectionPath,
  activeEnvironment,
  bodyType,
  onBodyTypeChange,
  bodyContent,
  onBodyContentChange,
  bodyFormRows,
  onBodyFormRowsChange,
  bodyMultipartRows,
  onBodyMultipartRowsChange,
  preScript = '',
  onPreScriptChange,
  postScript = '',
  onPostScriptChange,
  tests = [],
  onTestsChange,
  isWorkspaceTrusted = true,
  onTrustWorkspace,
  knownVariables,
  variablesMap,
  onOpenSecrets,
}: RequestPanelProps): React.JSX.Element {
  const [activeSubTab, setActiveSubTab] = useState<
    'params' | 'headers' | 'auth' | 'body' | 'scripts' | 'tests'
  >('params');
  const [scriptSubTab, setScriptSubTab] = useState<'pre' | 'post'>('pre');

  const [jsonFormatError, setJsonFormatError] = useState<string | null>(null);

  const activeParamsCount = params.filter(p => p.enabled && p.key.trim() !== '').length;
  const activeHeadersCount = headers.filter(h => h.enabled && h.key.trim() !== '').length;
  const activeTestsCount = (tests || []).filter(
    t => t.enabled !== false && (t.name.trim() !== '' || t.assert.trim() !== ''),
  ).length;

  const handleAddTest = (initialName = '', initialAssert = '') => {
    const newTest: TestAssertionItem = {
      id: `test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: initialName,
      assert: initialAssert,
      enabled: true,
    };
    onTestsChange?.([...(tests || []), newTest]);
  };

  const handleUpdateTest = (id: string, updates: Partial<TestAssertionItem>) => {
    const updated = (tests || []).map(t => (t.id === id ? { ...t, ...updates } : t));
    onTestsChange?.(updated);
  };

  const handleDeleteTest = (id: string) => {
    const updated = (tests || []).filter(t => t.id !== id);
    onTestsChange?.(updated);
  };

  // Check for hardcoded secrets
  const hardcodedFindings = React.useMemo(() => {
    let authObj: Auth | undefined = undefined;
    if (authType === 'bearer') {
      authObj = { type: 'bearer', token: bearerToken };
    } else if (authType === 'basic') {
      authObj = { type: 'basic', username: basicUser, password: basicPass };
    } else if (authType === 'apiKey') {
      authObj = { type: 'apikey', key: apiKeyName, value: apiKeyValue, in: apiKeyIn };
    } else if (authType === 'oauth2') {
      authObj = {
        type: 'oauth2',
        grantType: oauthGrantType,
        tokenUrl: oauthTokenUrl,
        clientId: oauthClientId,
        clientSecret: oauthClientSecret,
        accessToken: oauthAccessToken,
      };
    } else if (authType === 'digest') {
      authObj = { type: 'digest', username: digestUser, password: digestPass, realm: digestRealm };
    } else if (authType === 'awsv4') {
      authObj = {
        type: 'awsv4',
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
        region: awsRegion,
        service: awsService,
      };
    }

    return detectHardcodedSecrets({
      version: 1,
      name: 'check',
      method: 'GET',
      url: '',
      headers: headers.filter(h => h.enabled).map(h => ({ name: h.key, value: h.value })),
      auth: authObj,
    });
  }, [
    headers,
    authType,
    bearerToken,
    basicUser,
    basicPass,
    apiKeyName,
    apiKeyValue,
    apiKeyIn,
    oauthGrantType,
    oauthTokenUrl,
    oauthClientId,
    oauthClientSecret,
    oauthAccessToken,
    digestUser,
    digestPass,
    digestRealm,
    awsAccessKeyId,
    awsSecretAccessKey,
    awsRegion,
    awsService,
  ]);

  const [oauthLoading, setOauthLoading] = useState<boolean>(false);
  const [oauthStatusMsg, setOauthStatusMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleFetchOAuthToken = async () => {
    setOauthStatusMsg(null);
    setOauthLoading(true);
    try {
      if (oauthGrantType === 'client_credentials') {
        if (!oauthTokenUrl?.trim() || !oauthClientId?.trim()) {
          throw new Error('Access Token URL and Client ID are required.');
        }
        if (!window.reqitApi?.fetchOAuthClientCredentials) {
          throw new Error('OAuth API not available');
        }
        const tokenResult = await window.reqitApi.fetchOAuthClientCredentials({
          tokenUrl: oauthTokenUrl,
          clientId: oauthClientId,
          clientSecret: oauthClientSecret || '',
          scope: oauthScope,
          collectionPath,
          activeEnvironment,
        });
        onOauthAccessTokenChange?.(tokenResult.accessToken);
        setOauthStatusMsg({
          type: 'success',
          text: `Token received successfully! Expires in ${tokenResult.expiresIn ?? 'N/A'}s`,
        });
      } else {
        // authorization_code
        if (!oauthAuthUrl?.trim() || !oauthTokenUrl?.trim() || !oauthClientId?.trim()) {
          throw new Error('Auth URL, Token URL, and Client ID are required.');
        }
        if (!window.reqitApi?.startOAuthAuthCodeFlow) {
          throw new Error('OAuth API not available');
        }
        const tokenResult = await window.reqitApi.startOAuthAuthCodeFlow({
          authUrl: oauthAuthUrl,
          tokenUrl: oauthTokenUrl,
          clientId: oauthClientId,
          clientSecret: oauthClientSecret,
          scope: oauthScope,
          redirectUri: oauthRedirectUri,
          usePkce: oauthUsePkce !== false,
          collectionPath,
          activeEnvironment,
        });
        onOauthAccessTokenChange?.(tokenResult.accessToken);
        setOauthStatusMsg({
          type: 'success',
          text: `Token received from browser! Expires in ${tokenResult.expiresIn ?? 'N/A'}s`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setOauthStatusMsg({ type: 'error', text: msg });
    } finally {
      setOauthLoading(false);
    }
  };

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
      className="flex h-full flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      {/* Sub Tabs */}
      <div
        className="flex shrink-0 items-center justify-between border-b px-3"
        style={{ borderColor: 'var(--border)' }}
      >
        <Tabs
          items={[
            { id: 'params', label: strings.requestPanel.params, count: activeParamsCount },
            { id: 'headers', label: strings.requestPanel.headers, count: activeHeadersCount },
            { id: 'auth', label: strings.requestPanel.auth },
            { id: 'body', label: strings.requestPanel.body },
            {
              id: 'scripts',
              label: strings.requestPanel.scripts,
              count: (preScript.trim() ? 1 : 0) + (postScript.trim() ? 1 : 0) || undefined,
            },
            {
              id: 'tests',
              label: strings.requestPanel.tests,
              count: activeTestsCount || undefined,
            },
          ]}
          activeId={activeSubTab}
          onChange={id => setActiveSubTab(id as typeof activeSubTab)}
        />

        {/* Cookie Jar toggle & Manager button (Phase 18) */}
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-(--text-secondary) select-none hover:text-(--text-primary)">
            <input
              type="checkbox"
              checked={!disableCookieJar}
              onChange={e => onDisableCookieJarChange?.(!e.target.checked)}
              className="h-3.5 w-3.5 rounded border-(--border) accent-(--accent)"
            />
            <span>Send cookies</span>
          </label>
          {onOpenCookieManager && (
            <button
              type="button"
              onClick={onOpenCookieManager}
              className="transition-fast flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary)"
              title="Manage collection cookies"
            >
              <CookieIcon className="h-3.5 w-3.5" />
              <span>Cookies</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub Tab Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Hardcoded Secret Warning Banner (Phase 11) */}
        {hardcodedFindings.length > 0 && (
          <div
            className="mb-3 flex shrink-0 items-center justify-between rounded border px-3 py-2 text-[12px]"
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              borderColor: 'rgba(245, 158, 11, 0.4)',
              color: 'var(--text-primary)',
            }}
          >
            <div className="mr-2 flex items-center gap-2 overflow-hidden">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
              <div className="truncate">
                <span className="font-semibold text-amber-400">Hardcoded Token Warning:</span>{' '}
                <span className="text-(--text-secondary)">
                  {hardcodedFindings[0]?.reason || 'Sensitive credential detected in plain text.'}
                </span>
              </div>
            </div>
            {onOpenSecrets && (
              <button
                type="button"
                onClick={onOpenSecrets}
                className="transition-fast shrink-0 rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-300 hover:bg-amber-500/30"
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
                className="mb-1.5 block text-[12px] font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                {strings.requestPanel.authType}
              </label>
              <select
                value={authType}
                onChange={e => onAuthTypeChange(e.target.value as AuthType)}
                className="app-focus-ring h-7 w-full cursor-pointer rounded-sm border bg-transparent px-2 font-sans text-[13px] outline-none"
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
                <option
                  value="oauth2"
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                >
                  OAuth 2.0
                </option>
                <option
                  value="digest"
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                >
                  Digest Auth
                </option>
                <option
                  value="awsv4"
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                >
                  AWS Signature v4
                </option>
              </select>
            </div>

            {/* Bearer Auth */}
            {authType === 'bearer' && (
              <div>
                <label
                  className="mb-1.5 block text-[12px] font-medium"
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
                    className="mb-1 block text-[12px] font-medium"
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
                    className="mb-1 block text-[12px] font-medium"
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
                    className="mb-1 block text-[12px] font-medium"
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
                    className="mb-1 block text-[12px] font-medium"
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
                    className="mb-1.5 block text-[12px] font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Add to
                  </label>
                  <div
                    className="transition-fast inline-flex items-center rounded-md border p-0.5 select-none"
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
                          className="transition-fast relative flex h-6.5 cursor-pointer items-center overflow-hidden rounded-sm px-3 text-[12px] font-medium"
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
                            className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                          />
                          <span className="pointer-events-none relative z-0">{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* OAuth 2.0 Auth (Phase 18) */}
            {authType === 'oauth2' && (
              <div className="space-y-3.5">
                <div>
                  <label
                    className="mb-1 block text-[12px] font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Grant Type
                  </label>
                  <div className="flex items-center gap-4 text-[12px]">
                    <label className="flex cursor-pointer items-center gap-1.5 text-(--text-primary)">
                      <input
                        type="radio"
                        name="oauthGrantType"
                        value="authorization_code"
                        checked={oauthGrantType === 'authorization_code'}
                        onChange={() => onOauthGrantTypeChange?.('authorization_code')}
                        className="accent-(--accent)"
                      />
                      <span>Authorization Code (PKCE)</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5 text-(--text-primary)">
                      <input
                        type="radio"
                        name="oauthGrantType"
                        value="client_credentials"
                        checked={oauthGrantType === 'client_credentials'}
                        onChange={() => onOauthGrantTypeChange?.('client_credentials')}
                        className="accent-(--accent)"
                      />
                      <span>Client Credentials</span>
                    </label>
                  </div>
                </div>

                {oauthGrantType === 'authorization_code' && (
                  <div>
                    <label
                      className="mb-1 block text-[12px] font-medium"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Auth URL <span className="text-red-400">*</span>
                    </label>
                    <VariableInput
                      value={oauthAuthUrl}
                      onChange={v => onOauthAuthUrlChange?.(v)}
                      knownVariables={knownVariables}
                      variablesMap={variablesMap}
                      placeholder="https://auth.example.com/oauth/authorize"
                    />
                  </div>
                )}

                <div>
                  <label
                    className="mb-1 block text-[12px] font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Access Token URL <span className="text-red-400">*</span>
                  </label>
                  <VariableInput
                    value={oauthTokenUrl}
                    onChange={v => onOauthTokenUrlChange?.(v)}
                    knownVariables={knownVariables}
                    variablesMap={variablesMap}
                    placeholder="https://auth.example.com/oauth/token"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      className="mb-1 block text-[12px] font-medium"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Client ID <span className="text-red-400">*</span>
                    </label>
                    <VariableInput
                      value={oauthClientId}
                      onChange={v => onOauthClientIdChange?.(v)}
                      knownVariables={knownVariables}
                      variablesMap={variablesMap}
                      placeholder="client_id or {{client_id}}"
                    />
                  </div>
                  <div>
                    <label
                      className="mb-1 block text-[12px] font-medium"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Client Secret{' '}
                      {oauthGrantType === 'client_credentials' && (
                        <span className="text-red-400">*</span>
                      )}
                    </label>
                    <VariableInput
                      value={oauthClientSecret}
                      onChange={v => onOauthClientSecretChange?.(v)}
                      knownVariables={knownVariables}
                      variablesMap={variablesMap}
                      placeholder="client_secret or {{client_secret}}"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      className="mb-1 block text-[12px] font-medium"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Scope
                    </label>
                    <VariableInput
                      value={oauthScope}
                      onChange={v => onOauthScopeChange?.(v)}
                      knownVariables={knownVariables}
                      variablesMap={variablesMap}
                      placeholder="read write email"
                    />
                  </div>
                  {oauthGrantType === 'authorization_code' && (
                    <div>
                      <label
                        className="mb-1 block text-[12px] font-medium"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Callback / Redirect URI
                      </label>
                      <VariableInput
                        value={oauthRedirectUri}
                        onChange={v => onOauthRedirectUriChange?.(v)}
                        knownVariables={knownVariables}
                        variablesMap={variablesMap}
                        placeholder="http://127.0.0.1:41920/callback"
                      />
                    </div>
                  )}
                </div>

                {oauthGrantType === 'authorization_code' && (
                  <div className="flex items-center gap-2">
                    <label className="flex cursor-pointer items-center gap-2 text-[12px] text-(--text-secondary)">
                      <input
                        type="checkbox"
                        checked={oauthUsePkce}
                        onChange={e => onOauthUsePkceChange?.(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-(--border) accent-(--accent)"
                      />
                      <span>Use PKCE (SHA-256 Code Challenge)</span>
                    </label>
                  </div>
                )}

                {/* Fetch token action */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleFetchOAuthToken}
                    disabled={oauthLoading}
                    className="transition-fast inline-flex cursor-pointer items-center gap-1.5 rounded bg-(--accent) px-3 py-1.5 text-[12px] font-medium text-(--accent-fg) hover:opacity-90 disabled:opacity-50"
                  >
                    {oauthLoading ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <KeyRound className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {oauthLoading
                        ? oauthGrantType === 'authorization_code'
                          ? 'Waiting for browser...'
                          : 'Requesting token...'
                        : 'Get New Access Token'}
                    </span>
                  </button>
                </div>

                {/* Status / feedback message */}
                {oauthStatusMsg && (
                  <div
                    className={`rounded border p-2 text-[11px] ${
                      oauthStatusMsg.type === 'success'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                        : 'border-red-500/30 bg-red-500/10 text-red-400'
                    }`}
                  >
                    {oauthStatusMsg.text}
                  </div>
                )}

                {/* Token display */}
                {oauthAccessToken && (
                  <div className="border-t border-(--border) pt-2">
                    <div className="mb-1 flex items-center justify-between">
                      <label className="block text-[12px] font-medium text-emerald-400">
                        Active Access Token
                      </label>
                      <button
                        type="button"
                        onClick={() => onOauthAccessTokenChange?.('')}
                        className="text-[11px] text-(--text-muted) hover:text-red-400"
                      >
                        Clear Token
                      </button>
                    </div>
                    <VariableInput
                      value={oauthAccessToken}
                      onChange={v => onOauthAccessTokenChange?.(v)}
                      knownVariables={knownVariables}
                      variablesMap={variablesMap}
                      placeholder="Access Token"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Digest Auth (Phase 18) */}
            {authType === 'digest' && (
              <div className="space-y-3">
                <div>
                  <label
                    className="mb-1 block text-[12px] font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Username <span className="text-red-400">*</span>
                  </label>
                  <VariableInput
                    value={digestUser}
                    onChange={v => onDigestUserChange?.(v)}
                    knownVariables={knownVariables}
                    variablesMap={variablesMap}
                    placeholder="Username"
                  />
                </div>
                <div>
                  <label
                    className="mb-1 block text-[12px] font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Password <span className="text-red-400">*</span>
                  </label>
                  <VariableInput
                    value={digestPass}
                    onChange={v => onDigestPassChange?.(v)}
                    knownVariables={knownVariables}
                    variablesMap={variablesMap}
                    placeholder="Password"
                  />
                </div>
                <div>
                  <label
                    className="mb-1 block text-[12px] font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Realm (optional)
                  </label>
                  <VariableInput
                    value={digestRealm}
                    onChange={v => onDigestRealmChange?.(v)}
                    knownVariables={knownVariables}
                    variablesMap={variablesMap}
                    placeholder="Auth Realm (optional override)"
                  />
                </div>
                <p className="text-[11px] text-(--text-muted)">
                  Reqit automatically sends the request and calculates the RFC 7616 / RFC 2617
                  challenge-response upon receiving a 401 Unauthorized status.
                </p>
              </div>
            )}

            {/* AWS Signature v4 Auth (Phase 18) */}
            {authType === 'awsv4' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      className="mb-1 block text-[12px] font-medium"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Access Key ID <span className="text-red-400">*</span>
                    </label>
                    <VariableInput
                      value={awsAccessKeyId}
                      onChange={v => onAwsAccessKeyIdChange?.(v)}
                      knownVariables={knownVariables}
                      variablesMap={variablesMap}
                      placeholder="AKIAIOSFODNN7EXAMPLE"
                    />
                  </div>
                  <div>
                    <label
                      className="mb-1 block text-[12px] font-medium"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Secret Access Key <span className="text-red-400">*</span>
                    </label>
                    <VariableInput
                      value={awsSecretAccessKey}
                      onChange={v => onAwsSecretAccessKeyChange?.(v)}
                      knownVariables={knownVariables}
                      variablesMap={variablesMap}
                      placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      className="mb-1 block text-[12px] font-medium"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      AWS Region <span className="text-red-400">*</span>
                    </label>
                    <VariableInput
                      value={awsRegion}
                      onChange={v => onAwsRegionChange?.(v)}
                      knownVariables={knownVariables}
                      variablesMap={variablesMap}
                      placeholder="us-east-1"
                    />
                  </div>
                  <div>
                    <label
                      className="mb-1 block text-[12px] font-medium"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Service Name <span className="text-red-400">*</span>
                    </label>
                    <VariableInput
                      value={awsService}
                      onChange={v => onAwsServiceChange?.(v)}
                      knownVariables={knownVariables}
                      variablesMap={variablesMap}
                      placeholder="s3, execute-api, etc."
                    />
                  </div>
                </div>

                <div>
                  <label
                    className="mb-1 block text-[12px] font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Session Token (optional)
                  </label>
                  <VariableInput
                    value={awsSessionToken}
                    onChange={v => onAwsSessionTokenChange?.(v)}
                    knownVariables={knownVariables}
                    variablesMap={variablesMap}
                    placeholder="AQoDYXdzEJr1... (for temporary credentials)"
                  />
                </div>
                <p className="text-[11px] text-(--text-muted)">
                  Reqit creates canonical requests, computes HMAC-SHA256 signatures, and includes
                  Authorization and X-Amz-Date headers automatically.
                </p>
              </div>
            )}
          </div>
        )}

        {/* BODY TAB */}
        {activeSubTab === 'body' && (
          <div className="flex h-full flex-col space-y-3">
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
                  className="transition-fast inline-flex items-center rounded-md border p-0.5 select-none"
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
                        className="transition-fast relative flex h-6.5 cursor-pointer items-center gap-1.5 overflow-hidden rounded-sm px-2.5 text-[12px] font-medium"
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
                          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                        />
                        <Icon
                          className="transition-fast pointer-events-none relative z-0 h-4 w-4 shrink-0"
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
                  className="transition-fast app-focus-ring inline-flex h-7 items-center gap-1.5 rounded-sm border px-3 text-[12px] font-medium hover:bg-(--bg-hover)"
                  style={{
                    borderColor: 'var(--border-strong)',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                  }}
                  title="Format and prettify JSON"
                >
                  <Sparkles className="h-4 w-4 text-(--accent)" strokeWidth={1.75} />
                  <span>Beautify</span>
                </button>
              )}
            </div>

            {/* JSON Error Warning */}
            {jsonFormatError && (
              <div
                className="flex items-center gap-2 rounded-sm border px-2.5 py-1.5 text-[11px]"
                style={{
                  backgroundColor: 'var(--danger-subtle)',
                  borderColor: 'var(--danger)',
                  color: 'var(--danger)',
                }}
              >
                <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span>Invalid JSON: {jsonFormatError}</span>
              </div>
            )}

            {/* None Empty State */}
            {bodyType === 'none' && (
              <div
                className="flex h-32 items-center justify-center rounded-sm border border-dashed text-[12px]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                This request does not have a body.
              </div>
            )}

            {/* JSON Editor */}
            {bodyType === 'json' && (
              <div className="min-h-40 flex-1">
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
              <div className="min-h-40 flex-1">
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
              <div className="min-h-40 flex-1">
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
              <div className="min-h-40 flex-1">
                <MultipartTable
                  rows={bodyMultipartRows}
                  onChange={onBodyMultipartRowsChange}
                  knownVariables={knownVariables}
                />
              </div>
            )}
          </div>
        )}

        {/* SCRIPTS TAB (Phase 16) */}
        {activeSubTab === 'scripts' && (
          <div className="flex flex-col gap-3">
            {/* Workspace trust notice if untrusted */}
            {!isWorkspaceTrusted && (
              <div
                className="flex items-center justify-between rounded border px-3 py-2 text-[12px]"
                style={{
                  backgroundColor: 'rgba(234, 179, 8, 0.1)',
                  borderColor: 'rgba(234, 179, 8, 0.3)',
                  color: 'var(--text-primary)',
                }}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                  <span>
                    Workspace is untrusted. Scripts are disabled until you trust this collection.
                  </span>
                </div>
                {onTrustWorkspace && (
                  <button
                    type="button"
                    onClick={onTrustWorkspace}
                    className="rounded-xs px-2 py-1 text-[11px] font-medium"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-fg)',
                    }}
                  >
                    Trust Workspace
                  </button>
                )}
              </div>
            )}

            {/* Script Sub-tab switch (Pre vs Post) */}
            <div
              className="flex items-center justify-between border-b pb-2 select-none"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setScriptSubTab('pre')}
                  className={`rounded px-2.5 py-1 text-[12px] font-medium transition-colors ${
                    scriptSubTab === 'pre'
                      ? 'bg-(--accent) text-(--accent-fg)'
                      : 'text-(--text-secondary) hover:text-(--text-primary)'
                  }`}
                >
                  Pre-request {preScript.trim() ? '•' : ''}
                </button>
                <button
                  type="button"
                  onClick={() => setScriptSubTab('post')}
                  className={`rounded px-2.5 py-1 text-[12px] font-medium transition-colors ${
                    scriptSubTab === 'post'
                      ? 'bg-(--accent) text-(--accent-fg)'
                      : 'text-(--text-secondary) hover:text-(--text-primary)'
                  }`}
                >
                  Post-response {postScript.trim() ? '•' : ''}
                </button>
              </div>

              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {scriptSubTab === 'pre'
                  ? 'Runs in a sandbox before the request is sent'
                  : 'Runs in a sandbox after the response is received'}
              </div>
            </div>

            {/* Snippet Helper Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span style={{ color: 'var(--text-muted)' }}>Quick Snippets:</span>
              {scriptSubTab === 'pre' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const snippet = `req.headers.set('X-Custom-Header', 'custom-value');\n`;
                      onPreScriptChange?.(preScript ? preScript + '\n' + snippet : snippet);
                    }}
                    className="rounded border px-2 py-0.5 hover:bg-(--bg-hover)"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  >
                    + Set Header
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const snippet = `reqit.setVar('myVariable', 'sampleValue');\n`;
                      onPreScriptChange?.(preScript ? preScript + '\n' + snippet : snippet);
                    }}
                    className="rounded border px-2 py-0.5 hover:bg-(--bg-hover)"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  >
                    + Set Variable
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const snippet = `const val = reqit.getVar('myVariable');\nconsole.log('Value is:', val);\n`;
                      onPreScriptChange?.(preScript ? preScript + '\n' + snippet : snippet);
                    }}
                    className="rounded border px-2 py-0.5 hover:bg-(--bg-hover)"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  >
                    + Get Variable
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const snippet = `console.log('Preparing to send to:', req.url);\n`;
                      onPreScriptChange?.(preScript ? preScript + '\n' + snippet : snippet);
                    }}
                    className="rounded border px-2 py-0.5 hover:bg-(--bg-hover)"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  >
                    + Log
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const snippet = `const data = res.json();\nreqit.setVar('authToken', data.token);\nreqit.log('Saved token:', data.token);\n`;
                      onPostScriptChange?.(postScript ? postScript + '\n' + snippet : snippet);
                    }}
                    className="rounded border px-2 py-0.5 hover:bg-(--bg-hover)"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  >
                    + Save JSON Token
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const snippet = `if (res.status !== 200) {\n  reqit.error('Expected status 200 but received ' + res.status);\n} else {\n  reqit.log('Request succeeded with 200 OK');\n}\n`;
                      onPostScriptChange?.(postScript ? postScript + '\n' + snippet : snippet);
                    }}
                    className="rounded border px-2 py-0.5 hover:bg-(--bg-hover)"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  >
                    + Assert Status
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const snippet = `const contentType = res.headers.get('content-type');\nreqit.log('Content-Type header:', contentType);\n`;
                      onPostScriptChange?.(postScript ? postScript + '\n' + snippet : snippet);
                    }}
                    className="rounded border px-2 py-0.5 hover:bg-(--bg-hover)"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  >
                    + Check Header
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const snippet = `console.log('Response body:', res.body);\n`;
                      onPostScriptChange?.(postScript ? postScript + '\n' + snippet : snippet);
                    }}
                    className="rounded border px-2 py-0.5 hover:bg-(--bg-hover)"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  >
                    + Log Body
                  </button>
                </>
              )}
            </div>

            {/* Code Editor */}
            <div
              className="min-h-52 flex-1 overflow-hidden rounded border"
              style={{ borderColor: 'var(--border)' }}
            >
              <CodeEditor
                key={scriptSubTab}
                value={scriptSubTab === 'pre' ? preScript : postScript}
                onChange={val => {
                  if (scriptSubTab === 'pre') {
                    onPreScriptChange?.(val);
                  } else {
                    onPostScriptChange?.(val);
                  }
                }}
                mode="javascript"
                background="base"
                minHeight="220px"
                maxHeight="380px"
              />
            </div>

            {/* API Reference hints */}
            <div
              className="rounded p-2.5 font-mono text-[11px] leading-relaxed"
              style={{
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
              }}
            >
              {scriptSubTab === 'pre' ? (
                <div>
                  <span className="font-semibold text-(--text-primary)">
                    Pre-request Script API:
                  </span>{' '}
                  <code className="text-sky-400">req.url</code>,{' '}
                  <code className="text-sky-400">req.method</code>,{' '}
                  <code className="text-sky-400">req.headers.get/set/has/remove()</code>,{' '}
                  <code className="text-sky-400">req.body</code>,{' '}
                  <code className="text-amber-400">reqit.setVar(name, val)</code>,{' '}
                  <code className="text-amber-400">reqit.getVar(name)</code>,{' '}
                  <code className="text-emerald-400">console.log(...)</code> /{' '}
                  <code className="text-emerald-400">reqit.log(...)</code>
                </div>
              ) : (
                <div>
                  <span className="font-semibold text-(--text-primary)">
                    Post-response Script API:
                  </span>{' '}
                  <code className="text-sky-400">res.status</code>,{' '}
                  <code className="text-sky-400">res.headers.get/has()</code>,{' '}
                  <code className="text-sky-400">res.body</code>,{' '}
                  <code className="text-sky-400">res.json()</code>,{' '}
                  <code className="text-sky-400">res.timeMs</code>,{' '}
                  <code className="text-amber-400">reqit.setVar(name, val)</code>,{' '}
                  <code className="text-amber-400">reqit.getVar(name)</code>,{' '}
                  <code className="text-emerald-400">console.log(...)</code> /{' '}
                  <code className="text-emerald-400">reqit.log(...)</code>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tests & Assertions Tab (Phase 17) */}
        {activeSubTab === 'tests' && (
          <div className="flex flex-col space-y-3">
            {/* Workspace trust notice */}
            {!isWorkspaceTrusted && (
              <div
                className="flex items-center justify-between rounded border px-3 py-2 text-[12px]"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  color: 'var(--text-primary)',
                }}
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>
                    Workspace is untrusted. Test assertions are disabled until you trust this
                    collection.
                  </span>
                </div>
                {onTrustWorkspace && (
                  <button
                    type="button"
                    onClick={onTrustWorkspace}
                    className="transition-fast shrink-0 rounded bg-rose-500/20 px-2 py-0.5 text-[11px] font-medium text-rose-300 hover:bg-rose-500/30"
                  >
                    Trust Collection
                  </button>
                )}
              </div>
            )}

            {/* Quick-Add Helpers Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="mr-1 font-medium text-(--text-secondary)">Quick Add:</span>
                <button
                  type="button"
                  onClick={() => handleAddTest('Status is 200', 'res.status === 200')}
                  className="transition-fast rounded border px-2 py-0.5 hover:bg-(--bg-hover)"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  + Status is 200
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleAddTest('Body contains string', 'res.body.includes("success")')
                  }
                  className="transition-fast rounded border px-2 py-0.5 hover:bg-(--bg-hover)"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  + Body contains
                </button>
                <button
                  type="button"
                  onClick={() => handleAddTest('JSON path equals', 'res.json().status === "ok"')}
                  className="transition-fast rounded border px-2 py-0.5 hover:bg-(--bg-hover)"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  + JSON path equals
                </button>
                <button
                  type="button"
                  onClick={() => handleAddTest('Response time under 500ms', 'res.timeMs < 500')}
                  className="transition-fast rounded border px-2 py-0.5 hover:bg-(--bg-hover)"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  + Response time under N ms
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleAddTest('Header Content-Type exists', 'res.headers.has("content-type")')
                  }
                  className="transition-fast rounded border px-2 py-0.5 hover:bg-(--bg-hover)"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  + Header exists
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleAddTest('', '')}
                className="transition-fast flex items-center gap-1 rounded bg-(--accent) px-2.5 py-1 text-[11px] font-medium text-white hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Assertion
              </button>
            </div>

            {/* Test Assertions List */}
            {!tests || tests.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center rounded border border-dashed px-4 py-8 text-center"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                <FlaskConical className="mb-2 h-8 w-8 text-(--accent) opacity-50" />
                <p className="text-[13px] font-medium text-(--text-primary)">
                  No test assertions added
                </p>
                <p className="mt-1 max-w-sm text-[12px] text-(--text-secondary)">
                  Add assertions to automatically verify response status, headers, body content, and
                  latency after every run.
                </p>
                <button
                  type="button"
                  onClick={() => handleAddTest('Status is 200', 'res.status === 200')}
                  className="mt-3 rounded border px-3 py-1 text-[11px] font-medium text-(--accent) hover:bg-(--bg-hover)"
                  style={{ borderColor: 'var(--border)' }}
                >
                  Add "Status is 200" Test
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {tests.map((test, index) => (
                  <div
                    key={test.id}
                    className="transition-fast flex flex-col gap-2 rounded border p-2.5"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border)',
                      opacity: test.enabled === false ? 0.6 : 1,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={test.enabled !== false}
                        onChange={e => handleUpdateTest(test.id, { enabled: e.target.checked })}
                        className="h-3.5 w-3.5 cursor-pointer rounded accent-(--accent)"
                        title="Enable / disable test assertion"
                      />
                      <input
                        type="text"
                        value={test.name}
                        placeholder={`Assertion #${index + 1} Name (e.g. Status is 200)`}
                        onChange={e => handleUpdateTest(test.id, { name: e.target.value })}
                        className="h-7 flex-1 rounded border px-2 text-[12px] font-medium outline-none"
                        style={{
                          backgroundColor: 'var(--bg-input)',
                          borderColor: 'var(--border)',
                          color: 'var(--text-primary)',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteTest(test.id)}
                        className="transition-fast flex h-7 w-7 items-center justify-center rounded text-(--text-muted) hover:bg-rose-500/20 hover:text-rose-400"
                        title="Delete assertion"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="w-full">
                        <input
                          type="text"
                          value={test.assert}
                          placeholder="Assertion expression, e.g. res.status === 200 or expect(res.status).toBe(200)"
                          onChange={e => handleUpdateTest(test.id, { assert: e.target.value })}
                          className="h-7 w-full rounded border px-2 font-mono text-[12px] outline-none"
                          style={{
                            backgroundColor: 'var(--bg-input)',
                            borderColor: 'var(--border)',
                            color: 'var(--accent)',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Assertion Reference hints */}
            <div
              className="rounded p-2.5 font-mono text-[11px] leading-relaxed"
              style={{
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
              }}
            >
              <div>
                <span className="font-semibold text-(--text-primary)">Test Assertion API:</span>{' '}
                <code className="text-sky-400">res.status</code>,{' '}
                <code className="text-sky-400">res.statusText</code>,{' '}
                <code className="text-sky-400">res.body</code>,{' '}
                <code className="text-sky-400">res.json()</code>,{' '}
                <code className="text-sky-400">res.timeMs</code>,{' '}
                <code className="text-sky-400">res.headers.get('name')</code>,{' '}
                <code className="text-sky-400">res.headers.has('name')</code>,{' '}
                <code className="text-amber-400">assert(condition, message)</code>,{' '}
                <code className="text-amber-400">assert.equal(a, b)</code>,{' '}
                <code className="text-emerald-400">expect(val).toBe(expected)</code>,{' '}
                <code className="text-emerald-400">expect(val).toContain(item)</code>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
