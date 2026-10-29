import React, { useState, useRef, useEffect } from 'react';
import type { HttpMethod, ShellTarget } from '@reqit/core';
import { Button } from './ui/Button';
import { VariableInput, type VariableDetail } from './ui/VariableInput';
import { strings } from '../lib/strings';
import { Terminal, ChevronDown, Check, Download } from 'lucide-react';

export interface UrlBarProps {
  method: HttpMethod;
  onMethodChange: (m: HttpMethod) => void;
  url: string;
  onUrlChange: (u: string) => void;
  onSend: () => void;
  onCancel: () => void;
  loading: boolean;
  knownVariables?: string[];
  variablesMap?: Record<string, VariableDetail>;
  onImportCurl?: (curlCommand: string) => void;
  onOpenImportCurl?: () => void;
  onCopyCurl?: (options: { target: ShellTarget; resolveVariables: boolean }) => void;
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
  variablesMap,
  onImportCurl,
  onOpenImportCurl,
  onCopyCurl,
}: UrlBarProps): React.JSX.Element {
  const [curlMenuOpen, setCurlMenuOpen] = useState(false);
  const [curlTarget, setCurlTarget] = useState<ShellTarget>('bash');
  const [resolveVariables, setResolveVariables] = useState(true);
  const [copied, setCopied] = useState(false);
  const curlMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (curlMenuRef.current && !curlMenuRef.current.contains(e.target as Node)) {
        setCurlMenuOpen(false);
      }
    };
    if (curlMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [curlMenuOpen]);

  const handleCopy = (target = curlTarget, resolve = resolveVariables) => {
    if (onCopyCurl) {
      onCopyCurl({ target, resolveVariables: resolve });
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData?.getData('text')?.trim() || '';
    if (text.startsWith('curl ') || text.startsWith('curl\n') || text.startsWith('curl\r\n')) {
      e.preventDefault();
      onImportCurl?.(text);
    }
  };

  const targetLabel =
    curlTarget === 'bash' ? 'Bash' : curlTarget === 'powershell' ? 'PowerShell' : 'cmd.exe';

  return (
    <div
      className="flex shrink-0 items-center gap-2 border-b p-3 select-none"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Method Selector */}
      <div
        className="relative flex h-8 shrink-0 items-center rounded-sm border"
        style={{
          borderColor: 'var(--border-strong)',
          backgroundColor: 'var(--bg-input)',
        }}
      >
        <select
          id="method-select"
          value={method}
          onChange={e => onMethodChange(e.target.value as HttpMethod)}
          className="app-focus-ring h-full cursor-pointer appearance-none bg-transparent pr-7 pl-3 font-mono text-[12px] font-bold uppercase outline-none"
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
          className="pointer-events-none absolute right-2 text-[9px]"
          style={{ color: 'var(--text-muted)' }}
        >
          ▼
        </div>
      </div>

      {/* URL Input with Variable Highlighting, {{ Autocomplete & cURL Paste detection */}
      <div className="min-w-0 flex-1">
        <VariableInput
          id="url-input"
          inputSize="large"
          value={url}
          onChange={onUrlChange}
          onPaste={handlePaste}
          knownVariables={knownVariables}
          variablesMap={variablesMap}
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

      {/* Copy as cURL Split Button and Dropdown Menu */}
      <div className="relative flex shrink-0 items-center" ref={curlMenuRef}>
        <div
          className="inline-flex h-8 overflow-hidden rounded-sm border"
          style={{
            borderColor: 'var(--border-strong)',
            backgroundColor: 'var(--bg-elevated)',
          }}
        >
          <button
            type="button"
            id="copy-curl-btn"
            onClick={() => handleCopy()}
            className="transition-fast app-focus-ring flex h-full items-center gap-1.5 px-2.5 text-[12px] font-medium text-(--text-primary) select-none hover:bg-(--bg-hover)"
            title={`Copy as cURL (${targetLabel}, ${resolveVariables ? 'Resolved' : 'Raw'})`}
            aria-label="Copy request as cURL command"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-(--success)" />
            ) : (
              <Terminal className="h-3.5 w-3.5 text-(--accent)" />
            )}
            <span>cURL</span>
          </button>
          <button
            type="button"
            id="copy-curl-menu-btn"
            onClick={() => setCurlMenuOpen(!curlMenuOpen)}
            className="transition-fast app-focus-ring flex h-full items-center justify-center border-l px-1.5 text-(--text-muted) hover:bg-(--bg-hover) hover:text-(--text-primary)"
            style={{ borderColor: 'var(--border)' }}
            title="cURL options"
            aria-label="cURL options"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        {/* Dropdown Menu */}
        {curlMenuOpen && (
          <div
            className="absolute top-full right-0 z-50 mt-1.5 w-60 rounded-md border py-1.5 text-[12px] shadow-xl"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-strong)',
            }}
          >
            {/* Header: Shell Format */}
            <div className="px-3 py-1 text-[11px] font-semibold tracking-wider text-(--text-muted) uppercase">
              Shell Format
            </div>
            {(
              [
                { id: 'bash', label: 'Bash / macOS / Linux' },
                { id: 'powershell', label: 'Windows PowerShell' },
                { id: 'cmd', label: 'Windows Command Prompt' },
              ] as const
            ).map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setCurlTarget(opt.id);
                  handleCopy(opt.id, resolveVariables);
                  setCurlMenuOpen(false);
                }}
                className="transition-fast flex w-full items-center justify-between px-3 py-1.5 text-left text-(--text-primary) hover:bg-(--bg-hover)"
              >
                <span>{opt.label}</span>
                {curlTarget === opt.id && <Check className="h-3.5 w-3.5 text-(--accent)" />}
              </button>
            ))}

            <div className="my-1 border-t" style={{ borderColor: 'var(--border)' }} />

            {/* Header: Variable Resolution */}
            <div className="px-3 py-1 text-[11px] font-semibold tracking-wider text-(--text-muted) uppercase">
              Variables
            </div>
            <button
              type="button"
              onClick={() => {
                setResolveVariables(true);
                handleCopy(curlTarget, true);
                setCurlMenuOpen(false);
              }}
              className="transition-fast flex w-full items-center justify-between px-3 py-1.5 text-left text-(--text-primary) hover:bg-(--bg-hover)"
            >
              <div className="flex flex-col">
                <span>Resolved</span>
                <span className="text-[10px] text-(--text-muted)">
                  Substitute env vars & secrets
                </span>
              </div>
              {resolveVariables && <Check className="h-3.5 w-3.5 text-(--accent)" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setResolveVariables(false);
                handleCopy(curlTarget, false);
                setCurlMenuOpen(false);
              }}
              className="transition-fast flex w-full items-center justify-between px-3 py-1.5 text-left text-(--text-primary) hover:bg-(--bg-hover)"
            >
              <div className="flex flex-col">
                <span>Unresolved (Raw)</span>
                <span className="text-[10px] text-(--text-muted)">
                  Keep &#123;&#123;variable&#125;&#125; syntax
                </span>
              </div>
              {!resolveVariables && <Check className="h-3.5 w-3.5 text-(--accent)" />}
            </button>

            {onOpenImportCurl && (
              <>
                <div className="my-1 border-t" style={{ borderColor: 'var(--border)' }} />
                <button
                  type="button"
                  id="open-import-curl-menu-item"
                  onClick={() => {
                    setCurlMenuOpen(false);
                    onOpenImportCurl();
                  }}
                  className="transition-fast flex w-full items-center gap-2 px-3 py-1.5 text-left text-(--text-primary) hover:bg-(--bg-hover)"
                >
                  <Download className="h-3.5 w-3.5 text-(--accent)" />
                  <span className="flex-1 font-medium">Import cURL...</span>
                  <span className="font-mono text-[10px] text-(--text-muted)">Ctrl+I</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Send or Cancel Button */}
      {loading ? (
        <Button
          id="cancel-test-btn"
          variant="danger"
          size="large"
          onClick={onCancel}
          className="w-24 shrink-0 font-medium"
        >
          {strings.urlBar.cancel}
        </Button>
      ) : (
        <Button
          id="send-test-btn"
          variant="primary"
          size="large"
          onClick={onSend}
          className="w-24 shrink-0 font-medium"
        >
          {strings.urlBar.send}
        </Button>
      )}
    </div>
  );
}
