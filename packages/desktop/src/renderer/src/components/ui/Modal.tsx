import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

export type ModalSize = 'small' | 'default' | 'large';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: ModalSize;
  children: React.ReactNode;
  primaryAction?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'danger';
    loading?: boolean;
    disabled?: boolean;
  };
  secondaryAction?: {
    label: string;
    onClick?: () => void;
  };
}

export function Modal({
  isOpen,
  onClose,
  title,
  size = 'default',
  children,
  primaryAction,
  secondaryAction,
}: ModalProps): React.JSX.Element | null {
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
      modalRef.current?.focus();

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
        if (
          e.key === 'Enter' &&
          primaryAction &&
          !primaryAction.disabled &&
          !primaryAction.loading
        ) {
          const target = e.target as HTMLElement;
          if (target.tagName !== 'TEXTAREA' && target.tagName !== 'BUTTON') {
            e.preventDefault();
            primaryAction.onClick();
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        previouslyFocusedRef.current?.focus();
      };
    }
  }, [isOpen, onClose, primaryAction]);

  if (!isOpen) return null;

  const widthMap: Record<ModalSize, string> = {
    small: 'max-w-[480px]',
    default: 'max-w-[640px]',
    large: 'max-w-[800px]',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-fast"
      style={{ backgroundColor: 'var(--bg-overlay)' }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`w-full ${widthMap[size]} max-h-[80vh] flex flex-col rounded-[8px] border shadow-elevation outline-none transition-panel overflow-hidden`}
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0 select-none"
          style={{ borderColor: 'var(--border)' }}
        >
          <h2
            id="modal-title"
            className="text-[16px] leading-[24px] font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 inline-flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-fast app-focus-ring"
            title="Close dialog (Escape)"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Body */}
        <div
          className="p-6 overflow-y-auto flex-1 text-[13px] leading-[20px]"
          style={{ color: 'var(--text-primary)' }}
        >
          {children}
        </div>

        {/* Footer */}
        {(primaryAction || secondaryAction) && (
          <div
            className="flex items-center justify-end gap-3 px-6 py-3 border-t shrink-0 select-none"
            style={{
              borderColor: 'var(--border)',
              backgroundColor: 'var(--bg-surface)',
            }}
          >
            {secondaryAction && (
              <Button
                variant="secondary"
                size="default"
                onClick={secondaryAction.onClick || onClose}
              >
                {secondaryAction.label}
              </Button>
            )}
            {primaryAction && (
              <Button
                variant={primaryAction.variant || 'primary'}
                size="default"
                loading={primaryAction.loading}
                disabled={primaryAction.disabled}
                onClick={primaryAction.onClick}
              >
                {primaryAction.label}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
