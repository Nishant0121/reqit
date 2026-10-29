export type ThemeSetting = 'dark' | 'light' | 'system';
export type FontSizeSetting = 'small' | 'medium' | 'large';
export type ProxyModeSetting = 'none' | 'system' | 'manual';

export interface AppSettings {
  theme: ThemeSetting;
  fontSize: FontSizeSetting;
  editorFontSize: number;
  requestTimeoutMs: number;
  followRedirects: boolean;
  maxRedirects: number;
  validateSsl: boolean;
  proxyMode: ProxyModeSetting;
  proxyUrl: string;
  proxyBypass: string;
  historyEnabled: boolean;
  historyMaxEntries: number;
  historyRetentionDays: number;
  hasCompletedFirstRun: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'dark',
  fontSize: 'medium',
  editorFontSize: 13,
  requestTimeoutMs: 30000,
  followRedirects: true,
  maxRedirects: 5,
  validateSsl: true,
  proxyMode: 'none',
  proxyUrl: '',
  proxyBypass: 'localhost, 127.0.0.1, ::1',
  historyEnabled: true,
  historyMaxEntries: 1000,
  historyRetentionDays: 30,
  hasCompletedFirstRun: false,
};
