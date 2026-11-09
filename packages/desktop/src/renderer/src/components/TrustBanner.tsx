import React from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

export interface TrustBannerProps {
  onTrust: () => void;
  onDismiss?: () => void;
}

export function TrustBanner({ onTrust, onDismiss }: TrustBannerProps): React.JSX.Element {
  return (
    <div
      role="alert"
      className="flex items-center justify-between border-b px-3 py-2 text-[12px]"
      style={{
        backgroundColor: 'rgba(234, 179, 8, 0.1)',
        borderColor: 'rgba(234, 179, 8, 0.3)',
        color: 'var(--text-primary)',
      }}
    >
      <div className="flex items-center gap-2 overflow-hidden">
        <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
        <span className="truncate">
          <strong className="font-medium text-amber-500">Workspace Untrusted:</strong> Pre-request
          and post-response scripts are disabled in this collection for security.
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onTrust}
          className="flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[11px] font-medium transition-colors"
          style={{
            backgroundColor: 'var(--accent)',
            color: 'var(--accent-fg)',
          }}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Trust Collection
        </button>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-sm px-2 py-1 text-[11px] hover:bg-black/10 dark:hover:bg-white/10"
            style={{ color: 'var(--text-secondary)' }}
          >
            Keep Disabled
          </button>
        )}
      </div>
    </div>
  );
}
