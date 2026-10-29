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
      className="shadow-elevation transition-fast fixed z-50 min-w-45 rounded-md border py-1 select-none"
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
            className={`transition-fast app-focus-ring flex h-7 w-full items-center justify-between px-3 text-left text-[13px] ${
              item.disabled
                ? 'cursor-not-allowed opacity-50'
                : 'cursor-pointer hover:bg-(--bg-active)'
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
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {item.icon}
                </span>
              )}
              <span className="truncate">{item.label}</span>
            </div>

            {item.shortcut && (
              <span
                className="ml-3 shrink-0 font-mono text-[11px]"
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
