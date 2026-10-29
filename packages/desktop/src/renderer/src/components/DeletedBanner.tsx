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
      className="flex items-center justify-between px-3 py-1.5 border-b text-[12px] select-none transition-fast shrink-0"
      style={{
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderColor: 'rgba(239, 68, 68, 0.3)',
        color: 'var(--text-primary)',
      }}
    >
      <div className="flex items-center gap-2 overflow-hidden mr-3">
        <Trash2 className="w-4 h-4 text-red-500 shrink-0" />
        <span className="font-medium text-red-500 shrink-0">File deleted on disk:</span>
        <span className="text-[var(--text-secondary)] truncate" title={filePath}>
          This request was removed outside Reqit. You can save to recreate it, or close this tab.
        </span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          id="deleted-recreate-btn"
          variant="primary"
          size="compact"
          onClick={onRecreate}
          title="Save draft back to disk to recreate file"
          className="h-[24px] px-2 text-[11px] flex items-center gap-1"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Re-create file</span>
        </Button>
        <Button
          id="deleted-close-tab-btn"
          variant="secondary"
          size="compact"
          onClick={onCloseTab}
          title="Close this tab"
          className="h-[24px] px-2 text-[11px] flex items-center gap-1"
        >
          <X className="w-3.5 h-3.5" />
          <span>Close tab</span>
        </Button>
      </div>
    </div>
  );
}
