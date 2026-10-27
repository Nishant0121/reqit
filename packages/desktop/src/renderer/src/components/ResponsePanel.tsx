import React, { useState } from 'react';
import { Copy, Download, Check, AlertCircle, ArrowRight, Search } from 'lucide-react';
import type { ResponseResult } from '@reqit/core';
import { StatusBadge } from './ui/Badge';
import { Button } from './ui/Button';
import { Tabs } from './ui/Tabs';
import { TimingWaterfall } from './ui/TimingWaterfall';
import { EmptyState } from './ui/EmptyState';
import { formatDuration, formatBytes } from '../lib/format';
import { strings } from '../lib/strings';

export interface ResponsePanelProps {
  result: ResponseResult | null;
  error: { message: string; cause?: string; action?: string } | null;
  loading: boolean;
  onSend: () => void;
}

export function ResponsePanel({
  result,
  error,
  loading,
  onSend,
}: ResponsePanelProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'timing'>('body');
  const [formatMode, setFormatMode] = useState<'pretty' | 'raw'>('pretty');
  const [copied, setCopied] = useState<boolean>(false);
  const [headerFilter, setHeaderFilter] = useState<string>('');

  const handleCopy = async () => {
    if (!result) return;
    const textToCopy = result.body || '';
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleSave = () => {
    if (!result) return;
    const blob = new Blob([result.body || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `response-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatBody = (body: string | undefined): string => {
    if (!body) return '';
    if (formatMode === 'raw') return body;
    try {
      const parsed = JSON.parse(body);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return body;
    }
  };

  // 1. Error state (Section 8.3)
  if (error) {
    return (
      <div
        id="response-result"
        className="flex flex-col h-full p-4 overflow-y-auto"
        style={{ backgroundColor: 'var(--bg-base)' }}
      >
        <div
          className="border rounded-[4px] p-4 max-w-xl space-y-3"
          style={{
            borderColor: 'var(--danger)',
            backgroundColor: 'var(--danger-subtle)',
          }}
        >
          <div className="flex items-center gap-2">
            <AlertCircle
              className="w-5 h-5 shrink-0"
              style={{ color: 'var(--danger)' }}
              strokeWidth={1.5}
            />
            <span className="font-semibold text-[14px]" style={{ color: 'var(--danger)' }}>
              {strings.errors.errorPrefix}
            </span>
          </div>

          <div className="text-[13px] space-y-1.5" style={{ color: 'var(--text-primary)' }}>
            <div>
              <span
                className="font-medium text-[12px] block"
                style={{ color: 'var(--text-secondary)' }}
              >
                {strings.errors.whatHappened}
              </span>
              <span>{error.message}</span>
            </div>

            {error.cause && (
              <div>
                <span
                  className="font-medium text-[12px] block"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {strings.errors.why}
                </span>
                <span>{error.cause}</span>
              </div>
            )}

            <div>
              <span
                className="font-medium text-[12px] block"
                style={{ color: 'var(--text-secondary)' }}
              >
                {strings.errors.whatToDo}
              </span>
              <span>{error.action || 'Verify that the server is reachable and running.'}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Empty state (Section 8.2)
  if (!result && !loading) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ backgroundColor: 'var(--bg-base)' }}
      >
        <EmptyState
          icon={<ArrowRight className="w-6 h-6" strokeWidth={1.5} />}
          title={strings.responsePanel.emptyStateTitle}
          description={strings.responsePanel.emptyStateHelp}
          actionLabel={strings.urlBar.send}
          onAction={onSend}
        />
      </div>
    );
  }

  // 3. Loading state
  if (loading && !result) {
    return (
      <div
        className="flex items-center justify-center h-full select-none"
        style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-muted)' }}
      >
        <div className="flex items-center gap-2 text-[13px]">
          <span
            className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin spin-allowed"
            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
          />
          <span>{strings.urlBar.sending}</span>
        </div>
      </div>
    );
  }

  if (!result) return <div />;

  const headersList = Object.entries(result.headers || {});
  const filteredHeaders = headersList.filter(([k, v]) => {
    if (!headerFilter.trim()) return true;
    const q = headerFilter.toLowerCase();
    return k.toLowerCase().includes(q) || String(v).toLowerCase().includes(q);
  });

  return (
    <div
      id="response-result"
      className="flex flex-col h-full overflow-hidden"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      {/* Response Header Strip (Section 6.6) */}
      <div
        className="flex items-center justify-between px-3 h-[36px] border-b select-none shrink-0"
        style={{
          backgroundColor: 'var(--bg-subtle)',
          borderColor: 'var(--border)',
        }}
      >
        {/* Status, Time, Size */}
        <div className="flex items-center gap-3">
          <StatusBadge status={result.status} statusText={result.statusText} />
          <span className="text-[12px] font-mono" style={{ color: 'var(--text-secondary)' }}>
            {formatDuration(result.totalMs)}
          </span>
          <span className="text-[12px] font-mono" style={{ color: 'var(--text-secondary)' }}>
            {formatBytes(result.sizeBytes)}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="compact"
            onClick={handleCopy}
            title={copied ? strings.responsePanel.copied : strings.responsePanel.copyResponse}
            aria-label={strings.responsePanel.copyResponse}
            className="w-7 h-7 p-0"
          >
            {copied ? (
              <Check
                className="w-3.5 h-3.5"
                style={{ color: 'var(--success)' }}
                strokeWidth={1.5}
              />
            ) : (
              <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
            )}
          </Button>

          <Button
            variant="ghost"
            size="compact"
            onClick={handleSave}
            title={strings.responsePanel.saveResponse}
            aria-label={strings.responsePanel.saveResponse}
            className="w-7 h-7 p-0"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
          </Button>
        </div>
      </div>

      {/* Response Sub-tabs */}
      <div
        className="flex items-center justify-between px-3 border-b select-none shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        <Tabs
          items={[
            { id: 'body', label: strings.responsePanel.bodyTab },
            { id: 'headers', label: strings.responsePanel.headersTab, count: headersList.length },
            { id: 'timing', label: strings.responsePanel.timingTab },
          ]}
          activeId={activeTab}
          onChange={id => setActiveTab(id as typeof activeTab)}
        />

        {activeTab === 'body' && (
          <div className="flex items-center gap-1 text-[11px]">
            <button
              type="button"
              onClick={() => setFormatMode('pretty')}
              className="px-2 py-0.5 rounded-[4px] font-medium transition-fast app-focus-ring"
              style={{
                backgroundColor: formatMode === 'pretty' ? 'var(--bg-muted)' : 'transparent',
                color: formatMode === 'pretty' ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              {strings.responsePanel.pretty}
            </button>
            <button
              type="button"
              onClick={() => setFormatMode('raw')}
              className="px-2 py-0.5 rounded-[4px] font-medium transition-fast app-focus-ring"
              style={{
                backgroundColor: formatMode === 'raw' ? 'var(--bg-muted)' : 'transparent',
                color: formatMode === 'raw' ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              {strings.responsePanel.raw}
            </button>
          </div>
        )}
      </div>

      {/* Sub-tab Views */}
      <div className="flex-1 overflow-auto p-3">
        {activeTab === 'body' && (
          <div>
            {result.bodyPath && (
              <div
                className="mb-3 p-2 rounded-[4px] text-[12px] border"
                style={{
                  backgroundColor: 'var(--info-subtle)',
                  borderColor: 'var(--info)',
                  color: 'var(--text-primary)',
                }}
              >
                {strings.responsePanel.streamedNotice(result.bodyPath)}
              </div>
            )}
            <pre
              className="p-3 font-mono text-[12px] leading-relaxed select-text outline-none rounded-[4px] border whitespace-pre-wrap break-all"
              style={{
                backgroundColor: 'var(--bg-subtle)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              {formatBody(result.body) || `[${strings.responsePanel.emptyBody}]`}
            </pre>
          </div>
        )}

        {activeTab === 'headers' && (
          <div className="space-y-3">
            <div
              className="relative flex items-center h-[28px] max-w-sm rounded-[4px] border px-2 text-[12px]"
              style={{
                backgroundColor: 'var(--bg-base)',
                borderColor: 'var(--border-strong)',
              }}
            >
              <Search
                className="w-3.5 h-3.5 mr-1.5 shrink-0"
                style={{ color: 'var(--text-muted)' }}
                strokeWidth={1.5}
              />
              <input
                type="text"
                value={headerFilter}
                onChange={e => setHeaderFilter(e.target.value)}
                placeholder={strings.responsePanel.filterHeaders}
                className="w-full bg-transparent outline-none app-focus-ring text-[12px]"
                style={{ color: 'var(--text-primary)' }}
                aria-label={strings.responsePanel.filterHeaders}
              />
            </div>

            <table className="w-full border-collapse text-left text-[12px]">
              <thead>
                <tr
                  className="border-b"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  <th className="py-1.5 font-medium w-1/3">Header</th>
                  <th className="py-1.5 font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {filteredHeaders.map(([key, val]) => (
                  <tr
                    key={key}
                    className="border-b last:border-b-0"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <td
                      className="py-1.5 pr-2 font-mono text-[12px]"
                      style={{ color: 'var(--syntax-key)' }}
                    >
                      {key}
                    </td>
                    <td
                      className="py-1.5 font-mono text-[12px] break-all select-text"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {Array.isArray(val) ? val.join(', ') : String(val)}
                    </td>
                  </tr>
                ))}
                {filteredHeaders.length === 0 && (
                  <tr>
                    <td
                      colSpan={2}
                      className="py-4 text-center"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {strings.responsePanel.noHeadersFound}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'timing' && (
          <div>
            {result.timing ? (
              <TimingWaterfall timing={result.timing} totalMs={result.totalMs} />
            ) : (
              <div className="p-4 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>
                No timing breakdown available for this request.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
