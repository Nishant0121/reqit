import React from 'react';
import { CountBadge } from './Badge';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ items, activeId, onChange, className = '' }: TabsProps): React.JSX.Element {
  return (
    <div
      role="tablist"
      className={`flex items-center gap-1 border-b select-none ${className}`}
      style={{ borderColor: 'var(--border)' }}
    >
      {items.map(tab => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className="transition-fast app-focus-ring relative flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium"
            style={{
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && <CountBadge count={tab.count} />}
          </button>
        );
      })}
    </div>
  );
}
