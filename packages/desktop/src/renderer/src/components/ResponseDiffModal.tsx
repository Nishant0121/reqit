import React, { useState, useMemo } from 'react';
import { Split, Columns, ArrowRight } from 'lucide-react';
import { Modal } from './ui/Modal';
import { computeLineDiff } from '../lib/diff';
import { formatDuration, formatBytes } from '../lib/format';
import type { ResponseResult } from '@reqit/core';

export interface ResponseDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  pinnedResponse: ResponseResult;
  currentResponse: ResponseResult;
}

function formatBody(resp: ResponseResult): string {
  if (!resp.body) return '';
  const text = typeof resp.body === 'string' ? resp.body : String(resp.body);
  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return text;
  }
}

export function ResponseDiffModal({
  isOpen,
  onClose,
  pinnedResponse,
  currentResponse,
}: ResponseDiffModalProps): React.JSX.Element | null {
  const [activeTab, setActiveTab] = useState<'body' | 'headers'>('body');
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');

  const pinnedBody = useMemo(() => formatBody(pinnedResponse), [pinnedResponse]);
  const currentBody = useMemo(() => formatBody(currentResponse), [currentResponse]);

  const diffLines = useMemo(
    () => computeLineDiff(pinnedBody, currentBody),
    [pinnedBody, currentBody],
  );

  const pinnedLines = useMemo(() => pinnedBody.split('\n'), [pinnedBody]);
  const currentLines = useMemo(() => currentBody.split('\n'), [currentBody]);

  // Compare headers
  const headerComparison = useMemo(() => {
    const pMap: Record<string, string> = {};
    if (Array.isArray(pinnedResponse.headers)) {
      pinnedResponse.headers.forEach(h => {
        pMap[h.name.toLowerCase()] = h.value;
      });
    }

    const cMap: Record<string, string> = {};
    if (Array.isArray(currentResponse.headers)) {
      currentResponse.headers.forEach(h => {
        cMap[h.name.toLowerCase()] = h.value;
      });
    }

    const allKeys = Array.from(new Set([...Object.keys(pMap), ...Object.keys(cMap)])).sort();

    return allKeys.map(key => {
      const pStr = pMap[key];
      const cStr = cMap[key];

      let status: 'unchanged' | 'changed' | 'added' | 'removed' = 'unchanged';
      if (pStr === undefined && cStr !== undefined) status = 'added';
      else if (pStr !== undefined && cStr === undefined) status = 'removed';
      else if (pStr !== cStr) status = 'changed';

      return { key, pStr, cStr, status };
    });
  }, [pinnedResponse, currentResponse]);

  if (!isOpen) return null;

  const timeDelta = currentResponse.totalMs - pinnedResponse.totalMs;
  const sizeDelta = (currentResponse.sizeBytes || 0) - (pinnedResponse.sizeBytes || 0);

  const statusChanged = pinnedResponse.status !== currentResponse.status;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Response Comparison" size="large">
      <div className="flex h-140 flex-col text-[12px] select-none">
        {/* Metric Overview Comparison Bar */}
        <div
          className="mb-3 grid grid-cols-3 gap-3 rounded-lg border p-3 text-[12px]"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border)',
          }}
        >
          {/* Status */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-(--text-muted)">Status Code</span>
            <div className="flex items-center gap-2">
              <span
                className={`font-mono font-semibold ${
                  pinnedResponse.status >= 200 && pinnedResponse.status < 300
                    ? 'text-emerald-500'
                    : 'text-amber-500'
                }`}
              >
                {pinnedResponse.status} {pinnedResponse.statusText}
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-(--text-muted)" />
              <span
                className={`font-mono font-semibold ${
                  currentResponse.status >= 200 && currentResponse.status < 300
                    ? 'text-emerald-500'
                    : 'text-rose-500'
                }`}
              >
                {currentResponse.status} {currentResponse.statusText}
              </span>
              {statusChanged && (
                <span className="py-0.2 rounded bg-rose-500/20 px-1.5 text-[10px] font-semibold text-rose-400">
                  Changed
                </span>
              )}
            </div>
          </div>

          {/* Response Time */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-(--text-muted)">Response Time</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-(--text-primary)">
                {formatDuration(pinnedResponse.totalMs)}
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-(--text-muted)" />
              <span className="font-mono font-medium text-(--text-primary)">
                {formatDuration(currentResponse.totalMs)}
              </span>
              <span
                className={`font-mono text-[10px] font-semibold ${
                  timeDelta > 0 ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                ({timeDelta >= 0 ? `+${timeDelta}` : timeDelta} ms)
              </span>
            </div>
          </div>

          {/* Size */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-(--text-muted)">Body Size</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-(--text-primary)">
                {formatBytes(pinnedResponse.sizeBytes || 0)}
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-(--text-muted)" />
              <span className="font-mono font-medium text-(--text-primary)">
                {formatBytes(currentResponse.sizeBytes || 0)}
              </span>
              <span
                className={`font-mono text-[10px] font-semibold ${
                  sizeDelta > 0 ? 'text-blue-400' : 'text-zinc-400'
                }`}
              >
                ({sizeDelta >= 0 ? `+${sizeDelta}` : sizeDelta} B)
              </span>
            </div>
          </div>
        </div>

        {/* Section Tabs and Controls */}
        <div
          className="mb-2 flex shrink-0 items-center justify-between border-b pb-2"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('body')}
              className={`transition-fast cursor-pointer rounded px-3 py-1 text-[12px] font-medium ${
                activeTab === 'body'
                  ? 'bg-(--accent) text-white'
                  : 'text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary)'
              }`}
            >
              Response Body Diff
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('headers')}
              className={`transition-fast cursor-pointer rounded px-3 py-1 text-[12px] font-medium ${
                activeTab === 'headers'
                  ? 'bg-(--accent) text-white'
                  : 'text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary)'
              }`}
            >
              Headers Comparison
            </button>
          </div>

          {activeTab === 'body' && (
            <div className="flex items-center gap-3">
              {/* View Mode Toggle */}
              <div
                className="flex items-center rounded border p-0.5"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  borderColor: 'var(--border)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setViewMode('unified')}
                  className={`transition-fast flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 text-[11px] ${
                    viewMode === 'unified'
                      ? 'bg-(--accent) text-white'
                      : 'text-(--text-secondary) hover:text-(--text-primary)'
                  }`}
                >
                  <Split className="h-3 w-3" />
                  <span>Unified</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('split')}
                  className={`transition-fast flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 text-[11px] ${
                    viewMode === 'split'
                      ? 'bg-(--accent) text-white'
                      : 'text-(--text-secondary) hover:text-(--text-primary)'
                  }`}
                >
                  <Columns className="h-3 w-3" />
                  <span>Side by Side</span>
                </button>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-2 text-[11px] text-(--text-muted)">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm border border-red-500/50 bg-red-500/30" />
                  Pinned
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm border border-emerald-500/50 bg-emerald-500/30" />
                  Current
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Tab 1: Body Diff */}
        {activeTab === 'body' && (
          <div
            className="flex-1 overflow-auto rounded border font-mono text-[12px]"
            style={{
              backgroundColor: 'var(--bg-base)',
              borderColor: 'var(--border)',
            }}
          >
            {viewMode === 'unified' ? (
              <div className="min-w-full">
                {diffLines.map((line, idx) => {
                  const isAdded = line.type === 'added';
                  const isRemoved = line.type === 'removed';

                  return (
                    <div
                      key={idx}
                      className="flex items-center px-2 font-mono leading-5 whitespace-pre"
                      style={{
                        backgroundColor: isAdded
                          ? 'rgba(34, 197, 94, 0.12)'
                          : isRemoved
                            ? 'rgba(239, 68, 68, 0.12)'
                            : 'transparent',
                        color: isAdded ? '#4ade80' : isRemoved ? '#f87171' : 'var(--text-primary)',
                      }}
                    >
                      <span
                        className="w-8 shrink-0 pr-2 text-right text-[10px] select-none"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {line.oldLineNumber ?? ''}
                      </span>
                      <span
                        className="w-8 shrink-0 pr-2 text-right text-[10px] select-none"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {line.newLineNumber ?? ''}
                      </span>
                      <span className="w-4 shrink-0 text-center font-bold select-none">
                        {isAdded ? '+' : isRemoved ? '-' : ' '}
                      </span>
                      <span className="flex-1 font-mono">{line.text || ' '}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Split View */
              <div className="flex min-w-full">
                {/* Left: Pinned */}
                <div
                  className="w-1/2 overflow-x-auto border-r"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div
                    className="sticky top-0 z-10 border-b px-2 py-1 font-sans text-[11px] font-semibold text-(--text-muted)"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    Pinned Response
                  </div>
                  {pinnedLines.map((line, idx) => (
                    <div key={idx} className="flex items-center px-2 leading-5 whitespace-pre">
                      <span
                        className="w-8 shrink-0 pr-2 text-right text-[10px] select-none"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {idx + 1}
                      </span>
                      <span className="flex-1">{line || ' '}</span>
                    </div>
                  ))}
                </div>

                {/* Right: Current */}
                <div className="w-1/2 overflow-x-auto">
                  <div
                    className="sticky top-0 z-10 border-b px-2 py-1 font-sans text-[11px] font-semibold text-(--text-muted)"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    Current Response
                  </div>
                  {currentLines.map((line, idx) => (
                    <div key={idx} className="flex items-center px-2 leading-5 whitespace-pre">
                      <span
                        className="w-8 shrink-0 pr-2 text-right text-[10px] select-none"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {idx + 1}
                      </span>
                      <span className="flex-1">{line || ' '}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Headers Diff */}
        {activeTab === 'headers' && (
          <div
            className="flex-1 overflow-auto rounded border text-[12px]"
            style={{
              backgroundColor: 'var(--bg-base)',
              borderColor: 'var(--border)',
            }}
          >
            <table className="w-full border-collapse">
              <thead>
                <tr
                  className="border-b text-left text-[11px] font-semibold text-(--text-secondary)"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <th className="px-3 py-2">Header Name</th>
                  <th className="px-3 py-2">Pinned Value</th>
                  <th className="px-3 py-2">Current Value</th>
                  <th className="px-3 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {headerComparison.map((row, idx) => {
                  let badge = (
                    <span className="rounded bg-zinc-500/20 px-1.5 py-0.5 text-[10px] text-(--text-muted)">
                      Unchanged
                    </span>
                  );
                  if (row.status === 'changed') {
                    badge = (
                      <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                        Modified
                      </span>
                    );
                  } else if (row.status === 'added') {
                    badge = (
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                        + Added
                      </span>
                    );
                  } else if (row.status === 'removed') {
                    badge = (
                      <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-400">
                        - Removed
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={idx}
                      className="transition-fast hover:bg-(--bg-hover)"
                      style={{
                        backgroundColor:
                          row.status === 'changed'
                            ? 'rgba(245, 158, 11, 0.06)'
                            : row.status === 'added'
                              ? 'rgba(34, 197, 94, 0.06)'
                              : row.status === 'removed'
                                ? 'rgba(239, 68, 68, 0.06)'
                                : 'transparent',
                      }}
                    >
                      <td className="px-3 py-2 font-mono font-medium text-(--text-primary)">
                        {row.key}
                      </td>
                      <td className="px-3 py-2 font-mono text-(--text-secondary)">
                        {row.pStr ?? <em className="text-(--text-muted)">(none)</em>}
                      </td>
                      <td className="px-3 py-2 font-mono text-(--text-primary)">
                        {row.cStr ?? <em className="text-(--text-muted)">(none)</em>}
                      </td>
                      <td className="px-3 py-2 text-right">{badge}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
