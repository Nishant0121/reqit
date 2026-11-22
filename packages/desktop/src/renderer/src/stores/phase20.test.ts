import { describe, it, expect, beforeEach } from 'vitest';
import { useRequestStore } from './requestStore';
import { requestFileToDraft, draftToRequestFile } from '../lib/request-mapper';
import { getEffectiveShortcuts, getEffectiveShortcut, matchesShortcut } from '../lib/shortcuts';
import { computeLineDiff } from '../lib/diff';
import type { RequestFile } from '@reqit/core';

describe('Phase 20: Tabs, Preview Tabs & Pinning', () => {
  beforeEach(() => {
    useRequestStore.setState({
      drafts: {},
      tabs: [],
      activeRequestId: '',
      result: null,
      error: null,
    });
  });

  it('opens a file in preview mode and replaces clean preview tab on next open', () => {
    const store = useRequestStore.getState();

    const file1: RequestFile = {
      version: 1,
      name: 'Req 1',
      method: 'GET',
      url: 'https://example.com/1',
    };
    const file2: RequestFile = {
      version: 1,
      name: 'Req 2',
      method: 'POST',
      url: 'https://example.com/2',
    };

    // Open first file in preview mode
    store.openDraftFromFile('path/req1.yaml', file1, true);

    let state = useRequestStore.getState();
    expect(state.tabs.length).toBe(1);
    expect(state.tabs[0]?.id).toBe('path/req1.yaml');
    expect(state.tabs[0]?.isPreview).toBe(true);
    expect(state.activeRequestId).toBe('path/req1.yaml');

    // Open second file in preview mode - should REPLACE the first clean preview tab
    store.openDraftFromFile('path/req2.yaml', file2, true);

    state = useRequestStore.getState();
    expect(state.tabs.length).toBe(1);
    expect(state.tabs[0]?.id).toBe('path/req2.yaml');
    expect(state.tabs[0]?.isPreview).toBe(true);
    expect(state.activeRequestId).toBe('path/req2.yaml');
  });

  it('pins preview tab on explicit pinTab or when edited', () => {
    const store = useRequestStore.getState();
    const file1: RequestFile = {
      version: 1,
      name: 'Req 1',
      method: 'GET',
      url: 'https://example.com/1',
    };

    store.openDraftFromFile('path/req1.yaml', file1, true);
    expect(useRequestStore.getState().tabs[0]?.isPreview).toBe(true);

    // Pin tab
    store.pinTab('path/req1.yaml');
    expect(useRequestStore.getState().tabs[0]?.isPreview).toBe(false);

    // Open second file in preview mode - should APPEND because first is pinned
    const file2: RequestFile = {
      version: 1,
      name: 'Req 2',
      method: 'POST',
      url: 'https://example.com/2',
    };
    store.openDraftFromFile('path/req2.yaml', file2, true);

    const state = useRequestStore.getState();
    expect(state.tabs.length).toBe(2);
    expect(state.tabs[0]?.isPreview).toBe(false);
    expect(state.tabs[1]?.isPreview).toBe(true);
  });

  it('automatically un-previews (pins) tab when draft is edited', () => {
    const store = useRequestStore.getState();
    const file: RequestFile = {
      version: 1,
      name: 'Req 1',
      method: 'GET',
      url: 'https://example.com/1',
    };

    store.openDraftFromFile('path/req1.yaml', file, true);
    expect(useRequestStore.getState().tabs[0]?.isPreview).toBe(true);

    // Editing active draft pins the tab
    store.updateActiveDraft({ url: 'https://example.com/updated' });

    const state = useRequestStore.getState();
    expect(state.tabs[0]?.isPreview).toBe(false);
    expect(state.tabs[0]?.isDirty).toBe(true);
  });
});

describe('Phase 20: Request Docs Mapping', () => {
  it('maps docs field to draft and serializes back to RequestFile', () => {
    const file: RequestFile = {
      version: 1,
      name: 'Documented Request',
      method: 'GET',
      url: 'https://api.example.com',
      docs: '# Endpoint Documentation\n\nReturns user list.',
    };

    const draft = requestFileToDraft(file, 'path/doc.yaml');
    expect(draft.docs).toBe('# Endpoint Documentation\n\nReturns user list.');

    draft.docs = '# Updated Docs\n\nNew info';
    draft.isDirty = true;

    const roundtrip = draftToRequestFile(draft);
    expect(roundtrip.docs).toBe('# Updated Docs\n\nNew info');
  });

  it('omits empty docs field on serialization', () => {
    const file: RequestFile = {
      version: 1,
      name: 'No Docs',
      method: 'GET',
      url: 'https://api.example.com',
    };

    const draft = requestFileToDraft(file, 'path/nodoc.yaml');
    draft.isDirty = true;
    draft.docs = '   ';

    const roundtrip = draftToRequestFile(draft);
    expect(roundtrip.docs).toBeUndefined();
  });
});

describe('Phase 20: Keyboard Shortcuts Customization', () => {
  it('substitutes custom shortcut rebindings', () => {
    const custom = {
      'request.send': 'Ctrl+Shift+Enter',
      'commandPalette.open': 'Ctrl+P',
    };

    const effective = getEffectiveShortcuts(custom);
    const send = effective.find(s => s.id === 'request.send');
    const palette = effective.find(s => s.id === 'commandPalette.open');
    const save = effective.find(s => s.id === 'request.save');

    expect(send?.keyCombination).toBe('Ctrl+Shift+Enter');
    expect(palette?.keyCombination).toBe('Ctrl+P');
    expect(save?.keyCombination).toBe('Ctrl+S'); // Default unmodified

    expect(getEffectiveShortcut('request.send', custom)).toBe('Ctrl+Shift+Enter');
    expect(getEffectiveShortcut('request.save', custom)).toBe('Ctrl+S');
  });

  it('correctly matches re-bound shortcut keys', () => {
    const event = {
      key: 'p',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
    } as KeyboardEvent;

    expect(matchesShortcut(event, 'Ctrl+P')).toBe(true);
    expect(matchesShortcut(event, 'Ctrl+K')).toBe(false);
  });
});

describe('Phase 20: Response Line Diff', () => {
  it('computes line-by-line diff between two response bodies', () => {
    const textA = '{"status": "ok", "version": 1}';
    const textB = '{"status": "ok", "version": 2}';

    const diff = computeLineDiff(textA, textB);
    expect(diff.length).toBeGreaterThan(0);
    expect(diff.some(d => d.type === 'removed')).toBe(true);
    expect(diff.some(d => d.type === 'added')).toBe(true);
  });
});
