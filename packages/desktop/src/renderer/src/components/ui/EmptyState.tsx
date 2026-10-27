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
          className="w-10 h-10 flex items-center justify-center mb-3"
          style={{ color: 'var(--text-muted)' }}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <h3 className="text-[14px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h3>
      <p
        className="text-[12px] max-w-sm mb-4 leading-normal"
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
