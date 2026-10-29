import React from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps): React.JSX.Element {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center select-none ${className}`}
    >
      {icon && (
        <div
          className="mb-3 flex h-10 w-10 items-center justify-center"
          style={{ color: 'var(--text-muted)' }}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <h3 className="mb-1 text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h3>
      <p
        className="mb-4 max-w-sm text-[12px] leading-normal"
        style={{ color: 'var(--text-muted)' }}
      >
        {description}
      </p>
      {actionLabel && onAction && (
        <Button variant="secondary" size="default" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
