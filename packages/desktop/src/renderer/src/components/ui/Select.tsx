import React, { forwardRef } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  selectSize?: 'default' | 'large';
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, selectSize = 'default', className = '', style, ...props },
  ref,
) {
  const heightClass = selectSize === 'large' ? 'h-[32px]' : 'h-[28px]';

  return (
    <div
      className={`relative inline-flex items-center ${heightClass}`}
      style={{
        backgroundColor: 'var(--bg-input)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      <select
        ref={ref}
        className={`h-full bg-transparent pl-2.5 pr-6 text-[13px] app-focus-ring outline-none appearance-none cursor-pointer ${className}`}
        style={{
          color: 'var(--text-primary)',
          ...style,
        }}
        {...props}
      >
        {options.map(opt => (
          <option
            key={opt.value}
            value={opt.value}
            style={{
              backgroundColor: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
            }}
          >
            {opt.label}
          </option>
        ))}
      </select>
      <div
        className="absolute right-2 pointer-events-none text-[10px]"
        style={{ color: 'var(--text-muted)' }}
      >
        ▼
      </div>
    </div>
  );
});
