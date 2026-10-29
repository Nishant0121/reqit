import React, { useState, useEffect, useRef, useMemo } from 'react';
import { parseCurl, type CurlParseResult } from '@reqit/core/curl';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { MethodBadge } from './ui/Badge';
import { useRequestStore } from '../stores/requestStore';
import { useAppStore } from '../stores/appStore';
import { AlertTriangle, CheckCircle2, Terminal, ShieldAlert, FileText, Lock } from 'lucide-react';

export interface ImportCurlModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportCurlModal({
  isOpen,
  onClose,
}: ImportCurlModalProps): React.JSX.Element | null {
  const [curlText, setCurlText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { activeRequestId, importCurlToDraft, importCurlAsNewRequest } = useRequestStore();
  const addToast = useAppStore(s => s.addToast);

  useEffect(() => {
    if (isOpen) {
      setCurlText('');
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Live parse result
  const parseState = useMemo<{
    result: CurlParseResult | null;
    error: string | null;
  }>(() => {
    const trimmed = curlText.trim();
    if (!trimmed) {
      return { result: null, error: null };
    }
    try {
      const res = parseCurl(trimmed);
      return { result: res, error: null };
    } catch (err: unknown) {
      return {
        result: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }, [curlText]);

  const handleImportCurrent = () => {
    if (!parseState.result || !activeRequestId) return;
    try {
      const { warnings } = importCurlToDraft(activeRequestId, curlText);
      addToast({
        type: 'success',
        message: 'cURL imported into current request tab',
      });
      if (warnings.length > 0) {
        addToast({
          type: 'warning',
          message: `Note: ${warnings.join('; ')}`,
        });
      }
      onClose();
    } catch (err: unknown) {
      addToast({
        type: 'error',
        message: `Failed to import cURL: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  const handleImportNew = () => {
    if (!parseState.result) return;
    try {
      const { warnings } = importCurlAsNewRequest(curlText);
      addToast({
        type: 'success',
        message: 'cURL imported as new request',
      });
      if (warnings.length > 0) {
        addToast({
          type: 'warning',
          message: `Note: ${warnings.join('; ')}`,
        });
      }
      onClose();
    } catch (err: unknown) {
      addToast({
        type: 'error',
        message: `Failed to import cURL: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  const parsedReq = parseState.result?.request;
  const warnings = parseState.result?.warnings || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import cURL"
      size="large"
      customFooter={
        <div className="flex items-center justify-between w-full">
          <div className="text-[12px] text-[var(--text-muted)] flex items-center gap-1.5">
            <Terminal className="w-4 h-4 text-[var(--text-muted)]" />
            <span>Bash, PowerShell, and cmd.exe formats supported</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="default" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="default"
              disabled={!parseState.result || !activeRequestId}
              onClick={handleImportCurrent}
              title={
                !activeRequestId
                  ? 'No active tab open'
                  : 'Overwrite current tab with parsed request'
              }
            >
              Import into Current Tab
            </Button>
            <Button
              variant="primary"
              size="default"
              disabled={!parseState.result}
              onClick={handleImportNew}
              title="Create a new request tab from this cURL"
            >
              Open as New Request
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-[12px] font-medium mb-1.5 text-[var(--text-secondary)]">
            Paste cURL Command
          </label>
          <textarea
            ref={textareaRef}
            value={curlText}
            onChange={e => setCurlText(e.target.value)}
            placeholder={`curl -X POST 'https://api.example.com/v1/users' \\\n  -H 'Authorization: Bearer token123' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"name": "Alice"}'`}
            rows={7}
            className="w-full font-mono text-[12px] p-3 rounded-[var(--radius-sm)] border outline-none app-focus-ring resize-y leading-relaxed"
            style={{
              backgroundColor: 'var(--bg-input)',
              borderColor: parseState.error ? 'var(--danger)' : 'var(--border-strong)',
              color: 'var(--text-primary)',
            }}
            spellCheck={false}
          />
        </div>

        {/* Live Parse Status / Preview */}
        {!curlText.trim() && (
          <div
            className="p-3 rounded-[var(--radius-sm)] border text-[12px] flex items-center gap-2"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border)',
              color: 'var(--text-secondary)',
            }}
          >
            <Terminal className="w-4 h-4 text-[var(--accent)] shrink-0" />
            <span>
              Tip: You can also paste directly into the top address bar to import immediately.
            </span>
          </div>
        )}

        {parseState.error && (
          <div
            className="p-3 rounded-[var(--radius-sm)] border text-[12px] flex items-start gap-2.5"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderColor: 'var(--danger)',
              color: 'var(--danger)',
            }}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <span className="font-semibold">Invalid cURL command: </span>
              <span>{parseState.error}</span>
            </div>
          </div>
        )}

        {parsedReq && (
          <div
            className="rounded-[var(--radius-sm)] border p-3.5 space-y-3"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border)',
            }}
          >
            <div
              className="flex items-center justify-between pb-2 border-b"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-[var(--success)] shrink-0" />
                <span className="text-[12px] font-semibold text-[var(--text-primary)]">
                  Parsed Request Preview
                </span>
              </div>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">
                {parsedReq.name}
              </span>
            </div>

            {/* Target URL and Method */}
            <div className="flex items-center gap-2 min-w-0">
              <MethodBadge method={parsedReq.method} />
              <div
                className="font-mono text-[12px] px-2 py-1 rounded bg-[var(--bg-input)] border border-[var(--border)] truncate flex-1 select-all"
                style={{ color: 'var(--text-primary)' }}
                title={parsedReq.url}
              >
                {parsedReq.url}
              </div>
            </div>

            {/* Request Components Pills */}
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              {/* Headers count */}
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded border"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-strong)',
                  color: 'var(--text-secondary)',
                }}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>
                  {parsedReq.headers?.length ? `${parsedReq.headers.length} headers` : 'No headers'}
                </span>
              </div>

              {/* Auth info */}
              {parsedReq.auth && (
                <div
                  className="flex items-center gap-1 px-2 py-0.5 rounded border"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-strong)',
                    color: 'var(--accent)',
                  }}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Auth: {parsedReq.auth.type}</span>
                </div>
              )}

              {/* Body info */}
              {parsedReq.body && parsedReq.body.type !== 'none' && (
                <div
                  className="flex items-center gap-1 px-2 py-0.5 rounded border"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-strong)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <span className="font-semibold uppercase text-[10px] px-1 py-0.2 rounded bg-[var(--border)]">
                    {parsedReq.body.type}
                  </span>
                  <span>
                    {parsedReq.body.type === 'multipart' || parsedReq.body.type === 'form'
                      ? `${parsedReq.body.form?.length || 0} fields`
                      : `${parsedReq.body.content?.length || 0} chars`}
                  </span>
                </div>
              )}

              {/* Insecure / Redirects */}
              {parsedReq.validateSsl === false && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-500 border border-amber-500/30">
                  insecure (-k)
                </span>
              )}
              {parsedReq.followRedirects === true && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-500 border border-blue-500/30">
                  follow redirects (-L)
                </span>
              )}
            </div>

            {/* Body snippet */}
            {parsedReq.body?.content && (
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-[var(--text-muted)]">
                  Body content:
                </span>
                <pre
                  className="p-2 rounded font-mono text-[11px] max-h-24 overflow-y-auto border whitespace-pre-wrap break-all"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {parsedReq.body.content.length > 500
                    ? `${parsedReq.body.content.slice(0, 500)}...`
                    : parsedReq.body.content}
                </pre>
              </div>
            )}

            {/* Warnings list */}
            {warnings.length > 0 && (
              <div
                className="p-2.5 rounded-[var(--radius-sm)] border text-[11px] space-y-1"
                style={{
                  backgroundColor: 'rgba(234, 179, 8, 0.1)',
                  borderColor: 'rgba(234, 179, 8, 0.4)',
                  color: 'var(--text-primary)',
                }}
              >
                <div className="flex items-center gap-1.5 font-semibold text-amber-500">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>Unsupported cURL options detected (ignored):</span>
                </div>
                <ul className="list-disc pl-5 space-y-0.5 text-[var(--text-secondary)]">
                  {warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
