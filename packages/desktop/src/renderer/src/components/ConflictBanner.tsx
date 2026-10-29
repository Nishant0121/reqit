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
      className="transition-fast flex shrink-0 items-center justify-between border-b px-3 py-1.5 text-[12px] select-none"
      style={{
        backgroundColor: 'rgba(234, 179, 8, 0.1)',
        borderColor: 'rgba(234, 179, 8, 0.3)',
        color: 'var(--text-primary)',
      }}
    >
      <div className="mr-3 flex items-center gap-2 overflow-hidden">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
        <span className="shrink-0 font-medium text-amber-500">Conflict detected:</span>
        <span className="truncate text-(--text-secondary)">
          This file was changed on disk, but you have unsaved edits in Reqit.
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          id="conflict-view-diff-btn"
          variant="secondary"
          size="compact"
          onClick={onViewDiff}
          title="View side-by-side differences"
          className="flex h-6 items-center gap-1 px-2 text-[11px]"
        >
          <FileDiff className="h-3.5 w-3.5" />
          <span>View diff</span>
        </Button>
        <Button
          id="conflict-load-disk-btn"
          variant="secondary"
          size="compact"
          onClick={onLoadDisk}
          title="Discard local edits and load version from disk"
          className="flex h-6 items-center gap-1 px-2 text-[11px]"
        >
          <ArrowDownToLine className="h-3.5 w-3.5" />
          <span>Load disk version</span>
        </Button>
        <Button
          id="conflict-keep-mine-btn"
          variant="primary"
          size="compact"
          onClick={onKeepMine}
          title="Keep local edits and dismiss conflict"
          className="flex h-6 items-center gap-1 px-2 text-[11px]"
        >
          <Check className="h-3.5 w-3.5" />
          <span>Keep mine</span>
        </Button>
      </div>
    </div>
  );
}
