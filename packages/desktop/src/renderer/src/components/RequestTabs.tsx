import React from 'react';
import { Plus, X, AlertTriangle, Trash2 } from 'lucide-react';
import type { HttpMethod } from '@reqit/core';
import { MethodBadge } from './ui/Badge';
import { strings } from '../lib/strings';

export interface TabItemData {
  id: string;
  name: string;
  method: HttpMethod;
  isDirty?: boolean;
  hasConflict?: boolean;
  isDeleted?: boolean;
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
      className="flex h-8 shrink-0 items-center overflow-x-auto border-b select-none"
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
            className="group transition-fast app-focus-ring relative flex h-full cursor-pointer items-center px-3 text-[12px]"
            style={{
              backgroundColor: isActive ? 'var(--bg-base)' : 'transparent',
              borderRight: '1px solid var(--border)',
              borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              maxWidth: '180px',
            }}
          >
            <MethodBadge method={tab.method} short className="mr-1.5 w-auto" />
            <span className="flex-1 truncate" title={tab.name}>
              {tab.name}
            </span>

            {/* Conflict or Deleted or Unsaved indicator */}
            {tab.hasConflict ? (
              <span title="External conflict detected" className="ml-1.5 shrink-0">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
              </span>
            ) : tab.isDeleted ? (
              <span title="File deleted on disk" className="ml-1.5 shrink-0">
                <Trash2 className="h-3 w-3 text-red-500" />
              </span>
            ) : tab.isDirty ? (
              <span
                className="ml-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: 'var(--warning)' }}
                title={strings.tabs.unsavedChanges}
              />
            ) : null}

            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
              className="transition-fast ml-1.5 shrink-0 rounded-xs p-0.5 opacity-0 group-hover:opacity-100 hover:bg-(--bg-hover)"
              style={{ color: 'var(--text-muted)' }}
              title={strings.tabs.closeTab}
              aria-label={strings.tabs.closeTab}
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </div>
        );
      })}

      {/* New tab button */}
      <button
        type="button"
        onClick={onNewTab}
        className="transition-fast app-focus-ring flex h-full w-8 items-center justify-center hover:bg-(--bg-hover)"
        style={{ color: 'var(--text-muted)' }}
        title={strings.tabs.newTab}
        aria-label={strings.tabs.newTab}
      >
        <Plus className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}
