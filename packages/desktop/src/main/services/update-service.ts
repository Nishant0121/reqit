import { app, BrowserWindow } from 'electron';
import { autoUpdater, type UpdateInfo, type ProgressInfo } from 'electron-updater';
import type { UpdateStatus } from '../../shared/ipc-types.js';

export class UpdateService {
  private currentStatus: UpdateStatus = {
    status: 'idle',
    currentVersion: app.getVersion() || '0.3.0',
  };

  private isChecking = false;
  private isDownloading = false;
  private isInitialized = false;

  constructor() {
    this.currentStatus.currentVersion = app.getVersion() || '0.3.0';
  }

  public initialize(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Configure autoUpdater
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    // Listen to updater events
    autoUpdater.on('checking-for-update', () => {
      this.setStatus({
        status: 'checking',
        currentVersion: this.currentStatus.currentVersion,
      });
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.isChecking = false;
      this.setStatus({
        status: 'available',
        currentVersion: this.currentStatus.currentVersion,
        version: info.version,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
        releaseDate: info.releaseDate,
      });
    });

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      this.isChecking = false;
      this.setStatus({
        status: 'not-available',
        currentVersion: this.currentStatus.currentVersion,
        version: info.version,
      });
    });

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      this.setStatus({
        status: 'downloading',
        currentVersion: this.currentStatus.currentVersion,
        version: this.currentStatus.version,
        percent: Math.round(progress.percent || 0),
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      });
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.isDownloading = false;
      this.setStatus({
        status: 'downloaded',
        currentVersion: this.currentStatus.currentVersion,
        version: info.version,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
        percent: 100,
      });
    });

    autoUpdater.on('error', (err: Error) => {
      this.isChecking = false;
      this.isDownloading = false;
      this.setStatus({
        status: 'error',
        currentVersion: this.currentStatus.currentVersion,
        version: this.currentStatus.version,
        error: err?.message || 'Error occurred during update check.',
      });
    });
  }

  public getStatus(): UpdateStatus {
    return { ...this.currentStatus };
  }

  private setStatus(status: UpdateStatus): void {
    this.currentStatus = status;
    this.broadcastStatus(status);
  }

  private broadcastStatus(status: UpdateStatus): void {
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('updater:status', status);
      }
    });
  }

  public async checkForUpdates(manual = false): Promise<UpdateStatus> {
    this.initialize();

    if (this.isChecking) {
      return this.currentStatus;
    }

    this.isChecking = true;
    this.setStatus({
      status: 'checking',
      currentVersion: this.currentStatus.currentVersion,
    });

    // In development mode (not packaged), simulate or test gracefully
    if (!app.isPackaged) {
      this.isChecking = false;
      const status: UpdateStatus = {
        status: 'not-available',
        currentVersion: this.currentStatus.currentVersion,
        error: manual
          ? 'Running in development mode (app is not packaged). You can use "Simulate Update" in settings to test update behavior.'
          : undefined,
      };
      this.setStatus(status);
      return status;
    }

    try {
      const result = await autoUpdater.checkForUpdates();
      if (!result) {
        this.isChecking = false;
        const status: UpdateStatus = {
          status: 'not-available',
          currentVersion: this.currentStatus.currentVersion,
        };
        this.setStatus(status);
        return status;
      }
      return this.currentStatus;
    } catch (err: unknown) {
      this.isChecking = false;
      const errorMsg = (err as Error)?.message || 'Failed to check for updates';
      const status: UpdateStatus = {
        status: 'error',
        currentVersion: this.currentStatus.currentVersion,
        error: errorMsg,
      };
      this.setStatus(status);
      return status;
    }
  }

  public async downloadUpdate(): Promise<boolean> {
    if (this.currentStatus.status !== 'available') {
      return false;
    }

    this.isDownloading = true;
    this.setStatus({
      status: 'downloading',
      currentVersion: this.currentStatus.currentVersion,
      version: this.currentStatus.version,
      percent: 0,
    });

    try {
      await autoUpdater.downloadUpdate();
      return true;
    } catch (err: unknown) {
      this.isDownloading = false;
      this.setStatus({
        status: 'error',
        currentVersion: this.currentStatus.currentVersion,
        error: (err as Error)?.message || 'Failed to download update',
      });
      return false;
    }
  }

  public quitAndInstall(): void {
    if (this.currentStatus.status === 'downloaded') {
      setImmediate(() => {
        autoUpdater.quitAndInstall();
      });
    }
  }

  /**
   * Simulates an update notification for testing and demo purposes without needing an external release.
   */
  public simulateUpdate(version = '1.0.0'): UpdateStatus {
    this.setStatus({
      status: 'available',
      currentVersion: this.currentStatus.currentVersion,
      version,
      releaseDate: new Date().toISOString(),
      releaseNotes: `### Reqit v${version} Release Notes\n\n- **Security Hardening**: Strict path validation, sandboxing, and secure IPC.\n- **GraphQL Explorer**: Full schema introspection and query autocomplete.\n- **OpenAPI Import**: 1-click import from OpenAPI/Swagger 2.0 & 3.0.\n- **Performance**: Optimized memory usage and instant response streaming.`,
    });
    return this.currentStatus;
  }
}

export const updateService = new UpdateService();
