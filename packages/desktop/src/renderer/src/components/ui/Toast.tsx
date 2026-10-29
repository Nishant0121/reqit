import React from 'react';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  undoAction?: () => void;
  undoLabel?: string;
}

export interface ToastProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastProps): React.JSX.Element | null {
  if (toasts.length === 0) return null;

  const visibleToasts = toasts.slice(-3);

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return (
          <CheckCircle
            className="h-5 w-5 shrink-0"
            style={{ color: 'var(--success)' }}
            strokeWidth={1.75}
          />
        );
      case 'warning':
        return (
          <AlertTriangle
            className="h-5 w-5 shrink-0"
            style={{ color: 'var(--warning)' }}
            strokeWidth={1.75}
          />
        );
      case 'error':
        return (
          <AlertCircle
            className="h-5 w-5 shrink-0"
            style={{ color: 'var(--danger)' }}
            strokeWidth={1.75}
          />
        );
      default:
        return (
          <Info className="h-5 w-5 shrink-0" style={{ color: 'var(--info)' }} strokeWidth={1.75} />
        );
    }
  };

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed right-6 bottom-8 z-50 flex max-w-sm flex-col gap-2 select-none"
    >
      {visibleToasts.map(toast => (
        <div
          key={toast.id}
          role="status"
          className="shadow-elevation transition-panel animate-in fade-in pointer-events-auto flex items-center justify-between gap-3 rounded-md border p-3"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
          }}
        >
          <div className="flex items-center gap-2.5 truncate">
            {getIcon(toast.type)}
            <span className="truncate text-[13px] leading-snug">{toast.message}</span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {toast.undoAction && (
              <button
                type="button"
                onClick={() => {
                  toast.undoAction?.();
                  onDismiss(toast.id);
                }}
                className="transition-fast text-[12px] font-medium underline hover:text-(--accent)"
                style={{ color: 'var(--accent)' }}
              >
                {toast.undoLabel || 'Undo'}
              </button>
            )}

            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="transition-fast rounded-sm p-1 hover:bg-(--bg-active)"
              style={{ color: 'var(--text-muted)' }}
              title="Dismiss notification"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
