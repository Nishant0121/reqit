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
      <div className="flex flex-col h-[520px] select-none text-[12px]">
        {/* Header bar: Path, Mode Switcher, and Legends */}
        <div
          className="flex items-center justify-between pb-3 mb-2 border-b shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2 overflow-hidden mr-3">
            <FileDiff className="w-4 h-4 text-[var(--accent)] shrink-0" />
            <span
              className="text-[var(--text-secondary)] font-mono text-[11px] truncate"
              title={filePath}
            >
              {filePath || requestName}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
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
                className={`px-2 py-0.5 text-[11px] rounded transition-fast flex items-center gap-1 ${
                  viewMode === 'unified'
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Split className="w-3 h-3" />
                <span>Unified</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`px-2 py-0.5 text-[11px] rounded transition-fast flex items-center gap-1 ${
                  viewMode === 'split'
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Columns className="w-3 h-3" />
                <span>Side by Side</span>
              </button>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-500/30 border border-red-500/50" />
                Disk (Deleted/Replaced)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/30 border border-emerald-500/50" />
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
                    className="flex items-center leading-[20px] px-2 font-mono whitespace-pre"
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
                      className="w-8 shrink-0 text-right pr-2 select-none text-[10px]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {line.oldLineNumber ?? ''}
                    </span>
                    {/* New line number */}
                    <span
                      className="w-8 shrink-0 text-right pr-2 select-none text-[10px]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {line.newLineNumber ?? ''}
                    </span>
                    {/* Marker +/- */}
                    <span className="w-4 shrink-0 text-center select-none font-bold">
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
              <div className="w-1/2 flex flex-col min-w-0 overflow-auto">
                <div
                  className="px-2 py-1 text-[11px] font-medium border-b shrink-0 bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                  style={{ borderColor: 'var(--border)' }}
                >
                  Disk Version (Remote / External)
                </div>
                <div className="flex-1 overflow-auto p-2">
                  {diskLines.map((text, idx) => (
                    <div key={idx} className="flex leading-[18px] text-[11px] whitespace-pre">
                      <span className="w-6 shrink-0 text-right pr-2 text-[var(--text-muted)] select-none">
                        {idx + 1}
                      </span>
                      <span className="flex-1 text-[var(--text-primary)]">{text || ' '}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Your Version */}
              <div className="w-1/2 flex flex-col min-w-0 overflow-auto">
                <div
                  className="px-2 py-1 text-[11px] font-medium border-b shrink-0 bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                  style={{ borderColor: 'var(--border)' }}
                >
                  Your Version (Unsaved Local Edits)
                </div>
                <div className="flex-1 overflow-auto p-2">
                  {localLines.map((text, idx) => (
                    <div key={idx} className="flex leading-[18px] text-[11px] whitespace-pre">
                      <span className="w-6 shrink-0 text-right pr-2 text-[var(--text-muted)] select-none">
                        {idx + 1}
                      </span>
                      <span className="flex-1 text-[var(--text-primary)]">{text || ' '}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div
          className="flex items-center justify-between pt-3 mt-3 border-t shrink-0"
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
              <ArrowDownToLine className="w-3.5 h-3.5" />
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
              <Check className="w-3.5 h-3.5" />
              <span>Keep My Edits</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
