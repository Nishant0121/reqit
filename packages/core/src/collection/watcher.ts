import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { FSWatcher } from 'chokidar';
import { parseRequest } from '../format/parser.js';
import { scanCollection } from './scanner.js';
import type {
  CollectionTree,
  WatcherChangeEvent,
  WatcherChangedFile,
  WatcherOptions,
} from './types.js';

function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function normalizeKey(filePath: string): string {
  const resolved = path.resolve(filePath);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isInside(targetPath: string, parentPath: string): boolean {
  const rel = path.relative(parentPath.toLowerCase(), targetPath.toLowerCase());
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

function isIgnoredFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath);
  if (basename.startsWith('.') && basename !== '.reqit') return true;
  const parts = filePath.split(/[/\\]/);
  if (parts.some(seg => seg.startsWith('.') && seg !== '.reqit')) return true;
  if (['.tmp', '.swp', '.swo', '.bak'].includes(ext)) return true;
  if (basename.endsWith('~') || basename.startsWith('~') || basename.startsWith('#')) return true;
  return false;
}

function safeReadFile(filePath: string): string {
  for (let retry = 0; retry < 3; retry++) {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if ((code === 'EBUSY' || code === 'EPERM') && retry < 2) {
        // Short busy wait on Windows
        const waitTill = Date.now() + 25;
        while (Date.now() < waitTill) {
          // busy spin wait 25ms
        }
        continue;
      }
      throw err;
    }
  }
  return fs.readFileSync(filePath, 'utf-8');
}

export class CollectionWatcher {
  private watcher: FSWatcher | null = null;
  private rootPath: string | null = null;
  private debounceMs: number;
  private ignored: (string | RegExp)[];
  private timer: NodeJS.Timeout | null = null;

  // Track pending changes during the debounce window
  private pendingChanges = new Set<string>();

  // Track the application's own writes: Map<normalizedPath, { hash?: string; timestamp: number }>
  private appWrites = new Map<string, { hash?: string; timestamp: number }>();

  // Registered listeners
  private listeners: Array<(event: WatcherChangeEvent) => void> = [];

  constructor(options?: WatcherOptions) {
    this.debounceMs = options?.debounceMs ?? 150;
    this.ignored = options?.ignored ?? [
      '**/.git/**',
      '**/node_modules/**',
      '**/*.tmp',
      '**/*~',
      '**/*.swp',
      '**/*.bak',
      '**/.DS_Store',
      '**/Thumbs.db',
    ];
  }

  getRootPath(): string | null {
    return this.rootPath;
  }

  isWatching(): boolean {
    return this.watcher !== null;
  }

  /**
   * Registers a file write originated by the app itself.
   * When the watcher detects this change, it will recognize it as an internal write
   * and not trigger a reload loop or false conflict.
   */
  registerAppWrite(filePath: string, content?: string): void {
    const key = normalizeKey(filePath);
    const hash = content !== undefined ? computeHash(content) : undefined;
    this.appWrites.set(key, { hash, timestamp: Date.now() });
  }

  /**
   * Starts watching a collection folder.
   */
  async start(rootPath: string, onEvent?: (event: WatcherChangeEvent) => void): Promise<void> {
    await this.stop();

    this.rootPath = path.resolve(rootPath);
    if (onEvent) {
      this.listeners.push(onEvent);
    }

    const { watch } = await import('chokidar');
    const currentWatcher = watch(this.rootPath, {
      ignored: this.ignored,
      ignoreInitial: true,
      persistent: true,
    });
    this.watcher = currentWatcher;

    const handleFileEvent = (eventPath: string) => {
      const resolved = path.resolve(eventPath);
      if (!this.rootPath || !isInside(resolved, this.rootPath)) return;
      if (isIgnoredFile(resolved)) return;

      this.pendingChanges.add(resolved);
      this.scheduleFlush();
    };

    currentWatcher.on('add', handleFileEvent);
    currentWatcher.on('change', handleFileEvent);
    currentWatcher.on('unlink', handleFileEvent);
    currentWatcher.on('addDir', handleFileEvent);
    currentWatcher.on('unlinkDir', handleFileEvent);
    currentWatcher.on('error', () => {
      // Ignore transient watcher errors
    });

    // Wait until watcher initial scan is ready
    await new Promise<void>(resolve => {
      let resolved = false;
      const done = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };
      currentWatcher.once('ready', done);
      setTimeout(done, 500);
    });
  }

  /**
   * Subscribes to collection change events.
   */
  on(listener: (event: WatcherChangeEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Stops the watcher and cleans up resources.
   */
  async stop(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pendingChanges.clear();
    this.appWrites.clear();
    this.listeners = [];

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    this.rootPath = null;
  }

  /**
   * Debounces batched events and processes them in a single sweep.
   */
  private scheduleFlush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.flushBatch();
    }, this.debounceMs);
  }

  /**
   * Processes the collected changes, scans the updated tree, and notifies listeners.
   */
  private async flushBatch(): Promise<void> {
    if (!this.rootPath || this.pendingChanges.size === 0) return;

    const changedPathsList = Array.from(this.pendingChanges);
    this.pendingChanges.clear();

    // Verify root directory still exists
    if (!fs.existsSync(this.rootPath)) {
      const event: WatcherChangeEvent = {
        rootPath: this.rootPath,
        tree: {
          rootPath: this.rootPath,
          collection: { version: 1, name: path.basename(this.rootPath) },
          tree: [],
        },
        changedPaths: [],
        deletedPaths: [this.rootPath],
        details: {
          [this.rootPath]: {
            path: this.rootPath,
            exists: false,
            type: 'folder',
            isAppWrite: false,
          },
        },
        isAppWrite: false,
      };

      for (const listener of this.listeners) {
        try {
          listener(event);
        } catch {
          // ignore
        }
      }
      return;
    }

    // Scan updated tree
    let newTree: CollectionTree;
    try {
      newTree = await scanCollection(this.rootPath);
    } catch {
      return;
    }

    const changedPaths: string[] = [];
    const deletedPaths: string[] = [];
    const details: Record<string, WatcherChangedFile> = {};
    let allWereAppWrites = true;
    const now = Date.now();

    for (const p of changedPathsList) {
      const exists = fs.existsSync(p);
      const isAppWrite = this.checkAndClearAppWrite(p, exists, now);

      if (!isAppWrite) {
        allWereAppWrites = false;
      }

      if (!exists) {
        deletedPaths.push(p);
        details[p] = {
          path: p,
          exists: false,
          type: 'unknown',
          isAppWrite,
        };
      } else {
        changedPaths.push(p);
        try {
          const stat = fs.statSync(p);
          if (stat.isDirectory()) {
            details[p] = {
              path: p,
              exists: true,
              type: 'folder',
              isAppWrite,
            };
          } else if (p.endsWith('.yaml') || p.endsWith('.yml')) {
            const content = safeReadFile(p);
            const basename = path.basename(p);
            if (basename === 'reqit.yaml' || basename === 'reqit.yml') {
              details[p] = {
                path: p,
                exists: true,
                type: 'collection',
                content,
                isAppWrite,
              };
            } else if (basename === 'folder.yaml' || basename === 'folder.yml') {
              details[p] = {
                path: p,
                exists: true,
                type: 'folder',
                content,
                isAppWrite,
              };
            } else {
              // Request file
              try {
                const req = parseRequest(content, p);
                details[p] = {
                  path: p,
                  exists: true,
                  type: 'request',
                  content,
                  request: req,
                  isAppWrite,
                };
              } catch (err: unknown) {
                details[p] = {
                  path: p,
                  exists: true,
                  type: 'request',
                  content,
                  parseError: err instanceof Error ? err.message : String(err),
                  isAppWrite,
                };
              }
            }
          } else {
            details[p] = {
              path: p,
              exists: true,
              type: 'unknown',
              isAppWrite,
            };
          }
        } catch {
          // ignore stat/read failure on transient files
        }
      }
    }

    const event: WatcherChangeEvent = {
      rootPath: this.rootPath,
      tree: newTree,
      changedPaths,
      deletedPaths,
      details,
      isAppWrite: allWereAppWrites && changedPathsList.length > 0,
    };

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Prevent listener error from breaking watcher loop
      }
    }
  }

  /**
   * Checks whether a changed path corresponds to an app-initiated write within the tolerance window.
   */
  private checkAndClearAppWrite(filePath: string, exists: boolean, now: number): boolean {
    const key = normalizeKey(filePath);
    const record = this.appWrites.get(key);
    if (!record) return false;

    // Discard if older than 5 seconds
    if (now - record.timestamp > 5000) {
      this.appWrites.delete(key);
      return false;
    }

    // If content hash was provided and file still exists, verify it
    if (record.hash !== undefined && exists) {
      try {
        const diskContent = safeReadFile(filePath);
        const diskHash = computeHash(diskContent);
        if (diskHash === record.hash) {
          this.appWrites.delete(key);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    }

    // For unlinks or unhashed writes within window
    this.appWrites.delete(key);
    return true;
  }
}
