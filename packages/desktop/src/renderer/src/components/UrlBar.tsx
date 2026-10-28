import React from 'react';
import type { HttpMethod } from '@reqit/core';
import { Button } from './ui/Button';
import { VariableInput } from './ui/VariableInput';
import { strings } from '../lib/strings';

export interface UrlBarProps {
  method: HttpMethod;
  onMethodChange: (m: HttpMethod) => void;
  url: string;
  onUrlChange: (u: string) => void;
  onSend: () => void;
  onCancel: () => void;
  loading: boolean;
  knownVariables?: string[];
}

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export function UrlBar({
  method,
  onMethodChange,
  url,
  onUrlChange,
  onSend,
  onCancel,
  loading,
  knownVariables,
}: UrlBarProps): React.JSX.Element {
  return (
    <div
      className="p-3 border-b flex items-center gap-2 select-none shrink-0"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Method Selector */}
      <div
        className="relative flex items-center h-[32px] rounded-[4px] border shrink-0"
        style={{
          borderColor: 'var(--border-strong)',
          backgroundColor: 'var(--bg-input)',
        }}
      >
        <select
          id="method-select"
          value={method}
          onChange={e => onMethodChange(e.target.value as HttpMethod)}
          className="h-full pl-3 pr-7 text-[12px] font-mono font-bold uppercase bg-transparent outline-none cursor-pointer app-focus-ring appearance-none"
          style={{
            color: `var(--method-${method.toLowerCase()})`,
          }}
          aria-label="HTTP method"
        >
          {HTTP_METHODS.map(m => (
            <option
              key={m}
              value={m}
              style={{
                backgroundColor: 'var(--bg-elevated)',
                color: `var(--method-${m.toLowerCase()})`,
              }}
            >
              {m}
            </option>
          ))}
        </select>
        <div
          className="absolute right-2 pointer-events-none text-[9px]"
          style={{ color: 'var(--text-muted)' }}
        >
          ▼
        </div>
      </div>

      {/* URL Input with Variable Highlighting & {{ Autocomplete */}
      <div className="flex-1 min-w-0">
        <VariableInput
          id="url-input"
          inputSize="large"
          value={url}
          onChange={onUrlChange}
          knownVariables={knownVariables}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              if (!loading) onSend();
            }
          }}
          placeholder={strings.urlBar.urlPlaceholder}
          aria-label="Request URL"
        />
      </div>

      {/* Send or Cancel Button */}
      {loading ? (
        <Button
          id="cancel-test-btn"
          variant="danger"
          size="large"
          onClick={onCancel}
          className="w-[96px] shrink-0 font-medium"
        >
          {strings.urlBar.cancel}
        </Button>
      ) : (
        <Button
          id="send-test-btn"
          variant="primary"
          size="large"
          onClick={onSend}
          className="w-[96px] shrink-0 font-medium"
        >
          {strings.urlBar.send}
        </Button>
      )}
    </div>
  );
}
