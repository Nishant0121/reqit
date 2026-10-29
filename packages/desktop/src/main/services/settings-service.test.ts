import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { SettingsService } from './settings-service.js';
import { createExampleCollectionFiles } from './example-collection.js';
import { DEFAULT_APP_SETTINGS } from '../../shared/settings-types.js';

describe('SettingsService', () => {
  let tempDir: string;
  let settingsFile: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reqit-settings-test-'));
    settingsFile = path.join(tempDir, 'settings.json');
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns default settings when settings file does not exist', () => {
    const service = new SettingsService(settingsFile);
    const settings = service.getSettings();

    expect(settings).toEqual(DEFAULT_APP_SETTINGS);
    expect(settings.theme).toBe('dark');
    expect(settings.requestTimeoutMs).toBe(30000);
    expect(settings.proxyMode).toBe('none');
  });

  it('updates settings and writes them to disk', () => {
    const service = new SettingsService(settingsFile);
    const updated = service.updateSettings({
      theme: 'light',
      requestTimeoutMs: 15000,
      proxyMode: 'manual',
      proxyUrl: 'http://127.0.0.1:8888',
    });

    expect(updated.theme).toBe('light');
    expect(updated.requestTimeoutMs).toBe(15000);
    expect(updated.proxyMode).toBe('manual');
    expect(updated.proxyUrl).toBe('http://127.0.0.1:8888');

    // Verify written to disk
    expect(fs.existsSync(settingsFile)).toBe(true);
    const diskContent = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
    expect(diskContent.theme).toBe('light');
    expect(diskContent.requestTimeoutMs).toBe(15000);
  });

  it('loads previously persisted settings from disk on initialization', () => {
    // Write pre-existing settings
    fs.writeFileSync(
      settingsFile,
      JSON.stringify({
        theme: 'system',
        fontSize: 'large',
        historyMaxEntries: 500,
      }),
      'utf-8',
    );

    const service = new SettingsService(settingsFile);
    const loaded = service.getSettings();

    expect(loaded.theme).toBe('system');
    expect(loaded.fontSize).toBe('large');
    expect(loaded.historyMaxEntries).toBe(500);
    // Defaults preserved for unmentioned keys
    expect(loaded.requestTimeoutMs).toBe(DEFAULT_APP_SETTINGS.requestTimeoutMs);
  });
});

describe('Bundled Example Collection', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reqit-example-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('creates complete runnable Httpbin collection files', () => {
    createExampleCollectionFiles(tempDir);

    expect(fs.existsSync(path.join(tempDir, 'reqit.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'environments', 'dev.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'environments', 'local.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, '.reqit', 'secrets.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'HTTP Methods', 'GET Request.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'HTTP Methods', 'POST JSON.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'Auth', 'Bearer Token.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'Auth', 'Basic Auth.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'Dynamic Data', 'Delay 1s.yaml'))).toBe(true);
  });
});
