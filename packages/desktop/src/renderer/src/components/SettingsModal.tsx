import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { useSettingsStore, type SettingsTab } from '../stores/settingsStore';
import { useHistoryStore } from '../stores/historyStore';
import { useAppStore } from '../stores/appStore';
import type {
  ThemeSetting,
  FontSizeSetting,
  ProxyModeSetting,
} from '../../../shared/settings-types';
import { Sliders, Globe, Shield, Clock, Sun, Moon, Laptop, Trash2 } from 'lucide-react';

export function SettingsModal(): React.JSX.Element | null {
  const { isOpen, closeSettings, activeTab, setActiveTab, settings, updateSettings } =
    useSettingsStore();
  const { clearHistory } = useHistoryStore();
  const { addToast } = useAppStore();

  const [theme, setTheme] = useState<ThemeSetting>(settings.theme);
  const [fontSize, setFontSize] = useState<FontSizeSetting>(settings.fontSize);
  const [editorFontSize, setEditorFontSize] = useState<number>(settings.editorFontSize);
  const [requestTimeoutMs, setRequestTimeoutMs] = useState<number>(settings.requestTimeoutMs);
  const [followRedirects, setFollowRedirects] = useState<boolean>(settings.followRedirects);
  const [maxRedirects, setMaxRedirects] = useState<number>(settings.maxRedirects);
  const [validateSsl, setValidateSsl] = useState<boolean>(settings.validateSsl);
  const [proxyMode, setProxyMode] = useState<ProxyModeSetting>(settings.proxyMode);
  const [proxyUrl, setProxyUrl] = useState<string>(settings.proxyUrl);
  const [proxyBypass, setProxyBypass] = useState<string>(settings.proxyBypass);
  const [historyEnabled, setHistoryEnabled] = useState<boolean>(settings.historyEnabled);
  const [historyMaxEntries, setHistoryMaxEntries] = useState<number>(settings.historyMaxEntries);
  const [historyRetentionDays, setHistoryRetentionDays] = useState<number>(
    settings.historyRetentionDays,
  );

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTheme(settings.theme);
      setFontSize(settings.fontSize);
      setEditorFontSize(settings.editorFontSize);
      setRequestTimeoutMs(settings.requestTimeoutMs);
      setFollowRedirects(settings.followRedirects);
      setMaxRedirects(settings.maxRedirects);
      setValidateSsl(settings.validateSsl);
      setProxyMode(settings.proxyMode);
      setProxyUrl(settings.proxyUrl);
      setProxyBypass(settings.proxyBypass);
      setHistoryEnabled(settings.historyEnabled);
      setHistoryMaxEntries(settings.historyMaxEntries);
      setHistoryRetentionDays(settings.historyRetentionDays);
      setSavedSuccess(false);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({
        theme,
        fontSize,
        editorFontSize: Number(editorFontSize) || 13,
        requestTimeoutMs: Number(requestTimeoutMs) || 30000,
        followRedirects,
        maxRedirects: Number(maxRedirects) || 5,
        validateSsl,
        proxyMode,
        proxyUrl: proxyUrl.trim(),
        proxyBypass: proxyBypass.trim(),
        historyEnabled,
        historyMaxEntries: Number(historyMaxEntries) || 1000,
        historyRetentionDays: Number(historyRetentionDays) || 30,
      });
      setSavedSuccess(true);
      addToast({
        type: 'success',
        message: 'Settings saved successfully.',
      });
      setTimeout(() => {
        closeSettings();
      }, 350);
    } catch (err) {
      addToast({
        type: 'error',
        message: `Failed to save settings: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClearHistory = async () => {
    if (
      window.confirm('Are you sure you want to delete all request history? This cannot be undone.')
    ) {
      try {
        await clearHistory();
        addToast({
          type: 'info',
          message: 'All local request history entries have been deleted.',
        });
      } catch (err) {
        addToast({
          type: 'error',
          message: `Clear history failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'General', icon: <Sliders size={15} /> },
    { id: 'request', label: 'Request Defaults', icon: <Clock size={15} /> },
    { id: 'proxy', label: 'Proxy', icon: <Globe size={15} /> },
    { id: 'history', label: 'Privacy & History', icon: <Shield size={15} /> },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeSettings}
      title="Settings"
      size="large"
      primaryAction={{
        label: savedSuccess ? 'Saved!' : saving ? 'Saving...' : 'Save Changes',
        onClick: handleSave,
      }}
      secondaryAction={{
        label: 'Cancel',
        onClick: closeSettings,
      }}
    >
      <div className="-mx-4 -my-4 flex h-[420px] overflow-hidden">
        {/* Navigation Tabs */}
        <div
          className="flex w-48 shrink-0 flex-col gap-1 border-r p-3 select-none"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
        >
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2.5 rounded px-3 py-2 text-left text-[13px] font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-(--accent) font-semibold text-white'
                  : 'text-(--text-muted) hover:bg-(--bg-hover) hover:text-(--text-primary)'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Panel */}
        <div className="flex-1 overflow-y-auto p-6 text-[13px]">
          {/* 1. GENERAL TAB */}
          {activeTab === 'general' && (
            <div className="flex flex-col gap-5">
              <div>
                <h4 className="mb-1 font-semibold text-(--text-primary)">Appearance & Theme</h4>
                <p className="mb-3 text-[12px] text-(--text-muted)">
                  Customize the look and feel of the interface.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`flex flex-col items-center justify-center gap-2 rounded border p-3 text-center transition-colors ${
                      theme === 'dark'
                        ? 'border-(--accent) bg-(--bg-hover) text-(--text-primary)'
                        : 'border-(--border) text-(--text-muted) hover:border-(--text-muted)'
                    }`}
                  >
                    <Moon size={20} />
                    <span className="text-[12px] font-medium">Dark</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`flex flex-col items-center justify-center gap-2 rounded border p-3 text-center transition-colors ${
                      theme === 'light'
                        ? 'border-(--accent) bg-(--bg-hover) text-(--text-primary)'
                        : 'border-(--border) text-(--text-muted) hover:border-(--text-muted)'
                    }`}
                  >
                    <Sun size={20} />
                    <span className="text-[12px] font-medium">Light</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme('system')}
                    className={`flex flex-col items-center justify-center gap-2 rounded border p-3 text-center transition-colors ${
                      theme === 'system'
                        ? 'border-(--accent) bg-(--bg-hover) text-(--text-primary)'
                        : 'border-(--border) text-(--text-muted) hover:border-(--text-muted)'
                    }`}
                  >
                    <Laptop size={20} />
                    <span className="text-[12px] font-medium">System</span>
                  </button>
                </div>
              </div>

              <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                <h4 className="mb-1 font-semibold text-(--text-primary)">Typography & Sizing</h4>
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-medium text-(--text-primary)">UI Font Size</label>
                    <select
                      value={fontSize}
                      onChange={e => setFontSize(e.target.value as FontSizeSetting)}
                      className="h-8 rounded border px-2.5 text-[13px] outline-none"
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        borderColor: 'var(--border)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <option value="small">Small (12px)</option>
                      <option value="medium">Medium (13px)</option>
                      <option value="large">Large (14px)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-medium text-(--text-primary)">
                      Code Editor Font Size (px)
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={24}
                      value={editorFontSize}
                      onChange={e => setEditorFontSize(parseInt(e.target.value, 10) || 13)}
                      className="h-8 rounded border px-2.5 font-mono text-[13px] outline-none"
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        borderColor: 'var(--border)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. REQUEST DEFAULTS TAB */}
          {activeTab === 'request' && (
            <div className="flex flex-col gap-5">
              <div>
                <h4 className="mb-1 font-semibold text-(--text-primary)">
                  Network & Execution Defaults
                </h4>
                <p className="mb-3 text-[12px] text-(--text-muted)">
                  Default behavior applied to sent requests unless explicitly overridden per
                  request.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-(--text-primary)">
                  Default Timeout (milliseconds)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={500}
                    max={300000}
                    step={1000}
                    value={requestTimeoutMs}
                    onChange={e => setRequestTimeoutMs(parseInt(e.target.value, 10) || 30000)}
                    className="h-8 w-48 rounded border px-2.5 font-mono text-[13px] outline-none"
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <span className="text-[12px] text-(--text-muted)">
                    ({Math.round(requestTimeoutMs / 1000)} seconds)
                  </span>
                </div>
              </div>

              <div
                className="flex items-center justify-between rounded border p-3"
                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-(--text-primary)">Follow HTTP Redirects</span>
                  <span className="text-[12px] text-(--text-muted)">
                    Automatically follow 3xx HTTP redirect responses.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={followRedirects}
                  onChange={e => setFollowRedirects(e.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded accent-(--accent)"
                />
              </div>

              {followRedirects && (
                <div className="flex flex-col gap-1.5 pl-3">
                  <label className="font-medium text-(--text-primary)">Maximum Redirect Hops</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={maxRedirects}
                    onChange={e => setMaxRedirects(parseInt(e.target.value, 10) || 5)}
                    className="h-8 w-32 rounded border px-2.5 font-mono text-[13px] outline-none"
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              )}

              <div
                className="flex items-center justify-between rounded border p-3"
                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-(--text-primary)">
                    Validate SSL / TLS Certificates
                  </span>
                  <span className="text-[12px] text-(--text-muted)">
                    Reject requests if HTTPS certificate validation fails (recommended enabled).
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={validateSsl}
                  onChange={e => setValidateSsl(e.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded accent-(--accent)"
                />
              </div>
            </div>
          )}

          {/* 3. PROXY TAB */}
          {activeTab === 'proxy' && (
            <div className="flex flex-col gap-5">
              <div>
                <h4 className="mb-1 font-semibold text-(--text-primary)">Proxy Configuration</h4>
                <p className="mb-3 text-[12px] text-(--text-muted)">
                  Route HTTP and HTTPS outbound requests through a proxy server.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label
                  className="flex cursor-pointer items-center gap-3 rounded border p-2.5 hover:bg-(--bg-hover)"
                  style={{ borderColor: proxyMode === 'none' ? 'var(--accent)' : 'var(--border)' }}
                >
                  <input
                    type="radio"
                    name="proxyMode"
                    value="none"
                    checked={proxyMode === 'none'}
                    onChange={() => setProxyMode('none')}
                    className="accent-(--accent)"
                  />
                  <div>
                    <div className="font-medium text-(--text-primary)">
                      No Proxy (Direct Connection)
                    </div>
                    <div className="text-[12px] text-(--text-muted)">
                      Send requests directly to target endpoints without any proxy.
                    </div>
                  </div>
                </label>

                <label
                  className="flex cursor-pointer items-center gap-3 rounded border p-2.5 hover:bg-(--bg-hover)"
                  style={{
                    borderColor: proxyMode === 'system' ? 'var(--accent)' : 'var(--border)',
                  }}
                >
                  <input
                    type="radio"
                    name="proxyMode"
                    value="system"
                    checked={proxyMode === 'system'}
                    onChange={() => setProxyMode('system')}
                    className="accent-(--accent)"
                  />
                  <div>
                    <div className="font-medium text-(--text-primary)">Use System Proxy</div>
                    <div className="text-[12px] text-(--text-muted)">
                      Read proxy settings from environment variables (
                      <code className="text-(--accent)">HTTP_PROXY</code>,{' '}
                      <code className="text-(--accent)">HTTPS_PROXY</code>,{' '}
                      <code className="text-(--accent)">NO_PROXY</code>).
                    </div>
                  </div>
                </label>

                <label
                  className="flex cursor-pointer items-center gap-3 rounded border p-2.5 hover:bg-(--bg-hover)"
                  style={{
                    borderColor: proxyMode === 'manual' ? 'var(--accent)' : 'var(--border)',
                  }}
                >
                  <input
                    type="radio"
                    name="proxyMode"
                    value="manual"
                    checked={proxyMode === 'manual'}
                    onChange={() => setProxyMode('manual')}
                    className="accent-(--accent)"
                  />
                  <div>
                    <div className="font-medium text-(--text-primary)">
                      Manual Proxy Configuration
                    </div>
                    <div className="text-[12px] text-(--text-muted)">
                      Specify a custom HTTP/HTTPS proxy server host and port.
                    </div>
                  </div>
                </label>
              </div>

              {proxyMode === 'manual' && (
                <div
                  className="flex flex-col gap-3 border-l-2 pt-2 pl-3"
                  style={{ borderColor: 'var(--accent)' }}
                >
                  <div className="flex flex-col gap-1.5">
                    <label className="font-medium text-(--text-primary)">Proxy Server URL</label>
                    <input
                      type="text"
                      placeholder="http://proxy.company.internal:8080"
                      value={proxyUrl}
                      onChange={e => setProxyUrl(e.target.value)}
                      className="h-8 rounded border px-2.5 font-mono text-[13px] outline-none"
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        borderColor: 'var(--border)',
                        color: 'var(--text-primary)',
                      }}
                    />
                    <span className="text-[11px] text-(--text-muted)">
                      Supports basic authentication:{' '}
                      <code className="text-(--accent)">http://user:password@host:port</code>
                    </span>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1.5 pt-2">
                <label className="font-medium text-(--text-primary)">
                  Bypass Proxy For (NO_PROXY)
                </label>
                <input
                  type="text"
                  placeholder="localhost, 127.0.0.1, ::1, *.internal.net"
                  value={proxyBypass}
                  onChange={e => setProxyBypass(e.target.value)}
                  className="h-8 rounded border px-2.5 font-mono text-[13px] outline-none"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
                <span className="text-[11px] text-(--text-muted)">
                  Comma-separated list of domains or IP addresses that bypass the proxy. Wildcards
                  (e.g. *.example.com) supported.
                </span>
              </div>
            </div>
          )}

          {/* 4. PRIVACY & HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="flex flex-col gap-5">
              <div>
                <h4 className="mb-1 font-semibold text-(--text-primary)">
                  Privacy & Request History
                </h4>
                <p className="mb-3 text-[12px] text-(--text-muted)">
                  Configure local SQLite history recording and automatic retention cleanup.
                </p>
              </div>

              <div
                className="flex items-center justify-between rounded border p-3"
                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-(--text-primary)">Record Request History</span>
                  <span className="text-[12px] text-(--text-muted)">
                    Automatically log sent requests, headers, and responses to local SQLite storage.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={historyEnabled}
                  onChange={e => setHistoryEnabled(e.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded accent-(--accent)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-medium text-(--text-primary)">Maximum Saved Entries</label>
                  <input
                    type="number"
                    min={10}
                    max={10000}
                    step={50}
                    value={historyMaxEntries}
                    onChange={e => setHistoryMaxEntries(parseInt(e.target.value, 10) || 1000)}
                    className="h-8 rounded border px-2.5 font-mono text-[13px] outline-none"
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <span className="text-[11px] text-(--text-muted)">
                    Older entries are automatically pruned.
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-medium text-(--text-primary)">
                    Retention Period (Days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={historyRetentionDays}
                    onChange={e => setHistoryRetentionDays(parseInt(e.target.value, 10) || 30)}
                    className="h-8 rounded border px-2.5 font-mono text-[13px] outline-none"
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <span className="text-[11px] text-(--text-muted)">
                    Entries older than this are deleted automatically.
                  </span>
                </div>
              </div>

              <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                <h4 className="mb-1 font-semibold text-(--status-err)">Clear Stored Data</h4>
                <p className="mb-3 text-[12px] text-(--text-muted)">
                  Wipe all recorded history from the local database immediately.
                </p>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="flex items-center gap-2 rounded border border-(--status-err) px-3 py-1.5 text-[13px] font-medium text-(--status-err) transition-colors hover:bg-(--status-err)/10"
                >
                  <Trash2 size={14} />
                  Clear All History Now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
