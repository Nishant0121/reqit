import React from 'react';
import { Plus, X } from 'lucide-react';
import type { HttpMethod } from '@reqit/core';
import { MethodBadge } from './ui/Badge';
import { strings } from '../lib/strings';

export interface TabItemData {
  id: string;
  name: string;
  method: HttpMethod;
  isDirty?: boolean;
}

export interface RequestTabsProps {
  tabs: TabItemData[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
}

export function RequestTabs({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
}: RequestTabsProps): React.JSX.Element {
  return (
    <div
      role="tablist"
      aria-label="Request tabs"
      className="flex items-center h-[32px] border-b select-none overflow-x-auto shrink-0"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border)',
      }}
    >
      {tabs.map(tab => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelectTab(tab.id)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                onSelectTab(tab.id);
              }
            }}
            className="group flex items-center h-full px-3 text-[12px] cursor-pointer transition-fast app-focus-ring relative"
            style={{
              backgroundColor: isActive ? 'var(--bg-base)' : 'transparent',
              borderRight: '1px solid var(--border)',
              borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              maxWidth: '180px',
            }}
          >
            <MethodBadge method={tab.method} short className="w-auto mr-1.5" />
            <span className="truncate flex-1" title={tab.name}>
              {tab.name}
            </span>

            {/* Unsaved indicator or close button */}
            {tab.isDirty && (
              <span
                className="w-1.5 h-1.5 rounded-full ml-1.5 shrink-0"
                style={{ backgroundColor: 'var(--warning)' }}
                title={strings.tabs.unsavedChanges}
              />
            )}

            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
              className="ml-1.5 p-0.5 rounded-[2px] opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-hover)] transition-fast shrink-0"
              style={{ color: 'var(--text-muted)' }}
              title={strings.tabs.closeTab}
              aria-label={strings.tabs.closeTab}
            >
              <X className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          </div>
        );
      })}

      {/* New tab button */}
      <button
        type="button"
        onClick={onNewTab}
        className="flex items-center justify-center w-[32px] h-full hover:bg-[var(--bg-hover)] transition-fast app-focus-ring"
        style={{ color: 'var(--text-muted)' }}
        title={strings.tabs.newTab}
        aria-label={strings.tabs.newTab}
      >
        <Plus className="w-4 h-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}
