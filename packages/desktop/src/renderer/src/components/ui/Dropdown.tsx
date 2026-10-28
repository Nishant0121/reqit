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
          className={`absolute top-full mt-1 z-50 min-w-[180px] py-1 rounded-[6px] border shadow-elevation select-none transition-fast ${
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
      )}
    </div>
  );
}
