import React, { useState, useEffect } from 'react';
import {
  Bug,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Cpu,
  HardDrive,
  Clock,
  Terminal,
} from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import type { DiagnosticReport } from '../../../shared/ipc-types';

export interface ReportBugModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ReportBugModal({ isOpen, onClose }: ReportBugModalProps): React.JSX.Element | null {
  const [diagnostics, setDiagnostics] = useState<DiagnosticReport | null>(null);
  const [description, setDescription] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && window.reqitApi) {
      setLoading(true);
      window.reqitApi
        .getDiagnosticReport()
        .then(rep => {
          setDiagnostics(rep);
        })
        .catch(() => {
          // fallback
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  const generateReportMarkdown = (): string => {
    if (!diagnostics) return '';

    return [
      '### Description',
      description.trim() ? description.trim() : '_No description provided._',
      '',
      '### Environment Details',
      `- **Reqit Version**: ${diagnostics.appVersion}`,
      `- **OS**: ${diagnostics.osPlatform} (${diagnostics.osRelease}, ${diagnostics.osArch})`,
      `- **Electron**: ${diagnostics.electronVersion}`,
      `- **Node**: ${diagnostics.nodeVersion}`,
      `- **Chrome**: ${diagnostics.chromeVersion}`,
      `- **Memory (Heap Used)**: ${diagnostics.memoryUsageMb} MB`,
      `- **Uptime**: ${diagnostics.uptimeSeconds}s`,
      '',
      '### Diagnostic Logs (Sanitized)',
      '```',
      ...(diagnostics.sanitizedLogs || []),
      '```',
    ].join('\n');
  };

  const handleCopyReport = async () => {
    const md = generateReportMarkdown();
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenGitHubIssue = () => {
    const md = generateReportMarkdown();
    const title = description.trim()
      ? encodeURIComponent(description.slice(0, 60))
      : encodeURIComponent('[Bug] ');
    const body = encodeURIComponent(md);
    const url = `https://github.com/Nishant0121/reqit/issues/new?title=${title}&body=${body}`;
    window.open(url, '_blank');
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Report a Bug & System Diagnostics"
      size="large"
      customFooter={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-(--text-muted)">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>Tokens, passwords, and sensitive cookies are automatically redacted.</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="compact"
              onClick={handleCopyReport}
              disabled={loading}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{copied ? 'Copied' : 'Copy Diagnostics'}</span>
            </Button>
            <Button
              variant="primary"
              size="compact"
              onClick={handleOpenGitHubIssue}
              disabled={loading}
              title="Open GitHub Issues with prefilled diagnostics"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Open GitHub Issue</span>
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-[12px]">
        <div>
          <label className="mb-1 block font-medium text-(--text-secondary)">
            What happened? (Steps to reproduce, expected vs actual)
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="Describe what you were doing when the issue occurred..."
            className="w-full rounded border p-2 font-sans text-[12px] outline-none focus:border-(--accent)"
            style={{
              backgroundColor: 'var(--bg-input)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        {/* System Specs Overview */}
        {diagnostics && (
          <div
            className="grid grid-cols-2 gap-2 rounded border p-3"
            style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-(--text-muted)" />
              <div>
                <span className="block text-[10px] text-(--text-muted) uppercase">OS & Arch</span>
                <span className="font-mono text-[11px] text-(--text-primary)">
                  {diagnostics.osPlatform} {diagnostics.osRelease} ({diagnostics.osArch})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Bug className="h-4 w-4 text-(--text-muted)" />
              <div>
                <span className="block text-[10px] text-(--text-muted) uppercase">
                  Reqit Version
                </span>
                <span className="font-mono text-[11px] text-(--accent)">
                  v{diagnostics.appVersion}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-(--text-muted)" />
              <div>
                <span className="block text-[10px] text-(--text-muted) uppercase">
                  Memory (Heap)
                </span>
                <span className="font-mono text-[11px] text-(--text-primary)">
                  {diagnostics.memoryUsageMb} MB
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-(--text-muted)" />
              <div>
                <span className="block text-[10px] text-(--text-muted) uppercase">
                  Process Uptime
                </span>
                <span className="font-mono text-[11px] text-(--text-primary)">
                  {diagnostics.uptimeSeconds} seconds
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Sanitized Diagnostics Log */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium text-(--text-secondary)">
              <Terminal className="h-3.5 w-3.5" />
              <span>Sanitized System Info</span>
            </span>
          </div>
          <pre
            className="max-h-36 overflow-y-auto rounded border p-2.5 font-mono text-[11px] select-text"
            style={{
              backgroundColor: 'var(--bg-base)',
              borderColor: 'var(--border)',
              color: 'var(--text-secondary)',
            }}
          >
            {diagnostics ? diagnostics.sanitizedLogs.join('\n') : 'Loading system diagnostics...'}
          </pre>
        </div>
      </div>
    </Modal>
  );
}
