import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';
import { type AppSettings, DEFAULT_APP_SETTINGS } from '../../shared/settings-types.js';

const SETTINGS_FILE_NAME = 'settings.json';

export class SettingsService {
  private cachedSettings: AppSettings | null = null;

  constructor(private customPath?: string) {}

  private getSettingsPath(): string {
    if (this.customPath) return this.customPath;
    try {
      return path.join(app.getPath('userData'), SETTINGS_FILE_NAME);
    } catch {
      return path.join(process.cwd(), SETTINGS_FILE_NAME);
    }
  }

  getSettings(): AppSettings {
    if (this.cachedSettings) {
      return { ...this.cachedSettings };
    }

    const filePath = this.getSettingsPath();
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<AppSettings>;
        this.cachedSettings = {
          ...DEFAULT_APP_SETTINGS,
          ...parsed,
        } as AppSettings;
        return { ...this.cachedSettings };
      }
    } catch (err) {
      console.error('Failed to read settings file, using defaults:', err);
    }

    this.cachedSettings = { ...DEFAULT_APP_SETTINGS };
    return { ...this.cachedSettings };
  }

  updateSettings(partial: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const updated: AppSettings = {
      ...current,
      ...partial,
    };

    this.cachedSettings = updated;
    const filePath = this.getSettingsPath();

    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save settings to disk:', err);
    }

    return { ...updated };
  }
}

export const settingsService = new SettingsService();
