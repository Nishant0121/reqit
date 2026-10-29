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
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-1.5 text-[12px] text-(--text-muted)">
            <Terminal className="h-4 w-4 text-(--text-muted)" />
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
          <label className="mb-1.5 block text-[12px] font-medium text-(--text-secondary)">
            Paste cURL Command
          </label>
          <textarea
            ref={textareaRef}
            value={curlText}
            onChange={e => setCurlText(e.target.value)}
            placeholder={`curl -X POST 'https://api.example.com/v1/users' \\\n  -H 'Authorization: Bearer token123' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"name": "Alice"}'`}
            rows={7}
            className="app-focus-ring w-full resize-y rounded-sm border p-3 font-mono text-[12px] leading-relaxed outline-none"
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
            className="flex items-center gap-2 rounded-sm border p-3 text-[12px]"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border)',
              color: 'var(--text-secondary)',
            }}
          >
            <Terminal className="h-4 w-4 shrink-0 text-(--accent)" />
            <span>
              Tip: You can also paste directly into the top address bar to import immediately.
            </span>
          </div>
        )}

        {parseState.error && (
          <div
            className="flex items-start gap-2.5 rounded-sm border p-3 text-[12px]"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderColor: 'var(--danger)',
              color: 'var(--danger)',
            }}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="font-semibold">Invalid cURL command: </span>
              <span>{parseState.error}</span>
            </div>
          </div>
        )}

        {parsedReq && (
          <div
            className="space-y-3 rounded-sm border p-3.5"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border)',
            }}
          >
            <div
              className="flex items-center justify-between border-b pb-2"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex min-w-0 items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-(--success)" />
                <span className="text-[12px] font-semibold text-(--text-primary)">
                  Parsed Request Preview
                </span>
              </div>
              <span className="font-mono text-[11px] text-(--text-muted)">{parsedReq.name}</span>
            </div>

            {/* Target URL and Method */}
            <div className="flex min-w-0 items-center gap-2">
              <MethodBadge method={parsedReq.method} />
              <div
                className="flex-1 truncate rounded border border-(--border) bg-(--bg-input) px-2 py-1 font-mono text-[12px] select-all"
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
                className="flex items-center gap-1 rounded border px-2 py-0.5"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-strong)',
                  color: 'var(--text-secondary)',
                }}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>
                  {parsedReq.headers?.length ? `${parsedReq.headers.length} headers` : 'No headers'}
                </span>
              </div>

              {/* Auth info */}
              {parsedReq.auth && (
                <div
                  className="flex items-center gap-1 rounded border px-2 py-0.5"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-strong)',
                    color: 'var(--accent)',
                  }}
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>Auth: {parsedReq.auth.type}</span>
                </div>
              )}

              {/* Body info */}
              {parsedReq.body && parsedReq.body.type !== 'none' && (
                <div
                  className="flex items-center gap-1 rounded border px-2 py-0.5"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-strong)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <span className="py-0.2 rounded bg-(--border) px-1 text-[10px] font-semibold uppercase">
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
                <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] text-amber-500">
                  insecure (-k)
                </span>
              )}
              {parsedReq.followRedirects === true && (
                <span className="rounded border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 font-mono text-[10px] text-blue-500">
                  follow redirects (-L)
                </span>
              )}
            </div>

            {/* Body snippet */}
            {parsedReq.body?.content && (
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-(--text-muted)">Body content:</span>
                <pre
                  className="max-h-24 overflow-y-auto rounded border p-2 font-mono text-[11px] break-all whitespace-pre-wrap"
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
                className="space-y-1 rounded-sm border p-2.5 text-[11px]"
                style={{
                  backgroundColor: 'rgba(234, 179, 8, 0.1)',
                  borderColor: 'rgba(234, 179, 8, 0.4)',
                  color: 'var(--text-primary)',
                }}
              >
                <div className="flex items-center gap-1.5 font-semibold text-amber-500">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                  <span>Unsupported cURL options detected (ignored):</span>
                </div>
                <ul className="list-disc space-y-0.5 pl-5 text-(--text-secondary)">
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
