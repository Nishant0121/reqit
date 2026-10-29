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
      <div className="flex flex-col h-[70vh] -mx-6 -my-4">
        {/* Top summary banner */}
        <div
          className="p-4 border-b flex flex-col gap-2 shrink-0 select-none"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-hidden min-w-0">
              <MethodBadge method={selectedDetail.method} />
              <span
                className="font-semibold text-[14px] truncate"
                style={{ color: 'var(--text-primary)' }}
                title={selectedDetail.requestName}
              >
                {selectedDetail.requestName}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="primary"
                size="compact"
                onClick={handleOpenAsNewRequest}
                className="flex items-center gap-1.5"
                title="Create a new draft in tabs with these request parameters"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open as new request</span>
              </Button>
              <Button
                variant="ghost"
                size="compact"
                onClick={handleDelete}
                className="text-[var(--status-err)] hover:bg-[var(--status-err-bg)] hover:text-[var(--status-err)] p-1.5"
                title="Delete this history entry"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* URL bar preview */}
          <div
            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded border text-[12px] font-mono select-text"
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
              className="p-1 hover:text-[var(--text-primary)] transition-fast shrink-0"
              title="Copy URL"
            >
              {copiedField === 'url' ? (
                <Check className="w-3.5 h-3.5 text-[var(--status-ok)]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
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
                <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-[var(--status-err-bg)] text-[var(--status-err)]">
                  Error
                </span>
              )}
            </div>
            <div>
              <span>Duration: </span>
              <span className="font-mono text-[var(--text-primary)]">
                {formatDuration(selectedDetail.durationMs)}
              </span>
            </div>
            <div>
              <span>Size: </span>
              <span className="font-mono text-[var(--text-primary)]">
                {formatBytes(selectedDetail.sizeBytes)}
              </span>
            </div>
            <div>
              <span>Recorded: </span>
              <span className="text-[var(--text-secondary)]">{timestampStr}</span>
            </div>
          </div>
        </div>

        {/* Modal tabs */}
        <div
          className="flex items-center gap-1 px-4 border-b shrink-0 text-[13px] select-none"
          style={{ borderColor: 'var(--border)' }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('response')}
            className={`px-3 py-2 border-b-2 font-medium transition-fast ${
              activeTab === 'response'
                ? 'border-[var(--accent)] text-[var(--text-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Response
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('request')}
            className={`px-3 py-2 border-b-2 font-medium transition-fast ${
              activeTab === 'request'
                ? 'border-[var(--accent)] text-[var(--text-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Request
          </button>
          {hasError && (
            <button
              type="button"
              onClick={() => setActiveTab('error')}
              className={`px-3 py-2 border-b-2 font-medium transition-fast flex items-center gap-1.5 ${
                activeTab === 'error'
                  ? 'border-[var(--status-err)] text-[var(--status-err)]'
                  : 'border-transparent text-[var(--status-err)] hover:opacity-80'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Error Details</span>
            </button>
          )}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-[13px]">
          {activeTab === 'response' && (
            <div className="flex flex-col gap-4">
              {/* Response Headers */}
              {selectedDetail.responseHeaders &&
                Object.keys(selectedDetail.responseHeaders).length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="font-semibold text-[12px] text-[var(--text-secondary)] uppercase tracking-wider">
                      Response Headers ({Object.keys(selectedDetail.responseHeaders).length})
                    </span>
                    <div
                      className="rounded border overflow-hidden"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <table className="w-full text-left border-collapse text-[12px]">
                        <thead>
                          <tr
                            className="border-b font-medium"
                            style={{
                              backgroundColor: 'var(--bg-secondary)',
                              borderColor: 'var(--border)',
                              color: 'var(--text-muted)',
                            }}
                          >
                            <th className="py-1.5 px-3">Header</th>
                            <th className="py-1.5 px-3">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(selectedDetail.responseHeaders).map(([k, v]) => (
                            <tr
                              key={k}
                              className="border-b last:border-b-0 hover:bg-[var(--bg-hover)]"
                              style={{ borderColor: 'var(--border)' }}
                            >
                              <td className="py-1.5 px-3 font-mono font-medium text-[var(--text-primary)]">
                                {k}
                              </td>
                              <td className="py-1.5 px-3 font-mono text-[var(--text-secondary)] select-text break-all">
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
              <div className="flex flex-col gap-1.5 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[12px] text-[var(--text-secondary)] uppercase tracking-wider">
                    Response Body
                  </span>
                  {selectedDetail.responseBody && (
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedDetail.responseBody!, 'body')}
                      className="flex items-center gap-1 text-[11px] hover:text-[var(--text-primary)] transition-fast text-[var(--text-muted)]"
                      title="Copy response body"
                    >
                      {copiedField === 'body' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[var(--status-ok)]" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Body</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {selectedDetail.responseBody ? (
                  <pre
                    className="p-3 rounded border font-mono text-[12px] leading-relaxed overflow-x-auto whitespace-pre-wrap select-text max-h-[350px]"
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
                    className="p-6 text-center rounded border text-[12px]"
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
                <span className="font-semibold text-[12px] text-[var(--text-secondary)] uppercase tracking-wider">
                  Target Endpoint
                </span>
                <div
                  className="flex items-center justify-between gap-2 p-2.5 rounded border text-[12px] font-mono select-text"
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
                    className="p-1 hover:text-[var(--text-primary)] transition-fast shrink-0 text-[var(--text-muted)]"
                    title="Copy full URL"
                  >
                    {copiedField === 'req-url' ? (
                      <Check className="w-3.5 h-3.5 text-[var(--status-ok)]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Query Parameters */}
              <div className="flex flex-col gap-1.5">
                <span className="font-semibold text-[12px] text-[var(--text-secondary)] uppercase tracking-wider">
                  Query Parameters {displayParams.length > 0 ? `(${displayParams.length})` : ''}
                </span>
                {displayParams.length > 0 ? (
                  <div
                    className="rounded border overflow-hidden"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <table className="w-full text-left border-collapse text-[12px]">
                      <thead>
                        <tr
                          className="border-b font-medium"
                          style={{
                            backgroundColor: 'var(--bg-secondary)',
                            borderColor: 'var(--border)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          <th className="py-1.5 px-3">Parameter</th>
                          <th className="py-1.5 px-3">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayParams.map((p, i) => (
                          <tr
                            key={i}
                            className="border-b last:border-b-0 hover:bg-[var(--bg-hover)]"
                            style={{ borderColor: 'var(--border)' }}
                          >
                            <td className="py-1.5 px-3 font-mono font-medium text-[var(--text-primary)]">
                              {p.name}
                            </td>
                            <td className="py-1.5 px-3 font-mono text-[var(--text-secondary)] select-text break-all">
                              {p.value}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div
                    className="p-3 rounded border text-[12px]"
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
                <span className="font-semibold text-[12px] text-[var(--text-secondary)] uppercase tracking-wider">
                  Request Headers {displayHeaders.length > 0 ? `(${displayHeaders.length})` : ''}
                </span>
                {displayHeaders.length > 0 ? (
                  <div
                    className="rounded border overflow-hidden"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <table className="w-full text-left border-collapse text-[12px]">
                      <thead>
                        <tr
                          className="border-b font-medium"
                          style={{
                            backgroundColor: 'var(--bg-secondary)',
                            borderColor: 'var(--border)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          <th className="py-1.5 px-3">Header</th>
                          <th className="py-1.5 px-3">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayHeaders.map((h, i) => (
                          <tr
                            key={i}
                            className="border-b last:border-b-0 hover:bg-[var(--bg-hover)]"
                            style={{ borderColor: 'var(--border)' }}
                          >
                            <td className="py-1.5 px-3 font-mono font-medium text-[var(--text-primary)]">
                              {h.name}
                            </td>
                            <td className="py-1.5 px-3 font-mono text-[var(--text-secondary)] select-text break-all">
                              {h.value}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div
                    className="p-3 rounded border text-[12px]"
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
                <span className="font-semibold text-[12px] text-[var(--text-secondary)] uppercase tracking-wider">
                  Authentication
                </span>
                <div
                  className="p-3 rounded border text-[12px]"
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
                  <span className="font-semibold text-[12px] text-[var(--text-secondary)] uppercase tracking-wider">
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
                      className="flex items-center gap-1 text-[11px] hover:text-[var(--text-primary)] transition-fast text-[var(--text-muted)]"
                      title="Copy request body"
                    >
                      {copiedField === 'req-body' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[var(--status-ok)]" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Body</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {selectedDetail.requestSummary.bodyContent ? (
                  <pre
                    className="p-3 rounded border font-mono text-[12px] leading-relaxed overflow-x-auto whitespace-pre-wrap select-text max-h-[250px]"
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
                    className="p-3 rounded border text-[12px]"
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
              className="p-4 rounded border flex flex-col gap-2"
              style={{
                backgroundColor: 'var(--status-err-bg)',
                borderColor: 'var(--status-err)',
              }}
            >
              <div className="flex items-center gap-2 text-[var(--status-err)] font-semibold">
                <AlertTriangle className="w-4 h-4" />
                <span>Execution Error</span>
              </div>
              <pre className="font-mono text-[12px] text-[var(--status-err)] whitespace-pre-wrap select-text">
                {selectedDetail.errorMessage}
              </pre>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
