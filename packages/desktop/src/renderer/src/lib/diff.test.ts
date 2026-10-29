import { describe, expect, it } from 'vitest';
import { computeLineDiff } from './diff';

describe('computeLineDiff', () => {
  it('correctly reports identical strings as unchanged', () => {
    const text = 'name: Test\nmethod: GET\nurl: https://example.com';
    const diff = computeLineDiff(text, text);
    expect(diff.every(d => d.type === 'unchanged')).toBe(true);
    expect(diff.length).toBe(3);
  });

  it('correctly detects additions and removals', () => {
    const textA = 'name: Test\nmethod: GET\nurl: https://example.com';
    const textB = 'name: Test\nmethod: POST\nurl: https://example.com';

    const diff = computeLineDiff(textA, textB);
    const removed = diff.find(d => d.type === 'removed');
    const added = diff.find(d => d.type === 'added');

    expect(removed?.text).toBe('method: GET');
    expect(added?.text).toBe('method: POST');
  });

  it('handles completely different text', () => {
    const textA = 'line 1\nline 2';
    const textB = 'line 3\nline 4';

    const diff = computeLineDiff(textA, textB);
    expect(diff.filter(d => d.type === 'removed').length).toBe(2);
    expect(diff.filter(d => d.type === 'added').length).toBe(2);
  });
});
