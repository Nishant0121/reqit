import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CollectionWatcher,
  createCollection,
  createRequest,
  serializeRequest,
  type WatcherChangeEvent,
} from '../src/index.js';

describe('CollectionWatcher (Phase 10)', () => {
  let tmpDir: string;
  let watcher: CollectionWatcher | null = null;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'reqit-watcher-test-'));
    await createCollection(tmpDir, 'Watcher Test Col');
  });

  afterEach(async () => {
    if (watcher) {
      await watcher.stop();
      watcher = null;
    }
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  it('detects external file creation and emits updated tree', async () => {
    watcher = new CollectionWatcher({ debounceMs: 50 });
    const events: WatcherChangeEvent[] = [];

    await watcher.start(tmpDir, e => events.push(e));

    // Create a request file directly on disk
    const reqPath = path.join(tmpDir, 'external-req.yaml');
    await fs.promises.writeFile(
      reqPath,
      serializeRequest({
        version: 1,
        name: 'External Request',
        method: 'GET',
        url: 'https://example.com/external',
      }),
      'utf-8',
    );

    // Wait for debounced watcher to fire
    await new Promise(resolve => setTimeout(resolve, 300));

    expect(events.length).toBeGreaterThan(0);
    const lastEvent = events[events.length - 1]!;
    expect(lastEvent.changedPaths).toContain(path.resolve(reqPath));
    expect(lastEvent.tree.tree.some(n => n.name === 'External Request')).toBe(true);
    expect(lastEvent.isAppWrite).toBe(false);
  });

  it('detects external file modification and parses request details', async () => {
    const node = await createRequest(tmpDir, 'Original Req');

    watcher = new CollectionWatcher({ debounceMs: 50 });
    const events: WatcherChangeEvent[] = [];
    await watcher.start(tmpDir, e => events.push(e));

    // Modify file externally
    await fs.promises.writeFile(
      node.path,
      serializeRequest({
        version: 1,
        name: 'Original Req (Modified Externally)',
        method: 'POST',
        url: 'https://httpbin.org/post',
      }),
      'utf-8',
    );

    await new Promise(resolve => setTimeout(resolve, 300));

    expect(events.length).toBeGreaterThan(0);
    const lastEvent = events[events.length - 1]!;
    expect(lastEvent.changedPaths).toContain(path.resolve(node.path));
    const details = lastEvent.details[path.resolve(node.path)];
    expect(details).toBeDefined();
    expect(details?.request?.method).toBe('POST');
    expect(details?.request?.url).toBe('https://httpbin.org/post');
    expect(lastEvent.isAppWrite).toBe(false);
  });

  it('recognizes app-initiated writes via registerAppWrite and avoids false conflicts', async () => {
    const node = await createRequest(tmpDir, 'Self Write Req');

    watcher = new CollectionWatcher({ debounceMs: 50 });
    const events: WatcherChangeEvent[] = [];
    await watcher.start(tmpDir, e => events.push(e));

    const updatedYaml = serializeRequest({
      version: 1,
      name: 'Self Write Req',
      method: 'PUT',
      url: 'https://httpbin.org/put',
    });

    // Register write before saving
    watcher.registerAppWrite(node.path, updatedYaml);
    await fs.promises.writeFile(node.path, updatedYaml, 'utf-8');

    await new Promise(resolve => setTimeout(resolve, 300));

    expect(events.length).toBeGreaterThan(0);
    const lastEvent = events[events.length - 1]!;
    expect(lastEvent.isAppWrite).toBe(true);
  });

  it('detects external file deletion', async () => {
    const node = await createRequest(tmpDir, 'To Delete');

    watcher = new CollectionWatcher({ debounceMs: 50 });
    const events: WatcherChangeEvent[] = [];
    await watcher.start(tmpDir, e => events.push(e));

    // Delete file externally
    await fs.promises.unlink(node.path);

    await new Promise(resolve => setTimeout(resolve, 300));

    expect(events.length).toBeGreaterThan(0);
    const lastEvent = events[events.length - 1]!;
    expect(lastEvent.deletedPaths).toContain(path.resolve(node.path));
    expect(lastEvent.tree.tree.some(n => n.name === 'To Delete')).toBe(false);
  });

  it('ignores temporary editor files and handles atomic saves', async () => {
    watcher = new CollectionWatcher({ debounceMs: 50 });
    const events: WatcherChangeEvent[] = [];
    await watcher.start(tmpDir, e => events.push(e));

    // Atomic save simulation: write to .tmp, then rename to .yaml
    const targetPath = path.join(tmpDir, 'atomic-save.yaml');
    const tmpPath = path.join(tmpDir, 'atomic-save.yaml.tmp');

    const content = serializeRequest({
      version: 1,
      name: 'Atomic Saved',
      method: 'GET',
      url: 'https://example.com/atomic',
    });

    await fs.promises.writeFile(tmpPath, content, 'utf-8');
    // Short pause before rename simulating editor atomic write
    await new Promise(resolve => setTimeout(resolve, 30));
    await fs.promises.rename(tmpPath, targetPath);

    await new Promise(resolve => setTimeout(resolve, 300));

    expect(events.length).toBeGreaterThan(0);
    const hasTarget = events.some(e => e.changedPaths.includes(path.resolve(targetPath)));
    expect(hasTarget).toBe(true);
    const lastEvent = events[events.length - 1]!;
    expect(lastEvent.tree.tree.some(n => n.name === 'Atomic Saved')).toBe(true);
  });

  it('handles bulk changes (e.g., git checkout) in a single debounced event', async () => {
    const node1 = await createRequest(tmpDir, 'Req 1');
    const node2 = await createRequest(tmpDir, 'Req 2');

    watcher = new CollectionWatcher({ debounceMs: 80 });
    const events: WatcherChangeEvent[] = [];
    await watcher.start(tmpDir, e => events.push(e));

    // Simulate git checkout: modify node1, delete node2, add node3 in rapid succession
    await fs.promises.writeFile(
      node1.path,
      serializeRequest({
        version: 1,
        name: 'Req 1 (Branch Switch)',
        method: 'PATCH',
        url: 'https://httpbin.org/patch',
      }),
      'utf-8',
    );
    await fs.promises.unlink(node2.path);

    const node3Path = path.join(tmpDir, 'req-3.yaml');
    await fs.promises.writeFile(
      node3Path,
      serializeRequest({
        version: 1,
        name: 'Req 3 (New on branch)',
        method: 'PUT',
        url: 'https://httpbin.org/put',
      }),
      'utf-8',
    );

    // Wait for debounce flush
    await new Promise(resolve => setTimeout(resolve, 350));

    expect(events.length).toBeGreaterThan(0);
    const allChanged = events.flatMap(e => e.changedPaths);
    const allDeleted = events.flatMap(e => e.deletedPaths);
    const lastEvent = events[events.length - 1]!;

    expect(allChanged).toContain(path.resolve(node1.path));
    expect(allDeleted).toContain(path.resolve(node2.path));
    expect(allChanged).toContain(path.resolve(node3Path));

    expect(lastEvent.tree.tree.some(n => n.name === 'Req 1 (Branch Switch)')).toBe(true);
    expect(lastEvent.tree.tree.some(n => n.name === 'Req 2')).toBe(false);
    expect(lastEvent.tree.tree.some(n => n.name === 'Req 3 (New on branch)')).toBe(true);
  });

  it('ignores changes inside hidden directory such as .git', async () => {
    const gitDir = path.join(tmpDir, '.git');
    await fs.promises.mkdir(gitDir, { recursive: true });

    watcher = new CollectionWatcher({ debounceMs: 50 });
    const events: WatcherChangeEvent[] = [];
    await watcher.start(tmpDir, e => events.push(e));

    // Write file in .git
    await fs.promises.writeFile(path.join(gitDir, 'HEAD'), 'ref: refs/heads/main\n', 'utf-8');

    await new Promise(resolve => setTimeout(resolve, 200));

    expect(events.length).toBe(0);
  });
});
