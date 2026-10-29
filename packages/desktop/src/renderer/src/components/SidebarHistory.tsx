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
    <div className="flex flex-col h-full overflow-hidden select-none">
      {/* Top search & actions header */}
      <div
        className="p-2 border-b flex flex-col gap-2 shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        {/* Search input with Settings and Clear buttons */}
        <div className="flex items-center gap-1">
          <div
            className="flex-1 relative flex items-center h-[28px] rounded-[4px] border px-2 text-[12px]"
            style={{
              backgroundColor: 'var(--bg-input)',
              borderColor: 'var(--border-strong)',
            }}
          >
            <Search
              className="w-3.5 h-3.5 mr-1.5 shrink-0"
              style={{ color: 'var(--text-muted)' }}
              strokeWidth={1.75}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search history..."
              className="w-full bg-transparent outline-none app-focus-ring text-[12px]"
              style={{ color: 'var(--text-primary)' }}
              aria-label="Search history"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-0.5 rounded-[2px] hover:bg-[var(--bg-hover)] transition-fast"
                style={{ color: 'var(--text-muted)' }}
                title="Clear search"
                aria-label="Clear search"
              >
                <X className="w-3 h-3" strokeWidth={1.75} />
              </button>
            )}
          </div>

          {/* Settings button */}
          <Button
            variant="ghost"
            size="compact"
            onClick={() => setIsSettingsOpen(true)}
            className="w-7 h-7 p-0 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            title="History Settings"
            aria-label="History Settings"
          >
            <Settings className="w-4 h-4" />
          </Button>

          {/* Clear history button */}
          <Button
            variant="ghost"
            size="compact"
            onClick={() => setIsConfirmClearOpen(true)}
            disabled={total === 0}
            className="w-7 h-7 p-0 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--status-err)] disabled:opacity-30"
            title="Clear All History"
            aria-label="Clear All History"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          {STATUS_FILTERS.map(f => {
            const isActive = statusFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-fast shrink-0 ${
                  isActive
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                {f.label}
              </button>
            );
          })}
          <div className="ml-auto text-[11px] font-mono text-[var(--text-muted)] shrink-0 px-1">
            {total}
          </div>
        </div>
      </div>

      {/* Disabled warning banner */}
      {!settings.enabled && (
        <div
          className="px-3 py-2 border-b flex items-center justify-between text-[11px]"
          style={{
            backgroundColor: 'var(--status-err-bg)',
            borderColor: 'var(--border)',
            color: 'var(--status-err)',
          }}
        >
          <div className="flex items-center gap-1.5 overflow-hidden">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">History recording is paused</span>
          </div>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="underline font-semibold shrink-0 ml-2 hover:opacity-80"
          >
            Settings
          </button>
        </div>
      )}

      {/* History entries list grouped by day */}
      <div className="flex-1 overflow-y-auto py-1">
        {isLoading && entries.length === 0 ? (
          <div className="p-6 text-center text-[12px] text-[var(--text-muted)]">
            Loading history...
          </div>
        ) : entries.length === 0 ? (
          <div className="p-6 text-center flex flex-col items-center gap-2 text-[12px] text-[var(--text-muted)]">
            <Clock className="w-8 h-8 opacity-40 mb-1" />
            {searchQuery || statusFilter !== 'all' ? (
              <>
                <span>No requests match your history filter.</span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                  className="text-[var(--accent)] hover:underline mt-1"
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
                  className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider sticky top-0 flex items-center justify-between z-10"
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
      className="group relative flex flex-col gap-1 px-3 py-2 cursor-pointer transition-fast hover:bg-[var(--bg-hover)] border-b last:border-b-0 border-[var(--border)] app-focus-ring select-none text-left"
    >
      {/* Top line: Method badge, request name / url, status */}
      <div className="flex items-center gap-2 justify-between">
        <div className="flex items-center gap-1.5 overflow-hidden min-w-0">
          <MethodBadge method={entry.method} />
          <span
            className="font-medium text-[12px] truncate text-[var(--text-primary)]"
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
            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[var(--status-err-bg)] text-[var(--status-err)]">
              ERR
            </span>
          )}
        </div>
      </div>

      {/* URL sub-line */}
      <div className="text-[11px] font-mono truncate text-[var(--text-muted)]" title={entry.url}>
        {entry.url}
      </div>

      {/* Bottom metadata: time, duration, and hover delete button */}
      <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] mt-0.5">
        <div className="flex items-center gap-2">
          <span>{formatHistoryTime(entry.timestamp)}</span>
          {entry.durationMs !== undefined && <span>• {formatDuration(entry.durationMs)}</span>}
        </div>

        {/* Delete hover button */}
        <button
          type="button"
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--status-err)] hover:bg-[var(--bg-secondary)] transition-fast"
          title="Delete entry"
          aria-label="Delete entry"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
