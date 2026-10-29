import React from 'react';
import { GitBranch, Globe } from 'lucide-react';
import { strings } from '../lib/strings';

export interface StatusBarProps {
  branch?: string;
  environmentName?: string;
  historyCount: number;
  version: string;
}

export function StatusBar({
  branch = 'master',
  environmentName = strings.topBar.noEnvironment,
  historyCount,
  version,
}: StatusBarProps): React.JSX.Element {
  return (
    <footer
      className="flex h-6 shrink-0 items-center justify-between border-t px-3 text-[11px] leading-4 select-none"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border)',
        color: 'var(--text-muted)',
      }}
    >
      {/* Left: Branch and Environment */}
      <div className="flex items-center gap-4">
        <div className="transition-fast flex cursor-default items-center gap-1.5 hover:text-(--text-primary)">
          <GitBranch className="h-4 w-4" strokeWidth={1.75} />
          <span>{branch}</span>
        </div>

        <div className="transition-fast flex cursor-default items-center gap-1.5 hover:text-(--text-primary)">
          <Globe className="h-4 w-4" strokeWidth={1.75} />
          <span>{environmentName}</span>
        </div>
      </div>

      {/* Right: History count and version */}
      <div className="flex items-center gap-4">
        <span>{strings.sidebar.historyCount(historyCount)}</span>
        <span>v{version || '0.1.0'}</span>
      </div>
    </footer>
  );
}
