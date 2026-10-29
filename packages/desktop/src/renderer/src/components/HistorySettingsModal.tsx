import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { useHistoryStore } from '../stores/historyStore';

export function HistorySettingsModal(): React.JSX.Element | null {
  const { isSettingsOpen, setIsSettingsOpen, settings, updateSettings } = useHistoryStore();

  const [enabled, setEnabled] = useState(settings.enabled);
  const [maxEntries, setMaxEntries] = useState(settings.maxEntries);
  const [retentionDays, setRetentionDays] = useState(settings.retentionDays);

  useEffect(() => {
    if (isSettingsOpen) {
      setEnabled(settings.enabled);
      setMaxEntries(settings.maxEntries);
      setRetentionDays(settings.retentionDays);
    }
  }, [isSettingsOpen, settings]);

  if (!isSettingsOpen) return null;

  const handleSave = async () => {
    await updateSettings({
      enabled,
      maxEntries: Number(maxEntries) || 1000,
      retentionDays: Number(retentionDays) || 30,
    });
    setIsSettingsOpen(false);
  };

  return (
    <Modal
      isOpen={isSettingsOpen}
      onClose={() => setIsSettingsOpen(false)}
      title="History Settings"
      size="default"
      primaryAction={{
        label: 'Save Changes',
        onClick: handleSave,
      }}
      secondaryAction={{
        label: 'Cancel',
        onClick: () => setIsSettingsOpen(false),
      }}
    >
      <div className="flex flex-col gap-5 py-2 text-[13px]">
        {/* Enable / Disable toggle */}
        <div
          className="flex items-start justify-between gap-4 rounded border p-3"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
        >
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-(--text-primary)">Record Request History</span>
            <span className="text-[12px] text-(--text-muted)">
              Automatically save sent requests and responses to local SQLite storage.
            </span>
            {!enabled && (
              <span className="text-[12px] font-medium text-(--status-err)">
                History is currently disabled. No requests will be stored.
              </span>
            )}
          </div>

          <label className="relative mt-1 inline-flex shrink-0 cursor-pointer items-center">
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-gray-600 peer-checked:bg-(--accent) peer-focus:outline-none after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
          </label>
        </div>

        {/* Max Entries */}
        <div className="flex flex-col gap-1.5">
          <label className="font-medium text-(--text-primary)">Maximum Saved Entries</label>
          <input
            type="number"
            min={10}
            max={10000}
            step={50}
            value={maxEntries}
            onChange={e => setMaxEntries(parseInt(e.target.value, 10) || 1000)}
            className="h-8 w-full rounded border px-2.5 font-mono text-[13px] outline-none"
            style={{
              backgroundColor: 'var(--bg-input)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
          />
          <span className="text-[11px] text-(--text-muted)">
            Reqit automatically prunes the oldest entries beyond this limit. Default: 1,000.
          </span>
        </div>

        {/* Retention Days */}
        <div className="flex flex-col gap-1.5">
          <label className="font-medium text-(--text-primary)">Retention Period (days)</label>
          <input
            type="number"
            min={1}
            max={365}
            step={1}
            value={retentionDays}
            onChange={e => setRetentionDays(parseInt(e.target.value, 10) || 30)}
            className="h-8 w-full rounded border px-2.5 font-mono text-[13px] outline-none"
            style={{
              backgroundColor: 'var(--bg-input)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
          />
          <span className="text-[11px] text-(--text-muted)">
            Entries older than this duration are pruned automatically. Default: 30 days.
          </span>
        </div>
      </div>
    </Modal>
  );
}
