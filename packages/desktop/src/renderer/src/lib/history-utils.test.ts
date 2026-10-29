import { describe, it, expect } from 'vitest';
import { getDayGroup, groupEntriesByDay, formatBytes, formatDuration } from './history-utils.js';
import type { HistoryEntrySummary } from '../../../shared/ipc-types.js';

describe('history-utils', () => {
  const mockNow = new Date('2026-10-29T12:00:00Z');

  it('correctly categorizes timestamps into day groups', () => {
    // Today
    const today = new Date('2026-10-29T08:30:00Z').getTime();
    expect(getDayGroup(today, mockNow)).toBe('Today');

    // Yesterday
    const yesterday = new Date('2026-10-28T15:00:00Z').getTime();
    expect(getDayGroup(yesterday, mockNow)).toBe('Yesterday');

    // Previous 7 days (e.g. 4 days ago)
    const fourDaysAgo = new Date('2026-10-25T10:00:00Z').getTime();
    expect(getDayGroup(fourDaysAgo, mockNow)).toBe('Previous 7 Days');

    // Older (e.g. 20 days ago)
    const twentyDaysAgo = new Date('2026-10-09T10:00:00Z').getTime();
    expect(getDayGroup(twentyDaysAgo, mockNow)).toBe('Older');
  });

  it('groups entries preserving group order', () => {
    const entries: HistoryEntrySummary[] = [
      {
        id: '1',
        timestamp: new Date('2026-10-29T09:00:00Z').getTime(),
        requestName: 'Today Req',
        method: 'GET',
        url: 'https://example.com/today',
        isError: false,
      },
      {
        id: '2',
        timestamp: new Date('2026-10-28T11:00:00Z').getTime(),
        requestName: 'Yesterday Req',
        method: 'POST',
        url: 'https://example.com/yesterday',
        isError: false,
      },
      {
        id: '3',
        timestamp: new Date('2026-10-24T12:00:00Z').getTime(),
        requestName: 'Last Week Req',
        method: 'DELETE',
        url: 'https://example.com/lastweek',
        isError: false,
      },
      {
        id: '4',
        timestamp: new Date('2026-09-01T12:00:00Z').getTime(),
        requestName: 'Old Req',
        method: 'GET',
        url: 'https://example.com/old',
        isError: true,
      },
    ];

    const grouped = groupEntriesByDay(entries, mockNow);
    expect(grouped.length).toBe(4);
    expect(grouped[0]?.day).toBe('Today');
    expect(grouped[0]?.entries[0]?.requestName).toBe('Today Req');
    expect(grouped[1]?.day).toBe('Yesterday');
    expect(grouped[2]?.day).toBe('Previous 7 Days');
    expect(grouped[3]?.day).toBe('Older');
  });

  it('formats bytes and duration accurately', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(1048576 * 2.5)).toBe('2.50 MB');
    expect(formatBytes(undefined)).toBe('-');

    expect(formatDuration(45)).toBe('45 ms');
    expect(formatDuration(1500)).toBe('1.50 s');
    expect(formatDuration(undefined)).toBe('-');
  });
});
