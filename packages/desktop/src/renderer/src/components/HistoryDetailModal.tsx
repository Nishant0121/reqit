import React, { useState, useMemo } from 'react';
import { Modal } from './ui/Modal';
import { MethodBadge, StatusBadge } from './ui/Badge';
import { Button } from './ui/Button';
import { useHistoryStore } from '../stores/historyStore';
import { useRequestStore } from '../stores/requestStore';
import { formatBytes, formatDuration } from '../lib/history-utils';
import { Copy, Check, ExternalLink, Trash2, AlertTriangle } from 'lucide-react';

export function HistoryDetailModal(): React.JSX.Element | null {
  const { isDetailOpen, selectedDetail, closeDetail, deleteEntry } = useHistoryStore();
  const createRequestFromHistory = useRequestStore(s => s.createRequestFromHistory);

  const [activeTab, setActiveTab] = useState<'request' | 'response' | 'error'>('response');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const displayParams = useMemo(() => {
    if (selectedDetail?.requestSummary?.params && selectedDetail.requestSummary.params.length > 0) {
      return selectedDetail.requestSummary.params;
    }
    if (!selectedDetail?.url) return [];
    try {
      const parsed = new URL(selectedDetail.url);
      const extracted: Array<{ name: string; value: string; enabled?: boolean }> = [];
      parsed.searchParams.forEach((value, name) => {
        extracted.push({ name, value, enabled: true });
      });
      return extracted;
    } catch {
      return [];
    }
  }, [selectedDetail]);

  const displayHeaders = selectedDetail?.requestSummary?.headers || [];

  const authDesc = useMemo(() => {
    const auth = selectedDetail?.requestSummary?.auth;
    if (!auth || typeof auth !== 'object') return null;
    const a = auth as Record<string, unknown>;
    if (a.type === 'bearer' || a.bearer) {
      return 'Bearer Token (Token: [REDACTED])';
    }
    if (a.type === 'basic' || a.basic) {
      const u =
        (a.basic as Record<string, unknown>)?.username ||
        (a as Record<string, unknown>).username ||
        '';
      return `Basic Auth (${u ? `Username: ${u}, ` : ''}Password: [REDACTED])`;
    }
    if (a.type === 'apikey' || a.apiKey) {
      const k =
        (a.apiKey as Record<string, unknown>)?.key || (a as Record<string, unknown>).key || '';
      return `API Key (${k ? `Key: ${k}, ` : ''}Value: [REDACTED])`;
    }
    if (a.type && a.type !== 'none') {
      return `${String(a.type).toUpperCase()} (Configured)`;
    }
    return null;
  }, [selectedDetail]);

  if (!isDetailOpen || !selectedDetail) return null;

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const handleOpenAsNewRequest = () => {
    createRequestFromHistory(selectedDetail);
    closeDetail();
  };

  const handleDelete = async () => {
    await deleteEntry(selectedDetail.id);
  };

  const timestampStr = new Date(selectedDetail.timestamp).toLocaleString();
  const hasError = Boolean(selectedDetail.isError || selectedDetail.errorMessage);

  return (
    <Modal
      isOpen={isDetailOpen}
      onClose={closeDetail}
      title="Request History Inspection"
      size="xlarge"
    >
      <div className="-mx-6 -my-4 flex h-[70vh] flex-col">
        {/* Top summary banner */}
        <div
          className="flex shrink-0 flex-col gap-2 border-b p-4 select-none"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 overflow-hidden">
              <MethodBadge method={selectedDetail.method} />
              <span
                className="truncate text-[14px] font-semibold"
                style={{ color: 'var(--text-primary)' }}
                title={selectedDetail.requestName}
              >
                {selectedDetail.requestName}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="primary"
                size="compact"
                onClick={handleOpenAsNewRequest}
                className="flex items-center gap-1.5"
                title="Create a new draft in tabs with these request parameters"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open as new request</span>
              </Button>
              <Button
                variant="ghost"
                size="compact"
                onClick={handleDelete}
                className="p-1.5 text-(--status-err) hover:bg-(--status-err-bg) hover:text-(--status-err)"
                title="Delete this history entry"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* URL bar preview */}
          <div
            className="flex items-center justify-between gap-2 rounded border px-2.5 py-1.5 font-mono text-[12px] select-text"
            style={{
              backgroundColor: 'var(--bg-input)',
              borderColor: 'var(--border)',
              color: 'var(--text-secondary)',
            }}
          >
            <span className="truncate">{selectedDetail.url}</span>
            <button
              type="button"
              onClick={() => handleCopy(selectedDetail.url, 'url')}
              className="transition-fast shrink-0 p-1 hover:text-(--text-primary)"
              title="Copy URL"
            >
              {copiedField === 'url' ? (
                <Check className="h-3.5 w-3.5 text-(--status-ok)" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {/* Metadata badges */}
          <div
            className="flex items-center gap-4 text-[12px]"
            style={{ color: 'var(--text-muted)' }}
          >
            <div className="flex items-center gap-1.5">
              <span>Status:</span>
              {selectedDetail.status ? (
                <StatusBadge
                  status={selectedDetail.status}
                  statusText={selectedDetail.statusText}
                />
              ) : (
                <span className="rounded bg-(--status-err-bg) px-1.5 py-0.5 text-[11px] font-semibold text-(--status-err)">
                  Error
                </span>
              )}
            </div>
            <div>
              <span>Duration: </span>
              <span className="font-mono text-(--text-primary)">
                {formatDuration(selectedDetail.durationMs)}
              </span>
            </div>
            <div>
              <span>Size: </span>
              <span className="font-mono text-(--text-primary)">
                {formatBytes(selectedDetail.sizeBytes)}
              </span>
            </div>
            <div>
              <span>Recorded: </span>
              <span className="text-(--text-secondary)">{timestampStr}</span>
            </div>
          </div>
        </div>

        {/* Modal tabs */}
        <div
          className="flex shrink-0 items-center gap-1 border-b px-4 text-[13px] select-none"
          style={{ borderColor: 'var(--border)' }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('response')}
            className={`transition-fast border-b-2 px-3 py-2 font-medium ${
              activeTab === 'response'
                ? 'border-(--accent) text-(--text-primary)'
                : 'border-transparent text-(--text-secondary) hover:text-(--text-primary)'
            }`}
          >
            Response
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('request')}
            className={`transition-fast border-b-2 px-3 py-2 font-medium ${
              activeTab === 'request'
                ? 'border-(--accent) text-(--text-primary)'
                : 'border-transparent text-(--text-secondary) hover:text-(--text-primary)'
            }`}
          >
            Request
          </button>
          {hasError && (
            <button
              type="button"
              onClick={() => setActiveTab('error')}
              className={`transition-fast flex items-center gap-1.5 border-b-2 px-3 py-2 font-medium ${
                activeTab === 'error'
                  ? 'border-(--status-err) text-(--status-err)'
                  : 'border-transparent text-(--status-err) hover:opacity-80'
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Error Details</span>
            </button>
          )}
        </div>

        {/* Tab content */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 text-[13px]">
          {activeTab === 'response' && (
            <div className="flex flex-col gap-4">
              {/* Response Headers */}
              {selectedDetail.responseHeaders &&
                Object.keys(selectedDetail.responseHeaders).length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold tracking-wider text-(--text-secondary) uppercase">
                      Response Headers ({Object.keys(selectedDetail.responseHeaders).length})
                    </span>
                    <div
                      className="overflow-hidden rounded border"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <table className="w-full border-collapse text-left text-[12px]">
                        <thead>
                          <tr
                            className="border-b font-medium"
                            style={{
                              backgroundColor: 'var(--bg-secondary)',
                              borderColor: 'var(--border)',
                              color: 'var(--text-muted)',
                            }}
                          >
                            <th className="px-3 py-1.5">Header</th>
                            <th className="px-3 py-1.5">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(selectedDetail.responseHeaders).map(([k, v]) => (
                            <tr
                              key={k}
                              className="border-b last:border-b-0 hover:bg-(--bg-hover)"
                              style={{ borderColor: 'var(--border)' }}
                            >
                              <td className="px-3 py-1.5 font-mono font-medium text-(--text-primary)">
                                {k}
                              </td>
                              <td className="px-3 py-1.5 font-mono break-all text-(--text-secondary) select-text">
                                {v}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              {/* Response Body */}
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold tracking-wider text-(--text-secondary) uppercase">
                    Response Body
                  </span>
                  {selectedDetail.responseBody && (
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedDetail.responseBody!, 'body')}
                      className="transition-fast flex items-center gap-1 text-[11px] text-(--text-muted) hover:text-(--text-primary)"
                      title="Copy response body"
                    >
                      {copiedField === 'body' ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-(--status-ok)" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy Body</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {selectedDetail.responseBody ? (
                  <pre
                    className="max-h-87.5 overflow-x-auto rounded border p-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap select-text"
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {selectedDetail.responseBody}
                  </pre>
                ) : (
                  <div
                    className="rounded border p-6 text-center text-[12px]"
                    style={{
                      borderColor: 'var(--border)',
                      color: 'var(--text-muted)',
                      backgroundColor: 'var(--bg-secondary)',
                    }}
                  >
                    No response body recorded.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'request' && (
            <div className="flex flex-col gap-5">
              {/* Endpoint Overview */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold tracking-wider text-(--text-secondary) uppercase">
                  Target Endpoint
                </span>
                <div
                  className="flex items-center justify-between gap-2 rounded border p-2.5 font-mono text-[12px] select-text"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <MethodBadge method={selectedDetail.method} />
                    <span className="truncate">{selectedDetail.url}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(selectedDetail.url, 'req-url')}
                    className="transition-fast shrink-0 p-1 text-(--text-muted) hover:text-(--text-primary)"
                    title="Copy full URL"
                  >
                    {copiedField === 'req-url' ? (
                      <Check className="h-3.5 w-3.5 text-(--status-ok)" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Query Parameters */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold tracking-wider text-(--text-secondary) uppercase">
                  Query Parameters {displayParams.length > 0 ? `(${displayParams.length})` : ''}
                </span>
                {displayParams.length > 0 ? (
                  <div
                    className="overflow-hidden rounded border"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <table className="w-full border-collapse text-left text-[12px]">
                      <thead>
                        <tr
                          className="border-b font-medium"
                          style={{
                            backgroundColor: 'var(--bg-secondary)',
                            borderColor: 'var(--border)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          <th className="px-3 py-1.5">Parameter</th>
                          <th className="px-3 py-1.5">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayParams.map((p, i) => (
                          <tr
                            key={i}
                            className="border-b last:border-b-0 hover:bg-(--bg-hover)"
                            style={{ borderColor: 'var(--border)' }}
                          >
                            <td className="px-3 py-1.5 font-mono font-medium text-(--text-primary)">
                              {p.name}
                            </td>
                            <td className="px-3 py-1.5 font-mono break-all text-(--text-secondary) select-text">
                              {p.value}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div
                    className="rounded border p-3 text-[12px]"
                    style={{
                      borderColor: 'var(--border)',
                      color: 'var(--text-muted)',
                      backgroundColor: 'var(--bg-secondary)',
                    }}
                  >
                    No query parameters sent with this request.
                  </div>
                )}
              </div>

              {/* Request Headers */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold tracking-wider text-(--text-secondary) uppercase">
                  Request Headers {displayHeaders.length > 0 ? `(${displayHeaders.length})` : ''}
                </span>
                {displayHeaders.length > 0 ? (
                  <div
                    className="overflow-hidden rounded border"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <table className="w-full border-collapse text-left text-[12px]">
                      <thead>
                        <tr
                          className="border-b font-medium"
                          style={{
                            backgroundColor: 'var(--bg-secondary)',
                            borderColor: 'var(--border)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          <th className="px-3 py-1.5">Header</th>
                          <th className="px-3 py-1.5">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayHeaders.map((h, i) => (
                          <tr
                            key={i}
                            className="border-b last:border-b-0 hover:bg-(--bg-hover)"
                            style={{ borderColor: 'var(--border)' }}
                          >
                            <td className="px-3 py-1.5 font-mono font-medium text-(--text-primary)">
                              {h.name}
                            </td>
                            <td className="px-3 py-1.5 font-mono break-all text-(--text-secondary) select-text">
                              {h.value}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div
                    className="rounded border p-3 text-[12px]"
                    style={{
                      borderColor: 'var(--border)',
                      color: 'var(--text-muted)',
                      backgroundColor: 'var(--bg-secondary)',
                    }}
                  >
                    No custom request headers configured. (Standard headers like Accept-Encoding and
                    Host were applied automatically by the HTTP engine).
                  </div>
                )}
              </div>

              {/* Authentication */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold tracking-wider text-(--text-secondary) uppercase">
                  Authentication
                </span>
                <div
                  className="rounded border p-3 text-[12px]"
                  style={{
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: authDesc ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  {authDesc || 'No authentication (None)'}
                </div>
              </div>

              {/* Request Body */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold tracking-wider text-(--text-secondary) uppercase">
                    Request Body{' '}
                    {selectedDetail.requestSummary.bodyType
                      ? `(${selectedDetail.requestSummary.bodyType})`
                      : ''}
                  </span>
                  {selectedDetail.requestSummary.bodyContent && (
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(selectedDetail.requestSummary.bodyContent!, 'req-body')
                      }
                      className="transition-fast flex items-center gap-1 text-[11px] text-(--text-muted) hover:text-(--text-primary)"
                      title="Copy request body"
                    >
                      {copiedField === 'req-body' ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-(--status-ok)" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy Body</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {selectedDetail.requestSummary.bodyContent ? (
                  <pre
                    className="max-h-62.5 overflow-x-auto rounded border p-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap select-text"
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {selectedDetail.requestSummary.bodyContent}
                  </pre>
                ) : (
                  <div
                    className="rounded border p-3 text-[12px]"
                    style={{
                      borderColor: 'var(--border)',
                      color: 'var(--text-muted)',
                      backgroundColor: 'var(--bg-secondary)',
                    }}
                  >
                    No request body sent.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'error' && selectedDetail.errorMessage && (
            <div
              className="flex flex-col gap-2 rounded border p-4"
              style={{
                backgroundColor: 'var(--status-err-bg)',
                borderColor: 'var(--status-err)',
              }}
            >
              <div className="flex items-center gap-2 font-semibold text-(--status-err)">
                <AlertTriangle className="h-4 w-4" />
                <span>Execution Error</span>
              </div>
              <pre className="font-mono text-[12px] whitespace-pre-wrap text-(--status-err) select-text">
                {selectedDetail.errorMessage}
              </pre>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
