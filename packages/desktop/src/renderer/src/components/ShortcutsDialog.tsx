import React from 'react';
import { Modal } from './ui/Modal';
import { SHORTCUT_REGISTRY, formatKeyCombination } from '../lib/shortcuts';

export interface ShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutsDialog({
  isOpen,
  onClose,
}: ShortcutsDialogProps): React.JSX.Element | null {
  const sections = ['Request', 'Navigation', 'General'] as const;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard shortcuts" size="default">
      <div className="space-y-6">
        {sections.map(section => {
          const items = SHORTCUT_REGISTRY.filter(s => s.section === section);
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
      </div>
    </Modal>
  );
}
