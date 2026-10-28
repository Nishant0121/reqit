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
          <CheckCircle className="w-4 h-4" style={{ color: 'var(--success)' }} strokeWidth={1.5} />
        );
      case 'warning':
        return (
          <AlertTriangle
            className="w-4 h-4"
            style={{ color: 'var(--warning)' }}
            strokeWidth={1.5}
          />
        );
      case 'error':
        return (
          <AlertCircle className="w-4 h-4" style={{ color: 'var(--danger)' }} strokeWidth={1.5} />
        );
      default:
        return <Info className="w-4 h-4" style={{ color: 'var(--info)' }} strokeWidth={1.5} />;
    }
  };

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="fixed bottom-8 right-6 z-50 flex flex-col gap-2 max-w-sm pointer-events-none select-none"
    >
      {visibleToasts.map(toast => (
        <div
          key={toast.id}
          role="status"
          className="pointer-events-auto flex items-center justify-between gap-3 p-3 rounded-[6px] border shadow-elevation transition-panel animate-in fade-in"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
          }}
        >
          <div className="flex items-center gap-2.5 truncate">
            {getIcon(toast.type)}
            <span className="text-[13px] leading-snug truncate">{toast.message}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {toast.undoAction && (
              <button
                type="button"
                onClick={() => {
                  toast.undoAction?.();
                  onDismiss(toast.id);
                }}
                className="text-[12px] font-medium underline hover:text-[var(--accent)] transition-fast"
                style={{ color: 'var(--accent)' }}
              >
                {toast.undoLabel || 'Undo'}
              </button>
            )}

            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="p-1 rounded-[4px] hover:bg-[var(--bg-active)] transition-fast"
              style={{ color: 'var(--text-muted)' }}
              title="Dismiss notification"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
