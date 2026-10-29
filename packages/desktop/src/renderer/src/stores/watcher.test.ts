import { beforeEach, describe, expect, it } from 'vitest';
import type { RequestFile, WatcherChangeEvent } from '@reqit/core';
import { useCollectionStore } from './collectionStore';
import { useRequestStore } from './requestStore';

describe('Store Watcher and Live Reload (Phase 10)', () => {
  const filePath = '/workspace/col/get-users.yaml';
  const initialReq: RequestFile = {
    version: 1,
    name: 'Get Users',
    method: 'GET',
    url: 'https://example.com/api/users',
  };

  beforeEach(() => {
    // Reset stores to a known state
    useRequestStore.setState({
      drafts: {},
      tabs: [],
      activeRequestId: '',
    });
    useCollectionStore.setState({
      currentTree: {
        rootPath: '/workspace/col',
        collection: { version: 1, name: 'Col' },
        tree: [
          {
            id: filePath,
            name: 'Get Users',
            path: filePath,
            relativePath: 'get-users.yaml',
            type: 'request',
            method: 'GET',
            request: initialReq,
          },
        ],
      },
      activeCollection: { id: '/workspace/col', name: 'Col', path: '/workspace/col' },
    });

    // Open initial draft
    useRequestStore.getState().openDraftFromFile(filePath, initialReq);
  });

  it('silently reloads open request on external file change when not dirty', () => {
    const updatedReq: RequestFile = {
      version: 1,
      name: 'Fetch Users List',
      method: 'POST',
      url: 'https://example.com/api/v2/users',
    };

    const event: WatcherChangeEvent = {
      rootPath: '/workspace/col',
      tree: {
        rootPath: '/workspace/col',
        collection: { version: 1, name: 'Col' },
        tree: [
          {
            id: filePath,
            name: 'Fetch Users List',
            path: filePath,
            relativePath: 'get-users.yaml',
            type: 'request',
            method: 'POST',
            request: updatedReq,
          },
        ],
      },
      changedPaths: [filePath],
      deletedPaths: [],
      details: {
        [filePath]: {
          path: filePath,
          type: 'request',
          exists: true,
          content:
            'version: 1\nname: Fetch Users List\nmethod: POST\nurl: https://example.com/api/v2/users\n',
          request: updatedReq,
          isAppWrite: false,
        },
      },
      isAppWrite: false,
    };

    useCollectionStore.getState().applyWatcherChange(event);

    const draft = useRequestStore.getState().drafts[filePath];
    expect(draft).toBeDefined();
    expect(draft?.name).toBe('Fetch Users List');
    expect(draft?.method).toBe('POST');
    expect(draft?.url).toBe('https://example.com/api/v2/users');
    expect(draft?.conflict).toBeFalsy();
    expect(draft?.isDirty).toBe(false);

    // Verify tab is updated
    const tab = useRequestStore.getState().tabs.find(t => t.id === filePath);
    expect(tab?.name).toBe('Fetch Users List');
    expect(tab?.method).toBe('POST');
  });

  it('triggers conflict banner without overwriting edits when draft is dirty', () => {
    // User made unsaved local edits
    useRequestStore.getState().updateActiveDraft({
      url: 'https://example.com/api/local-edit',
    });
    expect(useRequestStore.getState().drafts[filePath]?.isDirty).toBe(true);

    const diskReq: RequestFile = {
      version: 1,
      name: 'Disk Modified Users',
      method: 'PUT',
      url: 'https://example.com/api/disk-version',
    };

    const event: WatcherChangeEvent = {
      rootPath: '/workspace/col',
      tree: {
        rootPath: '/workspace/col',
        collection: { version: 1, name: 'Col' },
        tree: [],
      },
      changedPaths: [filePath],
      deletedPaths: [],
      details: {
        [filePath]: {
          path: filePath,
          type: 'request',
          exists: true,
          content:
            'version: 1\nname: Disk Modified Users\nmethod: PUT\nurl: https://example.com/api/disk-version\n',
          request: diskReq,
          isAppWrite: false,
        },
      },
      isAppWrite: false,
    };

    useCollectionStore.getState().applyWatcherChange(event);

    const draft = useRequestStore.getState().drafts[filePath];
    expect(draft).toBeDefined();
    // User local edits are preserved
    expect(draft?.url).toBe('https://example.com/api/local-edit');
    expect(draft?.isDirty).toBe(true);
    // Conflict is populated
    expect(draft?.conflict).toBeDefined();
    expect(draft?.conflict?.diskRequest.url).toBe('https://example.com/api/disk-version');
  });

  it('resolves conflict via resolveConflictKeepMine and resolveConflictLoadDisk', () => {
    // Dirty draft with conflict
    useRequestStore.getState().updateActiveDraft({
      url: 'https://example.com/api/local-edit',
    });

    const diskReq: RequestFile = {
      version: 1,
      name: 'Disk Modified Users',
      method: 'PUT',
      url: 'https://example.com/api/disk-version',
    };

    useRequestStore.getState().handleWatcherFileChange(filePath, {
      path: filePath,
      type: 'request',
      exists: true,
      content:
        'version: 1\nname: Disk Modified Users\nmethod: PUT\nurl: https://example.com/api/disk-version\n',
      request: diskReq,
    });

    let draft = useRequestStore.getState().drafts[filePath];
    expect(draft?.conflict).toBeDefined();

    // 1. Keep mine
    useRequestStore.getState().resolveConflictKeepMine(filePath);
    draft = useRequestStore.getState().drafts[filePath];
    expect(draft?.conflict).toBeNull();
    expect(draft?.url).toBe('https://example.com/api/local-edit');

    // Re-introduce conflict
    useRequestStore.getState().handleWatcherFileChange(filePath, {
      path: filePath,
      type: 'request',
      exists: true,
      content:
        'version: 1\nname: Disk Modified Users\nmethod: PUT\nurl: https://example.com/api/disk-version\n',
      request: diskReq,
    });

    // 2. Load disk
    useRequestStore.getState().resolveConflictLoadDisk(filePath);
    draft = useRequestStore.getState().drafts[filePath];
    expect(draft?.conflict).toBeNull();
    expect(draft?.url).toBe('https://example.com/api/disk-version');
    expect(draft?.method).toBe('PUT');
    expect(draft?.isDirty).toBe(false);
  });

  it('marks draft as deleted on disk when file is removed externally', () => {
    const event: WatcherChangeEvent = {
      rootPath: '/workspace/col',
      tree: {
        rootPath: '/workspace/col',
        collection: { version: 1, name: 'Col' },
        tree: [],
      },
      changedPaths: [],
      deletedPaths: [filePath],
      details: {
        [filePath]: {
          path: filePath,
          type: 'unknown',
          exists: false,
          isAppWrite: false,
        },
      },
      isAppWrite: false,
    };

    useCollectionStore.getState().applyWatcherChange(event);

    const draft = useRequestStore.getState().drafts[filePath];
    expect(draft).toBeDefined();
    expect(draft?.isDeletedOnDisk).toBe(true);
  });

  it('marks draft as deleted on disk when containing folder is removed externally', () => {
    const subFilePath = '/workspace/col/auth/login.yaml';
    const loginReq: RequestFile = {
      version: 1,
      name: 'Login',
      method: 'POST',
      url: 'https://example.com/login',
    };
    useRequestStore.getState().openDraftFromFile(subFilePath, loginReq);

    const event: WatcherChangeEvent = {
      rootPath: '/workspace/col',
      tree: {
        rootPath: '/workspace/col',
        collection: { version: 1, name: 'Col' },
        tree: [],
      },
      changedPaths: [],
      deletedPaths: ['/workspace/col/auth'],
      details: {},
      isAppWrite: false,
    };

    useCollectionStore.getState().applyWatcherChange(event);

    const draft = useRequestStore.getState().drafts[subFilePath];
    expect(draft).toBeDefined();
    expect(draft?.isDeletedOnDisk).toBe(true);
  });

  it('does not reload or create conflict on app-initiated write (avoids reload loop)', () => {
    // User local edit that was just saved by app
    useRequestStore.getState().updateActiveDraft({
      url: 'https://example.com/api/my-saved-url',
    });

    const event: WatcherChangeEvent = {
      rootPath: '/workspace/col',
      tree: {
        rootPath: '/workspace/col',
        collection: { version: 1, name: 'Col' },
        tree: [],
      },
      changedPaths: [filePath],
      deletedPaths: [],
      details: {
        [filePath]: {
          path: filePath,
          type: 'request',
          exists: true,
          content: '...',
          isAppWrite: true,
        },
      },
      isAppWrite: true,
    };

    useCollectionStore.getState().applyWatcherChange(event);

    const draft = useRequestStore.getState().drafts[filePath];
    expect(draft?.conflict).toBeFalsy();
    expect(draft?.url).toBe('https://example.com/api/my-saved-url');
  });
});
