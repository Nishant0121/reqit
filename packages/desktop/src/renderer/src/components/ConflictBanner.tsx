import React from 'react';
import { AlertTriangle, FileDiff, ArrowDownToLine, Check } from 'lucide-react';
import { Button } from './ui/Button';

export interface ConflictBannerProps {
  onKeepMine: () => void;
  onLoadDisk: () => void;
  onViewDiff: () => void;
}

export function ConflictBanner({
  onKeepMine,
  onLoadDisk,
  onViewDiff,
}: ConflictBannerProps): React.JSX.Element {
  return (
    <div
      role="alert"
      id="conflict-banner"
      className="flex items-center justify-between px-3 py-1.5 border-b text-[12px] select-none transition-fast shrink-0"
      style={{
        backgroundColor: 'rgba(234, 179, 8, 0.1)',
        borderColor: 'rgba(234, 179, 8, 0.3)',
        color: 'var(--text-primary)',
      }}
    >
      <div className="flex items-center gap-2 overflow-hidden mr-3">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
        <span className="font-medium text-amber-500 shrink-0">Conflict detected:</span>
        <span className="text-[var(--text-secondary)] truncate">
          This file was changed on disk, but you have unsaved edits in Reqit.
        </span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          id="conflict-view-diff-btn"
          variant="secondary"
          size="compact"
          onClick={onViewDiff}
          title="View side-by-side differences"
          className="h-[24px] px-2 text-[11px] flex items-center gap-1"
        >
          <FileDiff className="w-3.5 h-3.5" />
          <span>View diff</span>
        </Button>
        <Button
          id="conflict-load-disk-btn"
          variant="secondary"
          size="compact"
          onClick={onLoadDisk}
          title="Discard local edits and load version from disk"
          className="h-[24px] px-2 text-[11px] flex items-center gap-1"
        >
          <ArrowDownToLine className="w-3.5 h-3.5" />
          <span>Load disk version</span>
        </Button>
        <Button
          id="conflict-keep-mine-btn"
          variant="primary"
          size="compact"
          onClick={onKeepMine}
          title="Keep local edits and dismiss conflict"
          className="h-[24px] px-2 text-[11px] flex items-center gap-1"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Keep mine</span>
        </Button>
      </div>
    </div>
  );
}
