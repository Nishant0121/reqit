import React, { useState } from 'react';
import { Search, X, Plus } from 'lucide-react';
import type { HttpMethod } from '@reqit/core';
import { MethodBadge } from './ui/Badge';
import { Button } from './ui/Button';
import { strings } from '../lib/strings';

export interface RequestItem {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
}

export interface SidebarProps {
  width: number;
  onWidthChange: (w: number) => void;
  requests: RequestItem[];
  activeRequestId: string;
  onSelectRequest: (id: string) => void;
  onNewRequest: () => void;
}

export function Sidebar({
  width,
  onWidthChange,
  requests,
  activeRequestId,
  onSelectRequest,
  onNewRequest,
}: SidebarProps): React.JSX.Element {
  const [filterText, setFilterText] = useState('');
  const [activeTab, setActiveTab] = useState<'collections' | 'history'>('collections');

  const filteredRequests = requests.filter(r => {
    if (!filterText.trim()) return true;
    const query = filterText.toLowerCase();
    return r.name.toLowerCase().includes(query) || r.url.toLowerCase().includes(query);
  });

  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(220, Math.min(480, startWidth + (moveEvent.clientX - startX)));
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <aside
      className="relative flex flex-col h-full border-r select-none shrink-0"
      style={{
        width: `${width}px`,
        backgroundColor: 'var(--bg-subtle)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Sidebar Navigation Tabs */}
      <div
        className="flex items-center justify-between px-3 h-[36px] border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-4 text-[13px] font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('collections')}
            className="pb-1 transition-fast app-focus-ring"
            style={{
              color: activeTab === 'collections' ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom:
                activeTab === 'collections' ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            {strings.sidebar.collectionsTab}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className="pb-1 transition-fast app-focus-ring"
            style={{
              color: activeTab === 'history' ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom:
                activeTab === 'history' ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            {strings.sidebar.historyTab}
          </button>
        </div>

        <Button
          variant="ghost"
          size="compact"
          onClick={onNewRequest}
          title={strings.sidebar.newRequest}
          aria-label={strings.sidebar.newRequest}
          className="w-6 h-6 p-0"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
        </Button>
      </div>

      {/* Filter Bar with Count and Clear Button */}
      <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <div
          className="relative flex items-center h-[28px] rounded-[4px] border px-2 text-[12px]"
          style={{
            backgroundColor: 'var(--bg-base)',
            borderColor: 'var(--border-strong)',
          }}
        >
          <Search
            className="w-3.5 h-3.5 mr-1.5 shrink-0"
            style={{ color: 'var(--text-muted)' }}
            strokeWidth={1.5}
          />
          <input
            type="text"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            placeholder={strings.sidebar.filterPlaceholder}
            className="w-full bg-transparent outline-none app-focus-ring text-[12px]"
            style={{ color: 'var(--text-primary)' }}
            aria-label={strings.sidebar.filterRequests}
          />
          {filterText && (
            <button
              type="button"
              onClick={() => setFilterText('')}
              className="p-0.5 rounded-[2px] hover:bg-[var(--bg-muted)] transition-fast"
              style={{ color: 'var(--text-muted)' }}
              title={strings.sidebar.clearFilter}
              aria-label={strings.sidebar.clearFilter}
            >
              <X className="w-3 h-3" strokeWidth={1.5} />
            </button>
          )}
        </div>
        {filterText && (
          <div
            className="flex items-center justify-between mt-1 px-1 text-[11px]"
            style={{ color: 'var(--text-muted)' }}
          >
            <span>{strings.sidebar.filterCount(filteredRequests.length, requests.length)}</span>
            <button
              type="button"
              onClick={() => setFilterText('')}
              className="underline hover:text-[var(--text-primary)] transition-fast"
            >
              {strings.sidebar.clearFilter}
            </button>
          </div>
        )}
      </div>

      {/* Requests Tree / List */}
      <div className="flex-1 overflow-y-auto py-1">
        {filteredRequests.length === 0 ? (
          <div className="p-4 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>
            {filterText ? strings.sidebar.noRequestsMatch : strings.sidebar.noRequestsYet}
          </div>
        ) : (
          <div role="tree" aria-label="Requests">
            {filteredRequests.map(req => {
              const isSelected = req.id === activeRequestId;
              return (
                <div
                  key={req.id}
                  role="treeitem"
                  aria-selected={isSelected}
                  tabIndex={0}
                  onClick={() => onSelectRequest(req.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onSelectRequest(req.id);
                    }
                  }}
                  className="flex items-center h-[28px] px-3 cursor-pointer text-[13px] transition-fast app-focus-ring relative"
                  style={{
                    backgroundColor: isSelected ? 'var(--accent-subtle)' : 'transparent',
                    borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-muted)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <MethodBadge method={req.method} short />
                  <span
                    className="truncate ml-1.5 flex-1"
                    style={{
                      color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: isSelected ? 500 : 400,
                    }}
                    title={req.name}
                  >
                    {req.name}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Drag handle for resizing */}
      <div
        onMouseDown={handleMouseDownResize}
        className="absolute top-0 right-0 w-[4px] h-full cursor-col-resize hover:bg-[var(--accent)] transition-fast z-10"
        title="Resize sidebar"
        aria-hidden="true"
      />
    </aside>
  );
}
