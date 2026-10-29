import React, { useEffect } from 'react';
import { Search, X, Trash2, Settings, AlertCircle, Clock } from 'lucide-react';
import { useHistoryStore } from '../stores/historyStore';
import { MethodBadge, StatusBadge } from './ui/Badge';
import { Button } from './ui/Button';
import { groupEntriesByDay, formatHistoryTime, formatDuration } from '../lib/history-utils';
import type { HistoryStatusFilter, HistoryEntrySummary } from '../../../shared/ipc-types';

const STATUS_FILTERS: Array<{ id: HistoryStatusFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: '2xx', label: '2xx' },
  { id: '4xx', label: '4xx' },
  { id: '5xx', label: '5xx' },
  { id: 'error', label: 'Errors' },
];

export function SidebarHistory(): React.JSX.Element {
  const {
    entries,
    total,
    isLoading,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    selectEntry,
    deleteEntry,
    setIsConfirmClearOpen,
    setIsSettingsOpen,
    settings,
    loadEntries,
    loadSettings,
  } = useHistoryStore();

  useEffect(() => {
    loadSettings();
    loadEntries();
  }, [loadSettings, loadEntries]);

  const grouped = groupEntriesByDay(entries);

  return (
    <div className="flex h-full flex-col overflow-hidden select-none">
      {/* Top search & actions header */}
      <div
        className="flex shrink-0 flex-col gap-2 border-b p-2"
        style={{ borderColor: 'var(--border)' }}
      >
        {/* Search input with Settings and Clear buttons */}
        <div className="flex items-center gap-1">
          <div
            className="relative flex h-7 flex-1 items-center rounded-sm border px-2 text-[12px]"
            style={{
              backgroundColor: 'var(--bg-input)',
              borderColor: 'var(--border-strong)',
            }}
          >
            <Search
              className="mr-1.5 h-3.5 w-3.5 shrink-0"
              style={{ color: 'var(--text-muted)' }}
              strokeWidth={1.75}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search history..."
              className="app-focus-ring w-full bg-transparent text-[12px] outline-none"
              style={{ color: 'var(--text-primary)' }}
              aria-label="Search history"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="transition-fast rounded-xs p-0.5 hover:bg-(--bg-hover)"
                style={{ color: 'var(--text-muted)' }}
                title="Clear search"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" strokeWidth={1.75} />
              </button>
            )}
          </div>

          {/* Settings button */}
          <Button
            variant="ghost"
            size="compact"
            onClick={() => setIsSettingsOpen(true)}
            className="flex h-7 w-7 items-center justify-center p-0 text-(--text-secondary) hover:text-(--text-primary)"
            title="History Settings"
            aria-label="History Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>

          {/* Clear history button */}
          <Button
            variant="ghost"
            size="compact"
            onClick={() => setIsConfirmClearOpen(true)}
            disabled={total === 0}
            className="flex h-7 w-7 items-center justify-center p-0 text-(--text-secondary) hover:text-(--status-err) disabled:opacity-30"
            title="Clear All History"
            aria-label="Clear All History"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Status filter pills */}
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto py-0.5">
          {STATUS_FILTERS.map(f => {
            const isActive = statusFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`transition-fast shrink-0 rounded px-2 py-0.5 text-[11px] font-medium ${
                  isActive
                    ? 'bg-(--accent) text-white'
                    : 'bg-(--bg-secondary) text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary)'
                }`}
              >
                {f.label}
              </button>
            );
          })}
          <div className="ml-auto shrink-0 px-1 font-mono text-[11px] text-(--text-muted)">
            {total}
          </div>
        </div>
      </div>

      {/* Disabled warning banner */}
      {!settings.enabled && (
        <div
          className="flex items-center justify-between border-b px-3 py-2 text-[11px]"
          style={{
            backgroundColor: 'var(--status-err-bg)',
            borderColor: 'var(--border)',
            color: 'var(--status-err)',
          }}
        >
          <div className="flex items-center gap-1.5 overflow-hidden">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">History recording is paused</span>
          </div>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="ml-2 shrink-0 font-semibold underline hover:opacity-80"
          >
            Settings
          </button>
        </div>
      )}

      {/* History entries list grouped by day */}
      <div className="flex-1 overflow-y-auto py-1">
        {isLoading && entries.length === 0 ? (
          <div className="p-6 text-center text-[12px] text-(--text-muted)">Loading history...</div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-[12px] text-(--text-muted)">
            <Clock className="mb-1 h-8 w-8 opacity-40" />
            {searchQuery || statusFilter !== 'all' ? (
              <>
                <span>No requests match your history filter.</span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                  className="mt-1 text-(--accent) hover:underline"
                >
                  Clear filter
                </button>
              </>
            ) : (
              <span>No requests sent yet. Executed requests will appear here.</span>
            )}
          </div>
        ) : (
          <div className="flex flex-col">
            {grouped.map(group => (
              <div key={group.day} className="flex flex-col">
                {/* Day Header */}
                <div
                  className="sticky top-0 z-10 flex items-center justify-between px-3 py-1 text-[11px] font-semibold tracking-wider uppercase"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-muted)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <span>{group.day}</span>
                  <span className="text-[10px] font-normal">{group.entries.length}</span>
                </div>

                {/* Day Entries */}
                {group.entries.map(entry => (
                  <HistoryItemRow
                    key={entry.id}
                    entry={entry}
                    onSelect={() => selectEntry(entry.id)}
                    onDelete={e => {
                      e.stopPropagation();
                      deleteEntry(entry.id);
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface HistoryItemRowProps {
  entry: HistoryEntrySummary;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function HistoryItemRow({ entry, onSelect, onDelete }: HistoryItemRowProps): React.JSX.Element {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={e => {
        if (e.key === 'Enter') onSelect();
      }}
      className="group transition-fast app-focus-ring relative flex cursor-pointer flex-col gap-1 border-b border-(--border) px-3 py-2 text-left select-none last:border-b-0 hover:bg-(--bg-hover)"
    >
      {/* Top line: Method badge, request name / url, status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
          <MethodBadge method={entry.method} />
          <span
            className="truncate text-[12px] font-medium text-(--text-primary)"
            title={entry.requestName}
          >
            {entry.requestName}
          </span>
        </div>

        {/* Status code badge */}
        <div className="shrink-0">
          {entry.status ? (
            <StatusBadge status={entry.status} />
          ) : (
            <span className="py-0.2 rounded bg-(--status-err-bg) px-1.5 text-[10px] font-semibold text-(--status-err)">
              ERR
            </span>
          )}
        </div>
      </div>

      {/* URL sub-line */}
      <div className="truncate font-mono text-[11px] text-(--text-muted)" title={entry.url}>
        {entry.url}
      </div>

      {/* Bottom metadata: time, duration, and hover delete button */}
      <div className="mt-0.5 flex items-center justify-between text-[10px] text-(--text-muted)">
        <div className="flex items-center gap-2">
          <span>{formatHistoryTime(entry.timestamp)}</span>
          {entry.durationMs !== undefined && <span>• {formatDuration(entry.durationMs)}</span>}
        </div>

        {/* Delete hover button */}
        <button
          type="button"
          onClick={onDelete}
          className="transition-fast rounded p-0.5 text-(--text-muted) opacity-0 group-hover:opacity-100 hover:bg-(--bg-secondary) hover:text-(--status-err)"
          title="Delete entry"
          aria-label="Delete entry"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
