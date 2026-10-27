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

  const getVariantStyles = (): React.CSSProperties => {
    if (isDisabled) {
      return {
        backgroundColor: variant === 'ghost' ? 'transparent' : 'var(--bg-muted)',
        color: 'var(--text-disabled)',
        border: '1px solid var(--border)',
        cursor: 'not-allowed',
      };
    }

    switch (variant) {
      case 'primary':
        return {
          backgroundColor: 'var(--accent)',
          color: 'var(--accent-fg)',
          border: '1px solid var(--accent)',
        };
      case 'secondary':
        return {
          backgroundColor: 'var(--bg-muted)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: 'var(--text-secondary)',
          border: '1px solid transparent',
        };
      case 'danger':
        return {
          backgroundColor: 'var(--danger)',
          color: '#ffffff',
          border: '1px solid var(--danger)',
        };
    }
  };

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      className={`inline-flex items-center justify-center font-normal transition-fast select-none app-focus-ring ${sizeClasses[size]} ${className}`}
      style={{
        borderRadius: 'var(--radius-sm)',
        ...getVariantStyles(),
        ...style,
      }}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin spin-allowed" strokeWidth={1.5} />
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
