import type { HistoryEntrySummary } from '../../../shared/ipc-types.js';

export function getDayGroup(timestamp: number, now: Date = new Date()): string {
  const entryDate = new Date(timestamp);

  const isToday = entryDate.toDateString() === now.toDateString();
  if (isToday) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (entryDate.toDateString() === yesterday.toDateString()) return 'Yesterday';

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  if (entryDate >= sevenDaysAgo) return 'Previous 7 Days';

  return 'Older';
}

export interface DayGroupedEntries {
  day: string;
  entries: HistoryEntrySummary[];
}

export function groupEntriesByDay(
  entries: HistoryEntrySummary[],
  now: Date = new Date(),
): DayGroupedEntries[] {
  const groupsOrder = ['Today', 'Yesterday', 'Previous 7 Days', 'Older'];
  const map = new Map<string, HistoryEntrySummary[]>();

  for (const group of groupsOrder) {
    map.set(group, []);
  }

  for (const entry of entries) {
    const groupName = getDayGroup(entry.timestamp, now);
    const list = map.get(groupName);
    if (list) {
      list.push(entry);
    } else {
      map.set(groupName, [entry]);
    }
  }

  const result: DayGroupedEntries[] = [];
  for (const group of groupsOrder) {
    const list = map.get(group);
    if (list && list.length > 0) {
      result.push({ day: group, entries: list });
    }
  }

  return result;
}

export function formatHistoryTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null) return '-';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}
