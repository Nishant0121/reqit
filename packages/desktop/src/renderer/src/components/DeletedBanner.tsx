import React from 'react';
import { Trash2, RotateCcw, X } from 'lucide-react';
import { Button } from './ui/Button';

export interface DeletedBannerProps {
  filePath?: string;
  onRecreate: () => void;
  onCloseTab: () => void;
}

export function DeletedBanner({
  filePath,
  onRecreate,
  onCloseTab,
}: DeletedBannerProps): React.JSX.Element {
  return (
    <div
      role="alert"
      id="deleted-banner"
      className="transition-fast flex shrink-0 items-center justify-between border-b px-3 py-1.5 text-[12px] select-none"
      style={{
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderColor: 'rgba(239, 68, 68, 0.3)',
        color: 'var(--text-primary)',
      }}
    >
      <div className="mr-3 flex items-center gap-2 overflow-hidden">
        <Trash2 className="h-4 w-4 shrink-0 text-red-500" />
        <span className="shrink-0 font-medium text-red-500">File deleted on disk:</span>
        <span className="truncate text-(--text-secondary)" title={filePath}>
          This request was removed outside Reqit. You can save to recreate it, or close this tab.
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          id="deleted-recreate-btn"
          variant="primary"
          size="compact"
          onClick={onRecreate}
          title="Save draft back to disk to recreate file"
          className="flex h-6 items-center gap-1 px-2 text-[11px]"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Re-create file</span>
        </Button>
        <Button
          id="deleted-close-tab-btn"
          variant="secondary"
          size="compact"
          onClick={onCloseTab}
          title="Close this tab"
          className="flex h-6 items-center gap-1 px-2 text-[11px]"
        >
          <X className="h-3.5 w-3.5" />
          <span>Close tab</span>
        </Button>
      </div>
    </div>
  );
}
