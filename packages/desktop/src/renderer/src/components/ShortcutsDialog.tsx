import React from 'react';
import { Modal } from './ui/Modal';
import { getEffectiveShortcuts, formatKeyCombination } from '../lib/shortcuts';
import { useSettingsStore } from '../stores/settingsStore';
import { Settings } from 'lucide-react';

export interface ShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutsDialog({
  isOpen,
  onClose,
}: ShortcutsDialogProps): React.JSX.Element | null {
  const customShortcuts = useSettingsStore(s => s.settings.customShortcuts);
  const openSettings = useSettingsStore(s => s.openSettings);
  const effectiveShortcuts = getEffectiveShortcuts(customShortcuts);
  const sections = ['Request', 'Navigation', 'General'] as const;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard shortcuts" size="default">
      <div className="space-y-6">
        {sections.map(section => {
          const items = effectiveShortcuts.filter(s => s.section === section);
          if (items.length === 0) return null;

          return (
            <div key={section} className="space-y-2">
              <h3
                className="text-[12px] font-semibold tracking-wider uppercase"
                style={{ color: 'var(--text-secondary)' }}
              >
                {section}
              </h3>
              <div
                className="divide-y rounded-sm border"
                style={{
                  borderColor: 'var(--border)',
                  backgroundColor: 'var(--bg-surface)',
                }}
              >
                {items.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-3 py-2 text-[13px]"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {item.name}
                      </span>
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {item.description}
                      </p>
                    </div>

                    <kbd
                      className="shrink-0 rounded-sm border px-2 py-0.5 font-mono text-[11px] font-semibold select-none"
                      style={{
                        backgroundColor: 'var(--bg-elevated)',
                        borderColor: 'var(--border-strong)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {formatKeyCombination(item.keyCombination)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              openSettings('shortcuts');
            }}
            className="transition-fast flex cursor-pointer items-center gap-1.5 text-[12px] font-medium text-(--text-secondary) hover:text-(--accent)"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Customize shortcuts in Settings</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
