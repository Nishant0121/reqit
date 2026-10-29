import React, { useState } from 'react';
import { FileDiff, Split, Columns, Check, ArrowDownToLine } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { computeLineDiff } from '../lib/diff';

export interface DiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestName: string;
  filePath?: string;
  diskContent: string;
  localContent: string;
  onKeepMine: () => void;
  onLoadDisk: () => void;
}

export function DiffModal({
  isOpen,
  onClose,
  requestName,
  filePath,
  diskContent,
  localContent,
  onKeepMine,
  onLoadDisk,
}: DiffModalProps): React.JSX.Element | null {
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');

  if (!isOpen) return null;

  const diffLines = computeLineDiff(diskContent, localContent);
  const diskLines = diskContent.split('\n');
  const localLines = localContent.split('\n');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Diff: ${requestName}`} size="large">
      <div className="flex h-130 flex-col text-[12px] select-none">
        {/* Header bar: Path, Mode Switcher, and Legends */}
        <div
          className="mb-2 flex shrink-0 items-center justify-between border-b pb-3"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="mr-3 flex items-center gap-2 overflow-hidden">
            <FileDiff className="h-4 w-4 shrink-0 text-(--accent)" />
            <span
              className="truncate font-mono text-[11px] text-(--text-secondary)"
              title={filePath}
            >
              {filePath || requestName}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-3">
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
                className={`transition-fast flex items-center gap-1 rounded px-2 py-0.5 text-[11px] ${
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
                className={`transition-fast flex items-center gap-1 rounded px-2 py-0.5 text-[11px] ${
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
                Disk (Deleted/Replaced)
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm border border-emerald-500/50 bg-emerald-500/30" />
                Your Edits (Added/New)
              </span>
            </div>
          </div>
        </div>

        {/* Diff Content Area */}
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
                    {/* Old line number */}
                    <span
                      className="w-8 shrink-0 pr-2 text-right text-[10px] select-none"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {line.oldLineNumber ?? ''}
                    </span>
                    {/* New line number */}
                    <span
                      className="w-8 shrink-0 pr-2 text-right text-[10px] select-none"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {line.newLineNumber ?? ''}
                    </span>
                    {/* Marker +/- */}
                    <span className="w-4 shrink-0 text-center font-bold select-none">
                      {isAdded ? '+' : isRemoved ? '-' : ' '}
                    </span>
                    {/* Line text */}
                    <span className="flex-1 font-mono">{line.text || ' '}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              className="flex h-full min-w-full divide-x"
              style={{ borderColor: 'var(--border)' }}
            >
              {/* Left Column: Disk Version */}
              <div className="flex w-1/2 min-w-0 flex-col overflow-auto">
                <div
                  className="shrink-0 border-b bg-(--bg-surface) px-2 py-1 text-[11px] font-medium text-(--text-secondary)"
                  style={{ borderColor: 'var(--border)' }}
                >
                  Disk Version (Remote / External)
                </div>
                <div className="flex-1 overflow-auto p-2">
                  {diskLines.map((text, idx) => (
                    <div key={idx} className="flex text-[11px] leading-4.5 whitespace-pre">
                      <span className="w-6 shrink-0 pr-2 text-right text-(--text-muted) select-none">
                        {idx + 1}
                      </span>
                      <span className="flex-1 text-(--text-primary)">{text || ' '}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Your Version */}
              <div className="flex w-1/2 min-w-0 flex-col overflow-auto">
                <div
                  className="shrink-0 border-b bg-(--bg-surface) px-2 py-1 text-[11px] font-medium text-(--text-secondary)"
                  style={{ borderColor: 'var(--border)' }}
                >
                  Your Version (Unsaved Local Edits)
                </div>
                <div className="flex-1 overflow-auto p-2">
                  {localLines.map((text, idx) => (
                    <div key={idx} className="flex text-[11px] leading-4.5 whitespace-pre">
                      <span className="w-6 shrink-0 pr-2 text-right text-(--text-muted) select-none">
                        {idx + 1}
                      </span>
                      <span className="flex-1 text-(--text-primary)">{text || ' '}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div
          className="mt-3 flex shrink-0 items-center justify-between border-t pt-3"
          style={{ borderColor: 'var(--border)' }}
        >
          <Button variant="ghost" size="compact" onClick={onClose}>
            Close
          </Button>

          <div className="flex items-center gap-2">
            <Button
              id="diff-modal-load-disk-btn"
              variant="secondary"
              size="compact"
              onClick={() => {
                onLoadDisk();
                onClose();
              }}
              className="flex items-center gap-1"
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
              <span>Load Disk Version</span>
            </Button>
            <Button
              id="diff-modal-keep-mine-btn"
              variant="primary"
              size="compact"
              onClick={() => {
                onKeepMine();
                onClose();
              }}
              className="flex items-center gap-1"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Keep My Edits</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
