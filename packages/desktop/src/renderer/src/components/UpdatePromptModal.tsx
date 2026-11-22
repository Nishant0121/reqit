import React from 'react';
import {
  Sparkles,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { MarkdownViewer } from './MarkdownViewer';
import type { UpdateStatus } from '../../../shared/ipc-types';

export interface UpdatePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: UpdateStatus;
  onDownload: () => void;
  onInstall: () => void;
  onCheckAgain: () => void;
}

export function UpdatePromptModal({
  isOpen,
  onClose,
  status,
  onDownload,
  onInstall,
  onCheckAgain,
}: UpdatePromptModalProps): React.JSX.Element | null {
  if (!isOpen) return null;

  const isAvailable = status.status === 'available';
  const isDownloading = status.status === 'downloading';
  const isDownloaded = status.status === 'downloaded';
  const isChecking = status.status === 'checking';
  const isNotAvailable = status.status === 'not-available';
  const isError = status.status === 'error';

  const modalTitle = isDownloaded
    ? 'Update Ready to Install'
    : isAvailable
      ? `Update Available: v${status.version}`
      : isDownloading
        ? `Downloading Update v${status.version}...`
        : isError
          ? 'Update Error'
          : 'Software Update';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      size="default"
      customFooter={
        <div className="flex w-full items-center justify-between">
          <span className="font-mono text-[11px] text-(--text-muted)">
            Current version: v{status.currentVersion}
          </span>
          <div className="flex items-center gap-2">
            {isAvailable && (
              <>
                <Button variant="secondary" size="compact" onClick={onClose}>
                  Remind Me Later
                </Button>
                <Button variant="primary" size="compact" onClick={onDownload}>
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Update</span>
                </Button>
              </>
            )}

            {isDownloaded && (
              <>
                <Button variant="secondary" size="compact" onClick={onClose}>
                  Install on Exit
                </Button>
                <Button variant="primary" size="compact" onClick={onInstall}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Restart & Install Now</span>
                </Button>
              </>
            )}

            {(isNotAvailable || isError) && (
              <>
                <Button variant="secondary" size="compact" onClick={onClose}>
                  Close
                </Button>
                <Button
                  variant="primary"
                  size="compact"
                  onClick={onCheckAgain}
                  disabled={isChecking}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{isChecking ? 'Checking...' : 'Check Again'}</span>
                </Button>
              </>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-[12px]">
        {/* Update Available View */}
        {isAvailable && (
          <div>
            <div className="mb-3 flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-emerald-400">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>
                A new version of Reqit (<strong>v{status.version}</strong>) is ready to download!
              </span>
            </div>

            {status.releaseNotes && (
              <div className="space-y-1">
                <span className="block font-medium text-(--text-secondary)">Release Notes:</span>
                <div
                  className="max-h-48 overflow-y-auto rounded border p-3"
                  style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)' }}
                >
                  <MarkdownViewer content={status.releaseNotes} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Downloading View */}
        {isDownloading && (
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-(--text-secondary)">Downloading v{status.version}...</span>
              <span className="font-semibold text-(--accent)">{status.percent ?? 0}%</span>
            </div>

            {/* Progress Bar */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-(--bg-elevated)">
              <div
                className="h-full bg-(--accent) transition-all duration-200"
                style={{ width: `${status.percent || 0}%` }}
              />
            </div>

            {status.bytesPerSecond && (
              <div className="flex items-center justify-between text-[11px] text-(--text-muted)">
                <span>
                  {Math.round((status.transferred || 0) / 1024 / 1024)} MB of{' '}
                  {Math.round((status.total || 0) / 1024 / 1024)} MB
                </span>
                <span>{Math.round((status.bytesPerSecond || 0) / 1024)} KB/s</span>
              </div>
            )}
          </div>
        )}

        {/* Downloaded / Ready to Install */}
        {isDownloaded && (
          <div className="flex items-center gap-3 rounded border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-400">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Update Downloaded & Verified</p>
              <p className="text-[11px] text-emerald-300">
                Restart Reqit now to apply version <strong>v{status.version}</strong>. Your open
                collections and tabs will be restored.
              </p>
            </div>
          </div>
        )}

        {/* Up-to-Date View */}
        {isNotAvailable && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-500" />
            <p className="text-[13px] font-semibold text-(--text-primary)">
              You&apos;re up to date!
            </p>
            <p className="mt-1 text-[11px] text-(--text-muted)">
              Reqit v{status.currentVersion} is currently the newest version available.
            </p>
          </div>
        )}

        {/* Error View */}
        {isError && (
          <div className="flex items-start gap-2.5 rounded border border-rose-500/30 bg-rose-500/10 p-3 text-rose-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Update Check Failed</p>
              <p className="text-[11px] text-rose-300">
                {status.error || 'Unable to connect to release server.'}
              </p>
              <a
                href="https://github.com/Nishant0121/reqit/releases"
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-(--accent) hover:underline"
              >
                <span>Check GitHub Releases Manually</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
