import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { app, BrowserWindow, session } from 'electron';
import { registerIpcHandlers } from './ipc.js';
import { setupApplicationMenu } from './menu.js';
import { fileService } from './services/file-service.js';
import { loadWindowState, saveWindowState } from './window-state.js';

let mainWindow: BrowserWindow | null = null;

function getPreloadPath(): string {
  const mjsPath = join(__dirname, '../preload/index.mjs');
  if (existsSync(mjsPath)) {
    return mjsPath;
  }
  return join(__dirname, '../preload/index.js');
}

function createWindow(): void {
  const isDev = Boolean(process.env.ELECTRON_RENDERER_URL);
  const devCsp =
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' http: https: ws:; img-src 'self' data:; font-src 'self' data:;";
  const prodCsp =
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' http: https:; img-src 'self' data:; font-src 'self' data:;";

  // Set Content-Security-Policy on session requests
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [isDev ? devCsp : prodCsp],
      },
    });
  });

  const windowState = loadWindowState();

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: 960,
    minHeight: 600,
    title: 'Reqit',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Persist window state on resize and move (debounced)
  let saveTimer: NodeJS.Timeout | null = null;
  const debouncedSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (mainWindow) saveWindowState(mainWindow);
    }, 300);
  };

  mainWindow.on('resize', debouncedSave);
  mainWindow.on('move', debouncedSave);

  // Set up application menu
  setupApplicationMenu(mainWindow);

  // Register IPC handlers
  registerIpcHandlers();

  // Load URL or local index.html
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', async () => {
  await fileService.stopWatcher();
});
