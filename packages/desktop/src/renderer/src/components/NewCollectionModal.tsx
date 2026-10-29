import React, { useState, useRef, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { Folder } from 'lucide-react';

export interface NewCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, targetDir?: string) => Promise<void>;
}

export function NewCollectionModal({
  isOpen,
  onClose,
  onCreate,
}: NewCollectionModalProps): React.JSX.Element | null {
  const [name, setName] = useState('');
  const [targetDir, setTargetDir] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setTargetDir('');
      setError(null);
      setTimeout(() => {
        nameInputRef.current?.focus();
        nameInputRef.current?.select();
      }, 50);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Collection name cannot be empty');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onCreate(name.trim(), targetDir.trim() || undefined);
      setName('');
      setTargetDir('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleBrowse = async () => {
    // If targetDir is left blank, the native directory picker opens automatically upon creation
    setTargetDir('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Collection"
      size="default"
      primaryAction={{
        label: loading ? 'Creating...' : 'Create Collection',
        onClick: handleSubmit,
        disabled: loading || !name.trim(),
      }}
      secondaryAction={{
        label: 'Cancel',
        onClick: onClose,
      }}
    >
      <div className="space-y-4 text-[13px]">
        <div>
          <label className="mb-1.5 block font-medium" style={{ color: 'var(--text-primary)' }}>
            Collection Name
          </label>
          <input
            ref={nameInputRef}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSubmit();
            }}
            placeholder="e.g. My API Services"
            className="app-focus-ring h-8 w-full rounded-sm border bg-transparent px-2.5 text-[13px] outline-none"
            style={{
              backgroundColor: 'var(--bg-input)',
              borderColor: 'var(--border-strong)',
              color: 'var(--text-primary)',
            }}
            autoFocus
          />
          <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Reqit will create a <code className="font-mono">reqit.yaml</code> descriptor file in the
            selected folder.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block font-medium" style={{ color: 'var(--text-primary)' }}>
            Destination Directory <span className="text-[11px] font-normal">(Optional)</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={targetDir}
              onChange={e => setTargetDir(e.target.value)}
              placeholder="Leave empty to choose folder via dialog"
              className="app-focus-ring h-8 flex-1 rounded-sm border bg-transparent px-2.5 font-mono text-[12px] outline-none"
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
            />
            <button
              type="button"
              onClick={handleBrowse}
              className="transition-fast flex h-8 items-center gap-1.5 rounded-sm border px-3 text-[12px] font-medium hover:bg-(--bg-hover)"
              style={{
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
            >
              <Folder className="h-3.5 w-3.5" />
              Browse
            </button>
          </div>
        </div>

        {error && (
          <div
            className="rounded-sm p-2 text-[12px]"
            style={{
              backgroundColor: 'var(--status-err-bg)',
              color: 'var(--status-err-fg)',
              border: '1px solid var(--status-err)',
            }}
          >
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
