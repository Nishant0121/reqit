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

      {/* URL Input with Variable Highlighting, {{ Autocomplete & cURL Paste detection */}
      <div className="flex-1 min-w-0">
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
      <div className="relative flex items-center shrink-0" ref={curlMenuRef}>
        <div
          className="inline-flex rounded-[4px] border overflow-hidden h-[32px]"
          style={{
            borderColor: 'var(--border-strong)',
            backgroundColor: 'var(--bg-elevated)',
          }}
        >
          <button
            type="button"
            id="copy-curl-btn"
            onClick={() => handleCopy()}
            className="h-full px-2.5 flex items-center gap-1.5 text-[12px] font-medium hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-fast select-none app-focus-ring"
            title={`Copy as cURL (${targetLabel}, ${resolveVariables ? 'Resolved' : 'Raw'})`}
            aria-label="Copy request as cURL command"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-[var(--success)]" />
            ) : (
              <Terminal className="w-3.5 h-3.5 text-[var(--accent)]" />
            )}
            <span>cURL</span>
          </button>
          <button
            type="button"
            id="copy-curl-menu-btn"
            onClick={() => setCurlMenuOpen(!curlMenuOpen)}
            className="h-full px-1.5 flex items-center justify-center hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border-l transition-fast app-focus-ring"
            style={{ borderColor: 'var(--border)' }}
            title="cURL options"
            aria-label="cURL options"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        {/* Dropdown Menu */}
        {curlMenuOpen && (
          <div
            className="absolute right-0 top-full mt-1.5 w-60 rounded-[var(--radius-md)] border shadow-xl py-1.5 z-50 text-[12px]"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-strong)',
            }}
          >
            {/* Header: Shell Format */}
            <div className="px-3 py-1 text-[11px] font-semibold tracking-wider uppercase text-[var(--text-muted)]">
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
                className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[var(--bg-hover)] text-left transition-fast text-[var(--text-primary)]"
              >
                <span>{opt.label}</span>
                {curlTarget === opt.id && <Check className="w-3.5 h-3.5 text-[var(--accent)]" />}
              </button>
            ))}

            <div className="my-1 border-t" style={{ borderColor: 'var(--border)' }} />

            {/* Header: Variable Resolution */}
            <div className="px-3 py-1 text-[11px] font-semibold tracking-wider uppercase text-[var(--text-muted)]">
              Variables
            </div>
            <button
              type="button"
              onClick={() => {
                setResolveVariables(true);
                handleCopy(curlTarget, true);
                setCurlMenuOpen(false);
              }}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[var(--bg-hover)] text-left transition-fast text-[var(--text-primary)]"
            >
              <div className="flex flex-col">
                <span>Resolved</span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  Substitute env vars & secrets
                </span>
              </div>
              {resolveVariables && <Check className="w-3.5 h-3.5 text-[var(--accent)]" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setResolveVariables(false);
                handleCopy(curlTarget, false);
                setCurlMenuOpen(false);
              }}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[var(--bg-hover)] text-left transition-fast text-[var(--text-primary)]"
            >
              <div className="flex flex-col">
                <span>Unresolved (Raw)</span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  Keep &#123;&#123;variable&#125;&#125; syntax
                </span>
              </div>
              {!resolveVariables && <Check className="w-3.5 h-3.5 text-[var(--accent)]" />}
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
                  className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--bg-hover)] text-left transition-fast text-[var(--text-primary)]"
                >
                  <Download className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span className="flex-1 font-medium">Import cURL...</span>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">Ctrl+I</span>
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
