import React, { useState, useRef, useEffect } from 'react';

export interface DropdownItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  destructive?: boolean;
  disabled?: boolean;
  separator?: boolean;
  onClick?: () => void;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
}

export function Dropdown({
  trigger,
  items,
  align = 'left',
  className = '',
}: DropdownProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <div onClick={() => setIsOpen(prev => !prev)} className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div
          role="menu"
          className={`shadow-elevation transition-fast absolute top-full z-50 mt-1 min-w-45 rounded-md border py-1 select-none ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          style={{
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
                  setIsOpen(false);
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
      )}
    </div>
  );
}
