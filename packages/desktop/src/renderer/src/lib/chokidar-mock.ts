/**
 * Browser-safe mock for chokidar in the Electron renderer process.
 * The renderer process must never run filesystem watchers directly;
 * file watching is owned entirely by the Electron main process.
 */

export class FSWatcher {
  on() {
    return this;
  }
  once() {
    return this;
  }
  off() {
    return this;
  }
  emit() {
    return false;
  }
  close() {
    return Promise.resolve();
  }
  add() {
    return this;
  }
  unwatch() {
    return this;
  }
  getWatched() {
    return {};
  }
}

export function watch(): FSWatcher {
  return new FSWatcher();
}

export default {
  watch,
  FSWatcher,
};
