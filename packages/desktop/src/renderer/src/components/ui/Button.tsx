import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'compact' | 'default' | 'large';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'default',
    loading = false,
    icon,
    disabled,
    children,
    className = '',
    style,
    ...props
  },
  ref,
) {
  const isDisabled = disabled || loading;

  const sizeClasses: Record<ButtonSize, string> = {
    compact: 'h-[24px] px-2 text-[11px] gap-1.5',
    default: 'h-[28px] px-3 text-[13px] gap-2',
    large: 'h-[32px] px-4 text-[14px] gap-2 font-medium',
  };

  const variantClasses: Record<ButtonVariant, string> = {
    primary:
      'bg-[var(--accent-strong)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] border border-[var(--accent-strong)]',
    secondary:
      'bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--bg-active)] border border-[var(--border)]',
    ghost:
      'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border border-transparent',
    danger:
      'bg-[var(--danger-solid)] text-white hover:bg-[var(--danger-solid-hover)] border border-[var(--danger-solid)]',
  };

  const disabledStyles: React.CSSProperties = isDisabled
    ? {
        backgroundColor: variant === 'ghost' ? 'transparent' : 'var(--bg-elevated)',
        color: 'var(--text-disabled)',
        borderColor: variant === 'ghost' ? 'transparent' : 'var(--border)',
        cursor: 'not-allowed',
        opacity: 0.6,
      }
    : {};

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      className={`inline-flex items-center justify-center font-normal transition-fast select-none app-focus-ring ${
        sizeClasses[size]
      } ${variantClasses[variant]} ${className}`}
      style={{
        borderRadius: 'var(--radius-sm)',
        ...style,
        ...disabledStyles,
      }}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin spin-allowed" strokeWidth={1.75} />
          {children}
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
});
