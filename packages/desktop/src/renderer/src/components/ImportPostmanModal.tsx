import React, { useState, useEffect } from 'react';
import {
  FolderOpen,
  FileText,
  AlertTriangle,
  CheckCircle2,
  UploadCloud,
  Key,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Folder,
  Layers,
} from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { MethodBadge } from './ui/Badge';
import { useCollectionStore } from '../stores/collectionStore';
import { useAppStore } from '../stores/appStore';
import type { PostmanImportReport, HttpMethod } from '@reqit/core';
import type { PostmanParseResult } from '../../../shared/ipc-types.js';

export interface ImportPostmanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (report: PostmanImportReport) => void;
}

type InputMode = 'file' | 'paste';

export function ImportPostmanModal({
  isOpen,
  onClose,
  onSuccess,
}: ImportPostmanModalProps): React.JSX.Element | null {
  // Input states
  const [colMode, setColMode] = useState<InputMode>('file');
  const [colJson, setColJson] = useState('');
  const [colFileName, setColFileName] = useState('');

  const [envMode, setEnvMode] = useState<InputMode>('file');
  const [envJson, setEnvJson] = useState('');
  const [envFileName, setEnvFileName] = useState('');

  const [targetDir, setTargetDir] = useState('');
  const [nameOverride, setNameOverride] = useState('');

  // Processing & report states
  const [parseLoading, setParseLoading] = useState(false);
  const [parseResult, setParseResult] = useState<PostmanParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [report, setReport] = useState<PostmanImportReport | null>(null);

  const [warningsExpanded, setWarningsExpanded] = useState(true);
  const [itemsExpanded, setItemsExpanded] = useState(false);

  const { loadCollection } = useCollectionStore();
  const addToast = useAppStore(s => s.addToast);

  // Reset when dialog opens
  useEffect(() => {
    if (isOpen) {
      setColMode('file');
      setColJson('');
      setColFileName('');
      setEnvMode('file');
      setEnvJson('');
      setEnvFileName('');
      setTargetDir('');
      setNameOverride('');
      setParseResult(null);
      setParseError(null);
      setImporting(false);
      setImportError(null);
      setReport(null);
      setWarningsExpanded(true);
      setItemsExpanded(false);
    }
  }, [isOpen]);

  // Live parse collection whenever JSON changes
  useEffect(() => {
    const trimmed = colJson.trim();
    if (!trimmed) {
      setParseResult(null);
      setParseError(null);
      return;
    }

    let active = true;
    setParseLoading(true);
    setParseError(null);

    const timer = setTimeout(async () => {
      try {
        if (!window.reqitApi?.parsePostman) {
          throw new Error('Reqit desktop API is unavailable');
        }
        const res = await window.reqitApi.parsePostman({
          collectionJson: trimmed,
          environmentJson: envJson.trim() || undefined,
        });
        if (active) {
          setParseResult(res);
          if (!nameOverride) {
            setNameOverride(res.collectionName);
          }
        }
      } catch (err: unknown) {
        if (active) {
          setParseResult(null);
          setParseError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (active) {
          setParseLoading(false);
        }
      }
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [colJson, envJson]);

  // File pickers
  const handleSelectColFile = async () => {
    try {
      if (!window.reqitApi?.openJsonFileDialog) return;
      const file = await window.reqitApi.openJsonFileDialog('Select Postman Collection v2.1 File');
      if (file) {
        setColFileName(file.fileName);
        setColJson(file.content);
      }
    } catch (err: unknown) {
      addToast({
        type: 'error',
        message: `Failed to open file: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  const handleSelectEnvFile = async () => {
    try {
      if (!window.reqitApi?.openJsonFileDialog) return;
      const file = await window.reqitApi.openJsonFileDialog('Select Postman Environment File');
      if (file) {
        setEnvFileName(file.fileName);
        setEnvJson(file.content);
      }
    } catch (err: unknown) {
      addToast({
        type: 'error',
        message: `Failed to open file: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  const handleBrowseTargetDir = async () => {
    try {
      if (!window.reqitApi?.selectDirectoryDialog) return;
      const dir = await window.reqitApi.selectDirectoryDialog(
        'Select Target Directory for Imported Collection',
      );
      if (dir) {
        setTargetDir(dir);
      }
    } catch (err: unknown) {
      addToast({
        type: 'error',
        message: `Failed to choose directory: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  // Run Import
  const handleExecuteImport = async () => {
    if (!colJson.trim()) {
      setImportError('Postman collection JSON is required.');
      return;
    }
    if (!targetDir.trim()) {
      setImportError('Please select a target directory on your computer.');
      return;
    }

    setImporting(true);
    setImportError(null);

    try {
      if (!window.reqitApi?.importPostman) {
        throw new Error('Reqit desktop API is unavailable');
      }

      const res = await window.reqitApi.importPostman({
        collectionJson: colJson.trim(),
        environmentJson: envJson.trim() || undefined,
        targetDir: targetDir.trim(),
        collectionNameOverride: nameOverride.trim() || undefined,
      });

      setReport(res);
      addToast({
        type: 'success',
        message: `Imported "${res.collectionName}" (${res.totalRequests} requests)`,
      });

      // Load collection into desktop workspace immediately
      const dirToLoad = res.targetDirectory || targetDir.trim();
      await loadCollection(dirToLoad);
      onSuccess?.(res);
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  };

  const handleCloseAndOpen = async () => {
    if (report) {
      await loadCollection(report.targetDirectory || targetDir.trim());
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={report ? 'Postman Import Report' : 'Import Postman Collection'}
      size="large"
      primaryAction={
        report
          ? {
              label: 'Open Collection in Reqit',
              onClick: handleCloseAndOpen,
              variant: 'primary',
            }
          : {
              label: importing ? 'Importing...' : 'Import Collection',
              onClick: handleExecuteImport,
              variant: 'primary',
              loading: importing,
              disabled: !parseResult || !targetDir.trim() || parseLoading,
            }
      }
      secondaryAction={{
        label: report ? 'Close' : 'Cancel',
        onClick: onClose,
      }}
    >
      <div className="flex max-h-[72vh] flex-col gap-4 overflow-y-auto pr-1 text-[13px]">
        {/* VIEW 1: Input & Configuration Form */}
        {!report && (
          <>
            <p className="text-[12px] text-(--text-muted)">
              Import a Postman Collection (v2.1) and optional Environment directly into transparent,
              version-controllable YAML files on your local filesystem.
            </p>

            {/* 1. Collection Input */}
            <div
              className="rounded-lg border p-3.5"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border)',
              }}
            >
              <div className="mb-2 flex items-center justify-between">
                <label className="flex items-center gap-1.5 font-semibold text-(--text-primary)">
                  <Layers className="h-4 w-4 text-(--accent)" />
                  Postman Collection (v2.1) *
                </label>
                <div className="flex gap-1 rounded bg-(--bg-elevated) p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setColMode('file')}
                    className={`rounded px-2 py-0.5 font-medium transition-colors ${
                      colMode === 'file'
                        ? 'bg-(--accent-strong) text-(--accent-fg)'
                        : 'text-(--text-muted) hover:text-(--text-primary)'
                    }`}
                  >
                    Select File
                  </button>
                  <button
                    type="button"
                    onClick={() => setColMode('paste')}
                    className={`rounded px-2 py-0.5 font-medium transition-colors ${
                      colMode === 'paste'
                        ? 'bg-(--accent-strong) text-(--accent-fg)'
                        : 'text-(--text-muted) hover:text-(--text-primary)'
                    }`}
                  >
                    Paste JSON
                  </button>
                </div>
              </div>

              {colMode === 'file' ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="default"
                    icon={<UploadCloud className="h-4 w-4" />}
                    onClick={handleSelectColFile}
                  >
                    {colFileName ? 'Change Collection File' : 'Choose Collection JSON...'}
                  </Button>
                  <span className="truncate text-[12px] text-(--text-secondary)">
                    {colFileName || 'No file selected'}
                  </span>
                </div>
              ) : (
                <textarea
                  value={colJson}
                  onChange={e => setColJson(e.target.value)}
                  placeholder="Paste raw Postman Collection v2.1 JSON here..."
                  className="h-28 w-full rounded border p-2 font-mono text-[12px] focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg-base)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
              )}
            </div>

            {/* 2. Optional Environment Input */}
            <div
              className="rounded-lg border p-3.5"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border)',
              }}
            >
              <div className="mb-2 flex items-center justify-between">
                <label className="flex items-center gap-1.5 font-semibold text-(--text-primary)">
                  <Key className="h-4 w-4 text-(--accent)" />
                  Postman Environment{' '}
                  <span className="text-[11px] font-normal text-(--text-muted)">(Optional)</span>
                </label>
                <div className="flex gap-1 rounded bg-(--bg-elevated) p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setEnvMode('file')}
                    className={`rounded px-2 py-0.5 font-medium transition-colors ${
                      envMode === 'file'
                        ? 'bg-(--accent-strong) text-(--accent-fg)'
                        : 'text-(--text-muted) hover:text-(--text-primary)'
                    }`}
                  >
                    Select File
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnvMode('paste')}
                    className={`rounded px-2 py-0.5 font-medium transition-colors ${
                      envMode === 'paste'
                        ? 'bg-(--accent-strong) text-(--accent-fg)'
                        : 'text-(--text-muted) hover:text-(--text-primary)'
                    }`}
                  >
                    Paste JSON
                  </button>
                </div>
              </div>

              {envMode === 'file' ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="default"
                    icon={<UploadCloud className="h-4 w-4" />}
                    onClick={handleSelectEnvFile}
                  >
                    {envFileName ? 'Change Environment File' : 'Choose Environment JSON...'}
                  </Button>
                  <span className="truncate text-[12px] text-(--text-secondary)">
                    {envFileName || 'No environment file selected (optional)'}
                  </span>
                  {envFileName && (
                    <button
                      type="button"
                      onClick={() => {
                        setEnvFileName('');
                        setEnvJson('');
                      }}
                      className="ml-auto text-[11px] text-(--text-muted) hover:text-(--danger)"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ) : (
                <textarea
                  value={envJson}
                  onChange={e => setEnvJson(e.target.value)}
                  placeholder="Paste Postman Environment JSON here (optional)..."
                  className="h-20 w-full rounded border p-2 font-mono text-[12px] focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg-base)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
              )}
            </div>

            {/* 3. Destination Configuration */}
            <div
              className="rounded-lg border p-3.5"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border)',
              }}
            >
              <div className="mb-2 font-semibold text-(--text-primary)">
                Destination Directory *
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={targetDir}
                  onChange={e => setTargetDir(e.target.value)}
                  placeholder="e.g. C:\MyProjects\api-collections\my-api"
                  className="flex-1 rounded border px-2.5 py-1.5 text-[12px] focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg-base)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
                <Button
                  variant="secondary"
                  size="default"
                  icon={<FolderOpen className="h-4 w-4" />}
                  onClick={handleBrowseTargetDir}
                >
                  Browse...
                </Button>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <label className="text-[12px] text-(--text-secondary)">Collection Name:</label>
                <input
                  type="text"
                  value={nameOverride}
                  onChange={e => setNameOverride(e.target.value)}
                  placeholder={parseResult?.collectionName || 'Collection Name'}
                  className="w-64 rounded border px-2 py-1 text-[12px] focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg-base)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            </div>

            {/* 4. Live Parse Status & Preview */}
            {parseLoading && (
              <div className="flex items-center gap-2 text-[12px] text-(--text-muted)">
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-(--accent) border-t-transparent" />
                Parsing Postman JSON...
              </div>
            )}

            {parseError && (
              <div
                className="flex items-start gap-2 rounded-lg border p-3 text-[12px]"
                style={{
                  backgroundColor: 'var(--danger-subtle)',
                  borderColor: 'var(--danger)',
                  color: 'var(--danger)',
                }}
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <div>
                  <div className="font-semibold">Invalid Postman Collection</div>
                  <div>{parseError}</div>
                </div>
              </div>
            )}

            {parseResult && (
              <div
                className="rounded-lg border p-3"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border)',
                }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-(--success)" />
                    <span className="font-semibold text-(--text-primary)">
                      Ready to import: {parseResult.collectionName}
                    </span>
                  </div>
                  <span className="rounded bg-(--accent-subtle) px-2 py-0.5 text-[11px] font-semibold text-(--accent)">
                    v2.1 Schema
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4">
                  <div
                    className="rounded border bg-(--bg-base) p-2 text-center"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="text-[11px] text-(--text-muted)">Requests</div>
                    <div className="text-base font-bold text-(--text-primary)">
                      {parseResult.totalRequests}
                    </div>
                  </div>
                  <div
                    className="rounded border bg-(--bg-base) p-2 text-center"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="text-[11px] text-(--text-muted)">Folders</div>
                    <div className="text-base font-bold text-(--text-primary)">
                      {parseResult.totalFolders}
                    </div>
                  </div>
                  <div
                    className="rounded border bg-(--bg-base) p-2 text-center"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="text-[11px] text-(--text-muted)">Env Variables</div>
                    <div className="text-base font-bold text-(--text-primary)">
                      {parseResult.totalEnvVars !== undefined ? parseResult.totalEnvVars : 'None'}
                    </div>
                  </div>
                  <div
                    className="rounded border bg-(--bg-base) p-2 text-center"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="text-[11px] text-(--text-muted)">Secrets Isolated</div>
                    <div className="text-base font-bold text-(--accent)">
                      {parseResult.totalSecretVars !== undefined ? parseResult.totalSecretVars : 0}
                    </div>
                  </div>
                </div>

                {parseResult.warnings.length > 0 && (
                  <div className="mt-3 rounded border border-(--warning)/30 bg-(--warning-subtle) p-2.5 text-[12px]">
                    <div className="flex items-center gap-1.5 font-semibold text-(--warning)">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>{parseResult.warnings.length} Warnings / Migration Notices</span>
                    </div>
                    <ul className="mt-1.5 max-h-24 list-inside list-disc overflow-y-auto text-[11px] text-(--text-secondary)">
                      {parseResult.warnings.slice(0, 5).map((w: string, idx: number) => (
                        <li key={idx} className="truncate" title={w}>
                          {w}
                        </li>
                      ))}
                      {parseResult.warnings.length > 5 && (
                        <li className="font-medium text-(--text-muted)">
                          + {parseResult.warnings.length - 5} more notices in final report
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {importError && (
              <div
                className="flex items-start gap-2 rounded-lg border p-3 text-[12px]"
                style={{
                  backgroundColor: 'var(--danger-subtle)',
                  borderColor: 'var(--danger)',
                  color: 'var(--danger)',
                }}
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <div>
                  <div className="font-semibold">Import Failed</div>
                  <div>{importError}</div>
                </div>
              </div>
            )}
          </>
        )}

        {/* VIEW 2: Success Import Report */}
        {report && (
          <div className="flex flex-col gap-4">
            {/* Header banner */}
            <div
              className="flex items-start gap-3 rounded-lg border p-4"
              style={{
                backgroundColor: 'var(--success-subtle)',
                borderColor: 'var(--success)',
              }}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--success)/20 text-(--success)">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-(--text-primary)">
                  Import Complete: {report.collectionName}
                </h3>
                <p className="mt-0.5 text-[12px] text-(--text-secondary)">
                  All requests, folders, environments, and secrets have been written to disk in
                  Git-friendly YAML format.
                </p>
                <div className="mt-1 flex items-center gap-1 font-mono text-[11px] text-(--text-muted)">
                  <Folder className="h-3 w-3" />
                  <span className="truncate">{report.targetDirectory || targetDir}</span>
                </div>
              </div>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div
                className="rounded-lg border p-3 text-center"
                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
              >
                <div className="text-[11px] text-(--text-muted)">Requests Created</div>
                <div className="text-xl font-bold text-(--text-primary)">
                  {report.totalRequests}
                </div>
              </div>
              <div
                className="rounded-lg border p-3 text-center"
                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
              >
                <div className="text-[11px] text-(--text-muted)">Folders Created</div>
                <div className="text-xl font-bold text-(--text-primary)">{report.totalFolders}</div>
              </div>
              <div
                className="rounded-lg border p-3 text-center"
                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
              >
                <div className="text-[11px] text-(--text-muted)">Environments</div>
                <div className="text-xl font-bold text-(--text-primary)">
                  {report.totalEnvironments}
                </div>
              </div>
              <div
                className="rounded-lg border p-3 text-center"
                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
              >
                <div className="text-[11px] text-(--text-muted)">Secrets Isolated</div>
                <div className="text-xl font-bold text-(--accent)">{report.totalSecrets}</div>
              </div>
            </div>

            {/* Secrets Protection Notice */}
            {report.totalSecrets > 0 && (
              <div
                className="flex items-center gap-2 rounded-lg border p-2.5 text-[12px]"
                style={{
                  backgroundColor: 'var(--accent-subtle)',
                  borderColor: 'var(--accent)',
                  color: 'var(--text-primary)',
                }}
              >
                <ShieldCheck className="h-4 w-4 text-(--accent)" />
                <span>
                  <strong>{report.totalSecrets} sensitive variables</strong> isolated into{' '}
                  <code className="text-(--accent)">.reqit/secrets.yaml</code> (safely added to{' '}
                  <code className="text-(--accent)">.gitignore</code>).
                </span>
              </div>
            )}

            {/* Warnings & Migration Notes */}
            {report.warnings.length > 0 && (
              <div
                className="overflow-hidden rounded-lg border"
                style={{ borderColor: 'var(--border)' }}
              >
                <button
                  type="button"
                  onClick={() => setWarningsExpanded(!warningsExpanded)}
                  className="flex w-full items-center justify-between p-2.5 text-left text-[12px] font-semibold hover:bg-(--bg-hover)"
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-(--warning)" />
                    <span>Migration Notices ({report.warnings.length})</span>
                  </div>
                  {warningsExpanded ? (
                    <ChevronDown className="h-4 w-4 text-(--text-muted)" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-(--text-muted)" />
                  )}
                </button>

                {warningsExpanded && (
                  <div
                    className="max-h-36 overflow-y-auto p-3 text-[11px]"
                    style={{ backgroundColor: 'var(--bg-base)' }}
                  >
                    <ul className="list-disc space-y-1 pl-4 text-(--text-secondary)">
                      {report.warnings.map((w: string, idx: number) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Converted items details */}
            <div
              className="overflow-hidden rounded-lg border"
              style={{ borderColor: 'var(--border)' }}
            >
              <button
                type="button"
                onClick={() => setItemsExpanded(!itemsExpanded)}
                className="flex w-full items-center justify-between p-2.5 text-left text-[12px] font-semibold hover:bg-(--bg-hover)"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-(--accent)" />
                  <span>Converted Items Breakdown ({report.convertedItems.length})</span>
                </div>
                {itemsExpanded ? (
                  <ChevronDown className="h-4 w-4 text-(--text-muted)" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-(--text-muted)" />
                )}
              </button>

              {itemsExpanded && (
                <div
                  className="max-h-44 overflow-y-auto p-2 text-[11px]"
                  style={{ backgroundColor: 'var(--bg-base)' }}
                >
                  <div className="space-y-1">
                    {report.convertedItems.map((item, idx) => {
                      const methodMatch = item.details?.match(
                        /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/,
                      );
                      const method = (methodMatch ? methodMatch[1] : 'GET') as HttpMethod;
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-2 rounded px-2 py-1 hover:bg-(--bg-hover)"
                        >
                          {item.type === 'folder' ? (
                            <Folder className="h-3.5 w-3.5 text-(--accent)" />
                          ) : (
                            <MethodBadge method={method} short />
                          )}
                          <span className="font-medium text-(--text-primary)">{item.name}</span>
                          <span className="ml-auto font-mono text-[10px] text-(--text-muted)">
                            {item.path || item.details}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
