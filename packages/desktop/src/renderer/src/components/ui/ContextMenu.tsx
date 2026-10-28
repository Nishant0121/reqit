import React, { useEffect, useRef } from 'react';
import type { DropdownItem } from './Dropdown';

export interface ContextMenuProps {
  isOpen: boolean;
  x: number;
  y: number;
  items: DropdownItem[];
  onClose: () => void;
}

export function ContextMenu({
  isOpen,
  x,
  y,
  items,
  onClose,
}: ContextMenuProps): React.JSX.Element | null {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Ensure menu stays within window bounds
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - items.length * 28 - 20);

  return (
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-50 min-w-[180px] py-1 rounded-[6px] border shadow-elevation select-none transition-fast"
      style={{
        left: `${adjustedX}px`,
        top: `${adjustedY}px`,
        backgroundColor: 'var(--bg-elevated)',
        borderColor: 'var(--border)',
      }}
    >
      {items.map((item, idx) => {
        if (item.separator) {
          return (
            <div
              key={`sep-${idx}`}
              className="my-1 border-t"
              style={{ borderColor: 'var(--border)' }}
            />
          );
        }

        return (
          <button
            key={item.id}
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return;
              item.onClick?.();
              onClose();
            }}
            className={`w-full h-[28px] px-3 flex items-center justify-between text-[13px] text-left transition-fast app-focus-ring ${
              item.disabled
                ? 'cursor-not-allowed opacity-50'
                : 'hover:bg-[var(--bg-active)] cursor-pointer'
            }`}
            style={{
              color: item.destructive
                ? 'var(--danger)'
                : item.disabled
                  ? 'var(--text-disabled)'
                  : 'var(--text-primary)',
            }}
          >
            <div className="flex items-center gap-2 truncate">
              {item.icon && (
                <span className="w-4 h-4 flex items-center justify-center shrink-0">
                  {item.icon}
                </span>
              )}
              <span className="truncate">{item.label}</span>
            </div>

            {item.shortcut && (
              <span
                className="ml-3 text-[11px] font-mono shrink-0"
                style={{ color: 'var(--text-muted)' }}
              >
                {item.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
