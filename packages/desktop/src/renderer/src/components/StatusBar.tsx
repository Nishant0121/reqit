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
      className="h-[24px] px-3 flex items-center justify-between border-t text-[11px] leading-[16px] select-none shrink-0"
      style={{
        backgroundColor: 'var(--bg-subtle)',
        borderColor: 'var(--border)',
        color: 'var(--text-muted)',
      }}
    >
      {/* Left: Branch and Environment */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-fast cursor-default">
          <GitBranch className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span>{branch}</span>
        </div>

        <div className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-fast cursor-default">
          <Globe className="w-3.5 h-3.5" strokeWidth={1.5} />
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
