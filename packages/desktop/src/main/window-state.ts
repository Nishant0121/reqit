import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app, type BrowserWindow, screen } from 'electron';

export interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

const DEFAULT_STATE: WindowState = {
  width: 1200,
  height: 800,
};

function getStateFilePath(): string {
  return join(app.getPath('userData'), 'window-state.json');
}

export function loadWindowState(): WindowState {
  try {
    const filePath = getStateFilePath();
    if (existsSync(filePath)) {
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      const width = Math.max(
        960,
        typeof data.width === 'number' ? data.width : DEFAULT_STATE.width,
      );
      const height = Math.max(
        600,
        typeof data.height === 'number' ? data.height : DEFAULT_STATE.height,
      );

      if (typeof data.x === 'number' && typeof data.y === 'number') {
        const displays = screen.getAllDisplays();
        const isVisible = displays.some(d => {
          const { x, y, width: dw, height: dh } = d.bounds;
          return data.x >= x && data.x < x + dw && data.y >= y && data.y < y + dh;
        });

        if (isVisible) {
          return { width, height, x: data.x, y: data.y };
        }
      }

      return { width, height };
    }
  } catch {
    // fallback
  }
  return DEFAULT_STATE;
}

export function saveWindowState(window: BrowserWindow): void {
  try {
    if (window.isDestroyed() || window.isMinimized()) return;
    const bounds = window.getBounds();
    const state: WindowState = {
      width: Math.max(960, bounds.width),
      height: Math.max(600, bounds.height),
      x: bounds.x,
      y: bounds.y,
    };
    writeFileSync(getStateFilePath(), JSON.stringify(state, null, 2), 'utf-8');
  } catch {
    // ignore
  }
}
