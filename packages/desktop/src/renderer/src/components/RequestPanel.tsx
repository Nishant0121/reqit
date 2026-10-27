import React, { useState } from 'react';
import { Tabs } from './ui/Tabs';
import { KeyValueTable, type KeyValueRow } from './ui/KeyValueTable';
import { Input } from './ui/Input';
import { strings } from '../lib/strings';

export type AuthType = 'none' | 'bearer' | 'basic' | 'apiKey';
export type BodyType = 'none' | 'json' | 'raw';

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
  bodyType: BodyType;
  onBodyTypeChange: (type: BodyType) => void;
  bodyContent: string;
  onBodyContentChange: (content: string) => void;
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
  bodyType,
  onBodyTypeChange,
  bodyContent,
  onBodyContentChange,
}: RequestPanelProps): React.JSX.Element {
  const [activeSubTab, setActiveSubTab] = useState<
    'params' | 'headers' | 'auth' | 'body' | 'scripts'
  >('params');

  const activeParamsCount = params.filter(p => p.enabled && p.key.trim() !== '').length;
  const activeHeadersCount = headers.filter(h => h.enabled && h.key.trim() !== '').length;

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
        {activeSubTab === 'params' && (
          <KeyValueTable
            rows={params}
            onChange={onParamsChange}
            keyPlaceholder={strings.requestPanel.keyPlaceholder}
            valuePlaceholder={strings.requestPanel.valuePlaceholder}
            descriptionPlaceholder={strings.requestPanel.descriptionPlaceholder}
            showDescription
          />
        )}

        {activeSubTab === 'headers' && (
          <KeyValueTable
            rows={headers}
            onChange={onHeadersChange}
            keyPlaceholder={strings.requestPanel.keyPlaceholder}
            valuePlaceholder={strings.requestPanel.valuePlaceholder}
            descriptionPlaceholder={strings.requestPanel.descriptionPlaceholder}
            showDescription
          />
        )}

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
                className="h-[28px] px-2 text-[13px] bg-transparent border rounded-[4px] app-focus-ring outline-none cursor-pointer w-full"
                style={{
                  borderColor: 'var(--border-strong)',
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-base)',
                }}
              >
                <option value="none">{strings.requestPanel.noAuth}</option>
                <option value="bearer">{strings.requestPanel.bearerToken}</option>
                <option value="basic">{strings.requestPanel.basicAuth}</option>
                <option value="apiKey">{strings.requestPanel.apiKey}</option>
              </select>
            </div>

            {authType === 'bearer' && (
              <div>
                <label
                  className="block text-[12px] font-medium mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {strings.requestPanel.bearerToken}
                </label>
                <Input
                  type="password"
                  value={bearerToken}
                  onChange={e => onBearerTokenChange(e.target.value)}
                  placeholder={strings.requestPanel.tokenPlaceholder}
                />
              </div>
            )}

            {authType === 'basic' && (
              <div className="space-y-3">
                <div>
                  <label
                    className="block text-[12px] font-medium mb-1"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {strings.requestPanel.usernamePlaceholder}
                  </label>
                  <Input
                    type="text"
                    value={basicUser}
                    onChange={e => onBasicUserChange(e.target.value)}
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
                  <Input
                    type="password"
                    value={basicPass}
                    onChange={e => onBasicPassChange(e.target.value)}
                    placeholder={strings.requestPanel.passwordPlaceholder}
                  />
                </div>
              </div>
            )}

            {authType === 'apiKey' && (
              <div className="space-y-3">
                <div>
                  <label
                    className="block text-[12px] font-medium mb-1"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {strings.requestPanel.keyPlaceholder}
                  </label>
                  <Input
                    type="text"
                    value={apiKeyName}
                    onChange={e => onApiKeyNameChange(e.target.value)}
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
                  <Input
                    type="password"
                    value={apiKeyValue}
                    onChange={e => onApiKeyValueChange(e.target.value)}
                    placeholder={strings.requestPanel.valuePlaceholder}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'body' && (
          <div className="flex flex-col h-full space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                Format:
              </label>
              <div className="flex items-center gap-2 text-[12px]">
                {(['none', 'json', 'raw'] as BodyType[]).map(t => (
                  <label key={t} className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="body-type"
                      value={t}
                      checked={bodyType === t}
                      onChange={() => onBodyTypeChange(t)}
                      className="app-focus-ring"
                    />
                    <span style={{ color: 'var(--text-primary)' }}>
                      {t === 'none' ? 'None' : t === 'json' ? 'JSON' : 'Raw'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {bodyType !== 'none' && (
              <textarea
                value={bodyContent}
                onChange={e => onBodyContentChange(e.target.value)}
                placeholder={strings.requestPanel.bodyPlaceholder}
                className="w-full h-48 p-3 font-mono text-[12px] rounded-[4px] border outline-none app-focus-ring resize-y"
                style={{
                  backgroundColor: 'var(--bg-base)',
                  borderColor: 'var(--border-strong)',
                  color: 'var(--text-primary)',
                }}
              />
            )}
          </div>
        )}

        {activeSubTab === 'scripts' && (
          <div className="text-[12px] p-4 text-center" style={{ color: 'var(--text-muted)' }}>
            Pre-request and post-response scripts can be configured here.
          </div>
        )}
      </div>
    </div>
  );
}
