import React from 'react';
import { Modal } from './ui/Modal';
import { useHistoryStore } from '../stores/historyStore';
import { AlertTriangle } from 'lucide-react';

export function ClearHistoryConfirmModal(): React.JSX.Element | null {
  const { isConfirmClearOpen, setIsConfirmClearOpen, clearHistory, total } = useHistoryStore();

  if (!isConfirmClearOpen) return null;

  return (
    <Modal
      isOpen={isConfirmClearOpen}
      onClose={() => setIsConfirmClearOpen(false)}
      title="Clear Request History"
      size="small"
      primaryAction={{
        label: 'Clear All History',
        onClick: clearHistory,
        variant: 'danger',
      }}
      secondaryAction={{
        label: 'Cancel',
        onClick: () => setIsConfirmClearOpen(false),
      }}
    >
      <div className="flex items-start gap-3 py-2 text-[13px]">
        <div className="p-2 rounded-full bg-[var(--status-err-bg)] text-[var(--status-err)] shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="font-semibold text-[var(--text-primary)]">
            Are you sure you want to clear your history?
          </span>
          <span className="text-[var(--text-secondary)] leading-relaxed">
            This will permanently delete all {total > 0 ? `${total} ` : ''}saved request and
            response entries from SQLite storage. This action cannot be undone.
          </span>
        </div>
      </div>
    </Modal>
  );
}
