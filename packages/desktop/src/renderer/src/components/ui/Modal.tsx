import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

export type ModalSize = 'small' | 'default' | 'large' | 'xlarge';

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
  customFooter?: React.ReactNode;
}

export function Modal({
  isOpen,
  onClose,
  title,
  size = 'default',
  children,
  primaryAction,
  secondaryAction,
  customFooter,
}: ModalProps): React.JSX.Element | null {
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const primaryActionRef = useRef(primaryAction);
  primaryActionRef.current = primaryAction;

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

      // Only focus the dialog wrapper if activeElement is outside the modal
      if (!modalRef.current?.contains(document.activeElement)) {
        modalRef.current?.focus();
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onCloseRef.current();
        }
        if (
          e.key === 'Enter' &&
          primaryActionRef.current &&
          !primaryActionRef.current.disabled &&
          !primaryActionRef.current.loading
        ) {
          const target = e.target as HTMLElement;
          if (target.tagName !== 'TEXTAREA' && target.tagName !== 'BUTTON') {
            e.preventDefault();
            primaryActionRef.current.onClick();
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        previouslyFocusedRef.current?.focus();
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const widthMap: Record<ModalSize, string> = {
    small: 'max-w-[480px]',
    default: 'max-w-[640px]',
    large: 'max-w-[800px]',
    xlarge: 'max-w-[960px]',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="transition-fast fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--bg-overlay)' }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`w-full ${widthMap[size]} shadow-elevation transition-panel flex max-h-[80vh] flex-col overflow-hidden rounded-lg border outline-none`}
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border)',
        }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between border-b px-6 py-4 select-none"
          style={{ borderColor: 'var(--border)' }}
        >
          <h2
            id="modal-title"
            className="text-[16px] leading-6 font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="transition-fast app-focus-ring inline-flex h-8 w-8 items-center justify-center rounded-sm text-(--text-muted) hover:bg-(--bg-hover) hover:text-(--text-primary)"
            title="Close dialog (Escape)"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Body */}
        <div
          className="flex-1 overflow-y-auto p-6 text-[13px] leading-5"
          style={{ color: 'var(--text-primary)' }}
        >
          {children}
        </div>

        {/* Footer */}
        {customFooter ? (
          <div
            className="flex shrink-0 items-center justify-end gap-3 border-t px-6 py-3 select-none"
            style={{
              borderColor: 'var(--border)',
              backgroundColor: 'var(--bg-surface)',
            }}
          >
            {customFooter}
          </div>
        ) : (
          (primaryAction || secondaryAction) && (
            <div
              className="flex shrink-0 items-center justify-end gap-3 border-t px-6 py-3 select-none"
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
          )
        )}
      </div>
    </div>
  );
}
