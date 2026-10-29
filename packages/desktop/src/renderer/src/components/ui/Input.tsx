import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  inputSize?: 'default' | 'large';
  error?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    inputSize = 'default',
    error,
    leftIcon,
    rightElement,
    className = '',
    style,
    disabled,
    ...props
  },
  ref,
) {
  const heightClass = inputSize === 'large' ? 'h-[32px]' : 'h-[28px]';

  return (
    <div className="flex w-full flex-col">
      <div
        className={`transition-fast relative flex w-full items-center ${heightClass}`}
        style={{
          backgroundColor: 'var(--bg-input)',
          border: `1px solid ${error ? 'var(--danger)' : 'var(--border-strong)'}`,
          borderRadius: 'var(--radius-sm)',
        }}
      >
        {leftIcon && (
          <div
            className="pointer-events-none flex items-center justify-center pl-2.5"
            style={{ color: 'var(--text-muted)' }}
          >
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          disabled={disabled}
          className={`app-focus-ring transition-fast h-full w-full bg-transparent px-2.5 text-[13px] outline-none ${
            leftIcon ? 'pl-2' : ''
          } ${rightElement ? 'pr-8' : ''} ${className}`}
          style={{
            color: disabled ? 'var(--text-disabled)' : 'var(--text-primary)',
            ...style,
          }}
          {...props}
        />
        {rightElement && <div className="absolute right-1 flex items-center">{rightElement}</div>}
      </div>
      {error && (
        <span className="mt-1 text-[12px] leading-4" style={{ color: 'var(--danger)' }}>
          {error}
        </span>
      )}
    </div>
  );
});
