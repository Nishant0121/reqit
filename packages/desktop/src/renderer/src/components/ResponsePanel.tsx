import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Copy,
  Download,
  Check,
  AlertCircle,
  ArrowRight,
  Search,
  X,
  FileCode,
  FileText,
  Eye,
  Maximize2,
  ZoomIn,
  RefreshCw,
  Clock,
  Layers,
} from 'lucide-react';
import type { ResponseResult } from '@reqit/core';
import { StatusBadge } from './ui/Badge';
import { Button } from './ui/Button';
import { Tabs } from './ui/Tabs';
import { TimingWaterfall } from './ui/TimingWaterfall';
import { EmptyState } from './ui/EmptyState';
import { CodeEditor, type CodeEditorHandle, type EditorMode } from './editor/CodeEditor';
import { detectContentType, formatPretty, type DetectedFormat } from '../lib/content-type';
import { formatDuration, formatBytes } from '../lib/format';
import { strings } from '../lib/strings';

export interface ResponsePanelProps {
  result: ResponseResult | null;
  error: { message: string; cause?: string; action?: string } | null;
  loading: boolean;
  onSend: () => void;
  onCancel?: () => void;
}

export type ViewFormat = 'pretty' | 'raw' | 'preview';

const MAX_SAFE_DISPLAY_BYTES = 2 * 1024 * 1024; // 2 MB
const PREVIEW_CHUNK_SIZE = 512 * 1024; // 512 KB

export function ResponsePanel({
  result,
  error,
  loading,
  onSend,
  onCancel,
}: ResponsePanelProps): React.JSX.Element {
  // Navigation & view states
  const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'timing'>('body');
  const [viewFormat, setViewFormat] = useState<ViewFormat>('pretty');
  const [prettyMode, setPrettyMode] = useState<EditorMode>('json');
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [headerFilter, setHeaderFilter] = useState<string>('');

  // Large body streaming state
  const [streamedContent, setStreamedContent] = useState<string>('');
  const [streamedLoadedBytes, setStreamedLoadedBytes] = useState<number>(0);
  const [streamedHasMore, setStreamedHasMore] = useState<boolean>(false);
  const [streamLoading, setStreamLoading] = useState<boolean>(false);
  const [showFullInMemoryBody, setShowFullInMemoryBody] = useState<boolean>(false);

  // Live stopwatch for loading state
  const [elapsedMs, setElapsedMs] = useState<number>(0);

  // Image preview zoom
  const [imageZoomFit, setImageZoomFit] = useState<boolean>(true);

  // Code editor ref to trigger search
  const editorRef = useRef<CodeEditorHandle | null>(null);

  // Live timer while loading
  useEffect(() => {
    if (!loading) {
      setElapsedMs(0);
      return;
    }
    const start = performance.now();
    const interval = setInterval(() => {
      setElapsedMs(Math.round(performance.now() - start));
    }, 50);
    return () => clearInterval(interval);
  }, [loading]);

  // Extract Content-Type header robustly from array or object
  const contentTypeHeader = useMemo(() => {
    if (!result) return undefined;
    if (typeof result.getHeader === 'function') {
      return result.getHeader('content-type');
    }
    if (Array.isArray(result.headers)) {
      const match = result.headers.find(
        (h: { name: string; value: string }) => (h.name || '').toLowerCase() === 'content-type',
      );
      return match ? String(match.value) : undefined;
    }
    if (result.headers && typeof result.headers === 'object') {
      for (const [k, v] of Object.entries(result.headers)) {
        if (k.toLowerCase() === 'content-type') {
          return Array.isArray(v) ? v[0] : String(v);
        }
      }
    }
    return undefined;
  }, [result]);

  const contentInfo = useMemo(() => {
    return detectContentType(contentTypeHeader, result?.bodyBase64 || result?.body);
  }, [contentTypeHeader, result?.bodyBase64, result?.body]);

  // Auto-detect pretty mode and default view when result arrives
  useEffect(() => {
    if (!result) return;
    const info = detectContentType(contentTypeHeader, result.bodyBase64 || result.body);

    if (info.isImage || info.isSvg) {
      setViewFormat('preview');
      setActiveTab('body');
    } else {
      setViewFormat('pretty');
    }

    if (info.isJson) {
      setPrettyMode('json');
    } else if (info.isHtml) {
      setPrettyMode('html');
    } else if (info.isXml) {
      setPrettyMode('xml');
    } else {
      setPrettyMode('text');
    }

    setShowFullInMemoryBody(false);

    // If bodyPath was returned (streamed to disk)
    if (result.bodyPath && window.reqitApi?.readBodyChunk) {
      setStreamLoading(true);
      window.reqitApi
        .readBodyChunk({
          filePath: result.bodyPath,
          startByte: 0,
          lengthBytes: PREVIEW_CHUNK_SIZE,
        })
        .then(chunk => {
          setStreamedContent(chunk.content);
          setStreamedLoadedBytes(chunk.loadedBytes);
          setStreamedHasMore(chunk.hasMore);
        })
        .catch(() => {
          setStreamedContent('');
        })
        .finally(() => {
          setStreamLoading(false);
        });
    } else {
      setStreamedContent('');
      setStreamedLoadedBytes(0);
      setStreamedHasMore(false);
    }
  }, [result]);

  // Load more chunk from disk for large streamed responses
  const handleLoadMoreStream = async () => {
    if (!result?.bodyPath || !window.reqitApi?.readBodyChunk || streamLoading) return;
    setStreamLoading(true);
    try {
      const chunk = await window.reqitApi.readBodyChunk({
        filePath: result.bodyPath,
        startByte: streamedLoadedBytes,
        lengthBytes: PREVIEW_CHUNK_SIZE,
      });
      setStreamedContent(prev => prev + chunk.content);
      setStreamedLoadedBytes(chunk.loadedBytes);
      setStreamedHasMore(chunk.hasMore);
    } catch {
      // ignore
    } finally {
      setStreamLoading(false);
    }
  };

  // Copy entire response body
  const handleCopyBody = async () => {
    if (!result) return;
    const textToCopy = result.body || streamedContent || '';
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  // Copy individual header value
  const handleCopyHeader = async (key: string, val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      // ignore
    }
  };

  // Copy error details
  const handleCopyError = async () => {
    if (!error) return;
    const text = `Error: ${error.message}\nCause: ${error.cause || 'Unknown'}\nAction: ${error.action || 'None'}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Save body to file (Electron dialog or Web Blob download)
  const handleSaveBody = async () => {
    if (!result) return;

    let isBase64 = false;
    let ext = 'txt';
    if (contentInfo.isJson) ext = 'json';
    else if (contentInfo.isHtml) ext = 'html';
    else if (contentInfo.isXml) ext = 'xml';
    else if (contentInfo.isSvg) ext = 'svg';
    else if (contentInfo.isImage) {
      isBase64 = true;
      if (contentInfo.mimeType.includes('png')) ext = 'png';
      else if (contentInfo.mimeType.includes('jpeg') || contentInfo.mimeType.includes('jpg'))
        ext = 'jpg';
      else if (contentInfo.mimeType.includes('webp')) ext = 'webp';
      else if (contentInfo.mimeType.includes('gif')) ext = 'gif';
      else ext = 'bin';
    }

    const defaultName = `response-${Date.now()}.${ext}`;
    const payloadContent = result.bodyBase64 || result.body || streamedContent;

    if (window.reqitApi?.saveFileDialog) {
      await window.reqitApi.saveFileDialog({
        defaultName,
        content: payloadContent,
        sourceFilePath: result.bodyPath,
        isBase64,
      });
      return;
    }

    // Web download fallback
    if (isBase64 && payloadContent) {
      try {
        const binaryString = atob(payloadContent);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], {
          type: contentInfo.mimeType || 'application/octet-stream',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultName;
        a.click();
        URL.revokeObjectURL(url);
        return;
      } catch {
        // fallback to text blob
      }
    }

    const blob = new Blob([result.body || streamedContent || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultName;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 1. Error state (Section 8.3)
  if (error) {
    return (
      <div
        id="response-result"
        className="flex flex-col h-full p-4 overflow-y-auto select-none"
        style={{ backgroundColor: 'var(--bg-base)' }}
      >
        <div
          className="border rounded-[4px] p-4 max-w-xl space-y-3"
          style={{
            borderColor: 'var(--danger)',
            backgroundColor: 'var(--danger-subtle)',
          }}
        >
          <div className="flex items-center justify-between">
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
            <button
              type="button"
              onClick={handleCopyError}
              className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium border rounded-[4px] hover:bg-[var(--bg-hover)] transition-fast"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
              }}
            >
              {copied ? (
                <Check className="w-3 h-3 text-[var(--success)]" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              <span>{copied ? 'Copied' : 'Copy error details'}</span>
            </button>
          </div>

          <div className="text-[13px] space-y-2" style={{ color: 'var(--text-primary)' }}>
            <div>
              <span
                className="font-medium text-[12px] block"
                style={{ color: 'var(--text-secondary)' }}
              >
                {strings.errors.whatHappened}
              </span>
              <span className="font-mono text-[12px]">{error.message}</span>
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
        className="flex items-center justify-center h-full select-none"
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

  // 3. Loading state with live stopwatch timer (Section 8.1)
  if (loading && !result) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full select-none space-y-3"
        style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-muted)' }}
      >
        <div className="flex items-center gap-2.5 text-[13px]">
          <span
            className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin spin-allowed"
            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
          />
          <span style={{ color: 'var(--text-primary)' }}>{strings.urlBar.sending}</span>
          <span className="font-mono text-[12px] font-semibold" style={{ color: 'var(--accent)' }}>
            {elapsedMs} ms
          </span>
        </div>

        {onCancel && (
          <Button
            variant="ghost"
            size="compact"
            onClick={onCancel}
            className="border text-[11px] px-3 h-[24px]"
            style={{ borderColor: 'var(--border)' }}
          >
            Cancel (Esc)
          </Button>
        )}
      </div>
    );
  }

  if (!result) return <div />;

  // Normalize headers into Array<{ name: string; value: string }>
  const headersList: Array<{ name: string; value: string }> = Array.isArray(result.headers)
    ? result.headers.map((h: { name: string; value: string }) => ({
        name: h.name,
        value: String(h.value ?? ''),
      }))
    : Object.entries(result.headers || {}).map(([k, v]) => ({
        name: k,
        value: Array.isArray(v) ? v.join(', ') : String(v ?? ''),
      }));

  const filteredHeaders = headersList.filter(h => {
    if (!headerFilter.trim()) return true;
    const q = headerFilter.toLowerCase();
    return h.name.toLowerCase().includes(q) || h.value.toLowerCase().includes(q);
  });

  // Determine body content to display
  const rawBodyText = result.body !== undefined ? result.body : streamedContent;
  const isLargeInMemory =
    result.sizeBytes > MAX_SAFE_DISPLAY_BYTES && result.body !== undefined && !showFullInMemoryBody;

  const displayBodyContent = isLargeInMemory
    ? rawBodyText.slice(0, PREVIEW_CHUNK_SIZE)
    : rawBodyText;

  const prettyFormattedBody =
    viewFormat === 'pretty'
      ? formatPretty(displayBodyContent, prettyMode as DetectedFormat)
      : displayBodyContent;

  return (
    <div
      id="response-result"
      className="flex flex-col h-full overflow-hidden"
      style={{ backgroundColor: 'var(--bg-surface)' }}
    >
      {/* Response Header Strip (Section 6.6) */}
      <div
        className="flex items-center justify-between px-3 h-[36px] border-b select-none shrink-0"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border)',
        }}
      >
        {/* Status, Time, Size */}
        <div className="flex items-center gap-3">
          <StatusBadge status={result.status} statusText={result.statusText} />
          <span
            className="text-[12px] font-mono flex items-center gap-1.5"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" strokeWidth={1.75} />
            {formatDuration(result.totalMs)}
          </span>
          <span
            className="text-[12px] font-mono flex items-center gap-1.5"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Layers className="w-3.5 h-3.5 text-[var(--text-muted)]" strokeWidth={1.75} />
            {formatBytes(result.sizeBytes)}
          </span>
        </div>

        {/* Action buttons (Search, Copy, Save) */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="compact"
            onClick={() => editorRef.current?.openSearch()}
            title="In-body search (Ctrl+F)"
            aria-label="Search response"
            className="w-8 h-8 p-0 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-fast"
          >
            <Search className="w-4 h-4" strokeWidth={1.8} />
          </Button>

          <Button
            variant="ghost"
            size="compact"
            onClick={handleCopyBody}
            title={copied ? strings.responsePanel.copied : strings.responsePanel.copyResponse}
            aria-label={strings.responsePanel.copyResponse}
            className="w-8 h-8 p-0 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-fast"
          >
            {copied ? (
              <Check className="w-4 h-4" style={{ color: 'var(--success)' }} strokeWidth={2} />
            ) : (
              <Copy className="w-4 h-4" strokeWidth={1.8} />
            )}
          </Button>

          <Button
            variant="ghost"
            size="compact"
            onClick={handleSaveBody}
            title={strings.responsePanel.saveResponse}
            aria-label={strings.responsePanel.saveResponse}
            className="w-8 h-8 p-0 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-fast"
          >
            <Download className="w-4 h-4" strokeWidth={1.8} />
          </Button>
        </div>
      </div>

      {/* Response Sub-tabs and View Mode Controls */}
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

        {/* Body View Mode Selector (Pretty / Raw / Preview) */}
        {activeTab === 'body' && (
          <div className="flex items-center gap-2">
            {/* Format mode selector if in Pretty mode */}
            {viewFormat === 'pretty' && (
              <select
                value={prettyMode}
                onChange={e => setPrettyMode(e.target.value as EditorMode)}
                className="h-[22px] px-1 text-[11px] bg-transparent border rounded-[2px] outline-none cursor-pointer"
                style={{
                  borderColor: 'var(--border)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-secondary)',
                }}
              >
                <option
                  value="json"
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                >
                  JSON
                </option>
                <option
                  value="xml"
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                >
                  XML
                </option>
                <option
                  value="html"
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                >
                  HTML
                </option>
                <option
                  value="text"
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                >
                  Text
                </option>
              </select>
            )}

            {/* Segmented Pill Control for View Format */}
            <div
              className="inline-flex items-center p-0.5 rounded-[4px] border select-none transition-fast"
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: 'var(--border)',
              }}
            >
              {[
                { id: 'pretty', label: strings.responsePanel.pretty, icon: FileCode },
                { id: 'raw', label: strings.responsePanel.raw, icon: FileText },
                { id: 'preview', label: 'Preview', icon: Eye },
              ].map(opt => {
                const isSelected = viewFormat === opt.id;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setViewFormat(opt.id as ViewFormat)}
                    className="flex items-center gap-1 h-[20px] px-2 rounded-[2px] text-[11px] font-medium transition-fast app-focus-ring"
                    style={{
                      backgroundColor: isSelected ? 'var(--bg-elevated)' : 'transparent',
                      color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)',
                      boxShadow: isSelected ? '0 1px 2px rgba(0, 0, 0, 0.2)' : 'none',
                    }}
                  >
                    <Icon
                      className="w-3.5 h-3.5"
                      style={{ color: isSelected ? 'var(--accent)' : 'inherit' }}
                      strokeWidth={1.75}
                    />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sub-tab Views */}
      <div className="flex-1 overflow-auto p-3">
        {/* BODY TAB VIEW */}
        {activeTab === 'body' && (
          <div className="flex flex-col h-full space-y-2">
            {/* Large streamed body notice */}
            {result.bodyPath && (
              <div
                className="p-2.5 rounded-[4px] text-[12px] border flex items-center justify-between"
                style={{
                  backgroundColor: 'var(--info-subtle)',
                  borderColor: 'var(--info)',
                  color: 'var(--text-primary)',
                }}
              >
                <span>
                  {strings.responsePanel.streamedNotice(result.bodyPath)} (
                  {formatBytes(result.sizeBytes)})
                </span>
                <div className="flex items-center gap-2">
                  {streamedHasMore && (
                    <button
                      type="button"
                      disabled={streamLoading}
                      onClick={handleLoadMoreStream}
                      className="px-2 py-0.5 text-[11px] font-medium border rounded-[2px] hover:bg-[var(--bg-hover)] transition-fast flex items-center gap-1"
                      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
                    >
                      <RefreshCw className={`w-3 h-3 ${streamLoading ? 'animate-spin' : ''}`} />
                      <span>Load more</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveBody}
                    className="px-2 py-0.5 text-[11px] font-medium border rounded-[2px] hover:bg-[var(--bg-hover)] transition-fast"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
                  >
                    Save full file
                  </button>
                </div>
              </div>
            )}

            {/* Large in-memory body truncation notice */}
            {isLargeInMemory && (
              <div
                className="p-2.5 rounded-[4px] text-[12px] border flex items-center justify-between"
                style={{
                  backgroundColor: 'var(--warning-subtle)',
                  borderColor: 'var(--warning)',
                  color: 'var(--text-primary)',
                }}
              >
                <span>
                  Large response ({formatBytes(result.sizeBytes)}). Showing preview chunk to keep UI
                  responsive.
                </span>
                <button
                  type="button"
                  onClick={() => setShowFullInMemoryBody(true)}
                  className="px-2 py-0.5 text-[11px] font-medium border rounded-[2px] hover:bg-[var(--bg-hover)] transition-fast"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
                >
                  Load full content
                </button>
              </div>
            )}

            {/* PREVIEW MODE: HTML, Image, SVG */}
            {viewFormat === 'preview' && (
              <div className="flex-1 h-full min-h-[220px]">
                {contentInfo.isHtml ? (
                  <iframe
                    title="HTML Preview"
                    sandbox="allow-same-origin"
                    srcDoc={rawBodyText}
                    className="w-full h-full min-h-[300px] border rounded-[4px] bg-white"
                  />
                ) : contentInfo.isImage || contentInfo.isSvg ? (
                  <div
                    className="flex flex-col items-center justify-center p-4 h-full border rounded-[4px] relative overflow-hidden"
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                      <button
                        type="button"
                        onClick={() => setImageZoomFit(!imageZoomFit)}
                        className="p-1 rounded-[2px] border hover:bg-[var(--bg-hover)] transition-fast text-[11px] flex items-center gap-1"
                        style={{
                          borderColor: 'var(--border)',
                          backgroundColor: 'var(--bg-surface)',
                        }}
                      >
                        {imageZoomFit ? (
                          <ZoomIn className="w-4 h-4" strokeWidth={1.75} />
                        ) : (
                          <Maximize2 className="w-4 h-4" strokeWidth={1.75} />
                        )}
                        <span>{imageZoomFit ? 'Fit' : '100%'}</span>
                      </button>
                    </div>

                    {contentInfo.isSvg && rawBodyText.includes('<svg') ? (
                      <div
                        dangerouslySetInnerHTML={{ __html: rawBodyText }}
                        className={imageZoomFit ? 'max-w-full max-h-[360px]' : ''}
                      />
                    ) : (
                      <div className="flex-1 flex items-center justify-center w-full overflow-auto p-4">
                        <div
                          className="p-3 rounded border shadow-sm max-w-full max-h-[420px] flex items-center justify-center overflow-auto"
                          style={{
                            borderColor: 'var(--border)',
                            backgroundColor: 'var(--bg-elevated)',
                            backgroundImage:
                              'linear-gradient(45deg, var(--bg-hover) 25%, transparent 25%), linear-gradient(-45deg, var(--bg-hover) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--bg-hover) 75%), linear-gradient(-45deg, transparent 75%, var(--bg-hover) 75%)',
                            backgroundSize: '16px 16px',
                            backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                          }}
                        >
                          <img
                            src={
                              rawBodyText.startsWith('data:')
                                ? rawBodyText
                                : `data:${contentInfo.mimeType || 'image/png'};base64,${result.bodyBase64 || rawBodyText}`
                            }
                            alt="Response preview"
                            className={`rounded transition-transform ${
                              imageZoomFit
                                ? 'max-w-full max-h-[360px] object-contain'
                                : 'max-w-none'
                            }`}
                          />
                        </div>
                      </div>
                    )}

                    <div className="mt-3 text-[11px] font-mono text-[var(--text-muted)]">
                      {contentInfo.mimeType} · {formatBytes(result.sizeBytes)}
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-center h-48 border border-dashed rounded-[4px] text-[12px]"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                  >
                    Preview is not available for this content type. Use Pretty or Raw view.
                  </div>
                )}
              </div>
            )}

            {/* PRETTY OR RAW EDITOR MODE */}
            {viewFormat !== 'preview' && (
              <div className="flex-1 min-h-[200px]">
                {rawBodyText ? (
                  <CodeEditor
                    ref={editorRef}
                    value={prettyFormattedBody}
                    readOnly
                    mode={viewFormat === 'raw' ? 'text' : prettyMode}
                    background="surface"
                    minHeight="220px"
                    maxHeight="100%"
                  />
                ) : (
                  <pre
                    className="p-3 font-mono text-[12px] leading-relaxed select-text outline-none rounded-[4px] border whitespace-pre-wrap break-all"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    [{strings.responsePanel.emptyBody}]
                  </pre>
                )}
              </div>
            )}
          </div>
        )}

        {/* HEADERS TAB VIEW */}
        {activeTab === 'headers' && (
          <div className="space-y-3">
            {/* Search filter bar */}
            <div className="flex items-center justify-between">
              <div
                className="relative flex items-center h-[28px] w-full max-w-sm rounded-[4px] border px-2 text-[12px]"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  borderColor: 'var(--border-strong)',
                }}
              >
                <Search
                  className="w-4 h-4 mr-1.5 shrink-0"
                  style={{ color: 'var(--text-muted)' }}
                  strokeWidth={1.75}
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
                {headerFilter && (
                  <button
                    type="button"
                    onClick={() => setHeaderFilter('')}
                    className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    title="Clear filter"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </button>
                )}
              </div>

              <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
                {headerFilter
                  ? `Filtered: ${filteredHeaders.length} of ${headersList.length}`
                  : `${headersList.length} headers`}
              </span>
            </div>

            {/* Headers Table */}
            <div
              className="w-full border rounded-[4px] overflow-hidden"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-base)' }}
            >
              <table className="w-full border-collapse text-left text-[12px]">
                <thead>
                  <tr
                    className="border-b"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <th className="px-3 py-1.5 font-medium w-1/3">Header</th>
                    <th className="px-3 py-1.5 font-medium">Value</th>
                    <th className="w-8 px-2 py-1.5 text-center font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHeaders.map(h => (
                    <tr
                      key={h.name}
                      className="group border-b last:border-b-0 hover:bg-[var(--bg-hover)] transition-fast"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <td
                        className="px-3 py-1.5 font-mono text-[12px] font-medium"
                        style={{ color: 'var(--syntax-key)' }}
                      >
                        {h.name}
                      </td>
                      <td
                        className="px-3 py-1.5 font-mono text-[12px] break-all select-text"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {h.value}
                      </td>
                      <td className="px-2 py-1 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => handleCopyHeader(h.name, h.value)}
                          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-active)] transition-fast text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                          title="Copy header value"
                        >
                          {copiedKey === h.name ? (
                            <Check className="w-4 h-4 text-[var(--success)]" strokeWidth={2} />
                          ) : (
                            <Copy className="w-4 h-4" strokeWidth={1.8} />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredHeaders.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
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
          </div>
        )}

        {/* TIMING TAB VIEW */}
        {activeTab === 'timing' && (
          <div>
            {result.timing ? (
              <TimingWaterfall
                timing={result.timing}
                totalMs={result.totalMs}
                redirectHops={result.redirectHops || result.redirects}
              />
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
