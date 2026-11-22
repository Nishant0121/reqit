import React, { useState, useEffect } from 'react';
import {
  FileText,
  Globe,
  Code,
  FolderOpen,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  ChevronDown,
  ChevronRight,
  Folder,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { MethodBadge } from './ui/Badge';
import { useCollectionStore } from '../stores/collectionStore';
import { useAppStore } from '../stores/appStore';
import type { OpenApiImportReport, OpenApiParseSummary, HttpMethod } from '@reqit/core';

export interface ImportOpenApiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (report: OpenApiImportReport) => void;
}

type SourceTab = 'file' | 'url' | 'raw';
type ImportMode = 'add-new' | 'merge' | 'clean';

export function ImportOpenApiModal({
  isOpen,
  onClose,
  onSuccess,
}: ImportOpenApiModalProps): React.JSX.Element | null {
  // Input sources
  const [tab, setTab] = useState<SourceTab>('file');
  const [fileContent, setFileContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [url, setUrl] = useState('');
  const [rawText, setRawText] = useState('');

  // Destination & Settings
  const [targetDir, setTargetDir] = useState('');
  const [nameOverride, setNameOverride] = useState('');
  const [baseUrlOverride, setBaseUrlOverride] = useState('');
  const [mode, setMode] = useState<ImportMode>('add-new');

  // Preview & Processing
  const [isParsing, setIsParsing] = useState(false);
  const [parseSummary, setParseSummary] = useState<OpenApiParseSummary | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [report, setReport] = useState<OpenApiImportReport | null>(null);

  const [warningsExpanded, setWarningsExpanded] = useState(true);
  const [previewExpanded, setPreviewExpanded] = useState(false);

  const { loadCollection } = useCollectionStore();
  const addToast = useAppStore(s => s.addToast);

  // Reset when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTab('file');
      setFileContent('');
      setFileName('');
      setUrl('');
      setRawText('');
      setTargetDir('');
      setNameOverride('');
      setBaseUrlOverride('');
      setMode('add-new');
      setIsParsing(false);
      setParseSummary(null);
      setParseError(null);
      setIsImporting(false);
      setImportError(null);
      setReport(null);
      setWarningsExpanded(true);
      setPreviewExpanded(false);
    }
  }, [isOpen]);

  // Handle parsing spec from content or URL
  const triggerParse = async (contentToParse?: string, urlToParse?: string) => {
    const content = contentToParse ?? (tab === 'file' ? fileContent : tab === 'raw' ? rawText : '');
    const targetUrl = urlToParse ?? (tab === 'url' ? url.trim() : '');

    if (!content.trim() && !targetUrl) {
      setParseSummary(null);
      setParseError(null);
      return;
    }

    setIsParsing(true);
    setParseError(null);

    try {
      if (!window.reqitApi?.parseOpenApi) {
        throw new Error('Reqit desktop API is unavailable');
      }

      const summary = await window.reqitApi.parseOpenApi({
        specContent: content.trim() || undefined,
        specUrl: targetUrl || undefined,
      });

      setParseSummary(summary);
      if (summary.servers.length > 0 && summary.servers[0] && !baseUrlOverride) {
        setBaseUrlOverride(summary.servers[0]);
      }
    } catch (err: unknown) {
      setParseSummary(null);
      setParseError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsParsing(false);
    }
  };

  // Open file dialog
  const handleSelectFile = async () => {
    try {
      if (!window.reqitApi?.openOpenApiFileDialog) return;
      const res = await window.reqitApi.openOpenApiFileDialog();
      if (res) {
        setFileName(res.filename);
        setFileContent(res.content);
        await triggerParse(res.content, undefined);
      }
    } catch (err) {
      console.error('Failed to open OpenAPI file:', err);
    }
  };

  // Fetch URL button handler
  const handleFetchUrl = async () => {
    if (!url.trim()) return;
    await triggerParse(undefined, url.trim());
  };

  // Select target directory
  const handleSelectTargetDir = async () => {
    try {
      if (!window.reqitApi?.selectDirectoryDialog) return;
      const dir = await window.reqitApi.selectDirectoryDialog(
        'Select Target Directory for Imported Collection',
      );
      if (dir) {
        setTargetDir(dir);
      }
    } catch (err) {
      console.error('Failed to select directory:', err);
    }
  };

  // Execute import
  const handleImport = async () => {
    if (!targetDir.trim()) {
      setImportError('Please choose a target directory.');
      return;
    }

    const content = tab === 'file' ? fileContent : tab === 'raw' ? rawText : '';
    const targetUrl = tab === 'url' ? url.trim() : '';

    if (!content.trim() && !targetUrl) {
      setImportError('No specification content or URL provided.');
      return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      if (!window.reqitApi?.importOpenApi) {
        throw new Error('Reqit desktop API is unavailable');
      }

      const resultReport = await window.reqitApi.importOpenApi({
        specContent: content.trim() || undefined,
        specUrl: targetUrl || undefined,
        targetDir: targetDir.trim(),
        collectionNameOverride: nameOverride.trim() || undefined,
        mode,
        defaultBaseUrl: baseUrlOverride.trim() || undefined,
      });

      setReport(resultReport);
      addToast({
        type: 'success',
        message: `Successfully imported "${resultReport.collectionName}" (${resultReport.createdRequests} created, ${resultReport.mergedRequests} merged, ${resultReport.skippedRequests} preserved).`,
      });

      if (onSuccess) {
        onSuccess(resultReport);
      }

      if (resultReport.targetDirectory) {
        await loadCollection(resultReport.targetDirectory);
      }
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import OpenAPI / Swagger Specification"
      size="xlarge"
    >
      <div className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto pr-1">
        {/* If Report is ready, show summary screen */}
        {report ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-950/30 p-4 text-emerald-300">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" />
              <div>
                <h4 className="font-semibold text-emerald-200">Import Complete!</h4>
                <p className="mt-0.5 text-xs text-emerald-300/80">{report.summaryText}</p>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-2.5">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-center">
                <span className="text-xs text-zinc-400">Total Ops</span>
                <p className="mt-1 text-xl font-bold text-zinc-200">{report.totalRequests}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-center">
                <span className="text-xs text-zinc-400">Folders</span>
                <p className="mt-1 text-xl font-bold text-zinc-200">{report.totalFolders}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-center">
                <span className="text-xs text-emerald-400">Created</span>
                <p className="mt-1 text-xl font-bold text-emerald-300">{report.createdRequests}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-center">
                <span className="text-xs text-blue-400">Merged / Kept</span>
                <p className="mt-1 text-xl font-bold text-blue-300">
                  {report.mergedRequests + report.skippedRequests}
                </p>
              </div>
            </div>

            {/* Target Path info */}
            <div className="flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900/60 p-2.5 text-xs text-zinc-400">
              <Folder className="h-4 w-4 shrink-0 text-zinc-500" />
              <span className="text-zinc-500">Destination:</span>
              <span className="truncate font-mono text-zinc-300">{report.targetDirectory}</span>
            </div>

            {/* Converted items list */}
            <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/40">
              <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 p-2.5 text-xs font-medium text-zinc-300">
                <span>Imported Items ({report.convertedItems.length})</span>
              </div>
              <div className="max-h-56 divide-y divide-zinc-800/60 overflow-y-auto">
                {report.convertedItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 text-xs hover:bg-zinc-800/20"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {item.type === 'folder' ? (
                        <Folder className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                      )}
                      <span className="truncate font-medium text-zinc-200">{item.name}</span>
                      {item.path && (
                        <span className="truncate font-mono text-[11px] text-zinc-500">
                          ({item.path})
                        </span>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        item.status === 'created'
                          ? 'border border-emerald-800/40 bg-emerald-950/60 text-emerald-400'
                          : item.status === 'merged'
                            ? 'border border-blue-800/40 bg-blue-950/60 text-blue-400'
                            : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-800 pt-2">
              <Button variant="primary" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          /* Normal Import Workflow Form */
          <>
            {/* Source selector tabs */}
            <div className="flex items-center gap-1 border-b border-zinc-800 pb-1">
              <button
                type="button"
                onClick={() => setTab('file')}
                className={`flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === 'file'
                    ? 'border-b-2 border-blue-500 bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                }`}
              >
                <FileText className="h-3.5 w-3.5" /> Local File
              </button>
              <button
                type="button"
                onClick={() => setTab('url')}
                className={`flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === 'url'
                    ? 'border-b-2 border-blue-500 bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                }`}
              >
                <Globe className="h-3.5 w-3.5" /> Remote URL
              </button>
              <button
                type="button"
                onClick={() => setTab('raw')}
                className={`flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === 'raw'
                    ? 'border-b-2 border-blue-500 bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                }`}
              >
                <Code className="h-3.5 w-3.5" /> Raw JSON / YAML
              </button>
            </div>

            {/* Source tab contents */}
            {tab === 'file' && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="compact"
                    onClick={handleSelectFile}
                    className="flex shrink-0 items-center gap-1.5"
                  >
                    <FolderOpen className="h-3.5 w-3.5" /> Select File...
                  </Button>
                  <span className="truncate text-xs text-zinc-400">
                    {fileName ? fileName : 'No file selected (.json, .yaml, .yml)'}
                  </span>
                </div>
              </div>
            )}

            {tab === 'url' && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    placeholder="https://petstore.swagger.io/v2/swagger.json"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 font-mono text-xs text-zinc-200 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                  />
                  <Button
                    variant="secondary"
                    size="compact"
                    onClick={handleFetchUrl}
                    disabled={isParsing || !url.trim()}
                    className="flex shrink-0 items-center gap-1.5"
                  >
                    {isParsing ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Globe className="h-3.5 w-3.5" />
                    )}
                    Fetch & Parse
                  </Button>
                </div>
              </div>
            )}

            {tab === 'raw' && (
              <div className="flex flex-col gap-2">
                <textarea
                  rows={5}
                  placeholder="Paste OpenAPI or Swagger JSON / YAML content here..."
                  value={rawText}
                  onChange={e => {
                    setRawText(e.target.value);
                    triggerParse(e.target.value, undefined);
                  }}
                  className="w-full rounded border border-zinc-700 bg-zinc-900 p-2 font-mono text-xs text-zinc-200 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}

            {/* Parsing error */}
            {parseError && (
              <div className="flex items-start gap-2 rounded border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                <div className="flex-1">
                  <p className="font-semibold text-rose-200">Specification Error</p>
                  <p className="mt-0.5 leading-relaxed">{parseError}</p>
                </div>
              </div>
            )}

            {/* Spec preview summary */}
            {parseSummary && (
              <div className="flex flex-col gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-200">
                      {parseSummary.title}
                    </span>
                    <span className="rounded border border-blue-800 bg-blue-950/70 px-1.5 py-0.5 font-mono text-[10px] text-blue-400">
                      {parseSummary.specFormat === 'openapi3'
                        ? `OpenAPI ${parseSummary.version}`
                        : `Swagger ${parseSummary.version}`}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400">
                    <span className="font-medium text-zinc-200">
                      {parseSummary.totalOperations}
                    </span>{' '}
                    operations in{' '}
                    <span className="font-medium text-zinc-200">{parseSummary.totalTags}</span> tags
                  </div>
                </div>

                {parseSummary.servers.length > 0 && (
                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-400">
                    <Globe className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                    <span className="truncate">Base URL: {parseSummary.servers[0]}</span>
                  </div>
                )}

                {/* Warnings if any */}
                {parseSummary.warnings.length > 0 && (
                  <div className="rounded border border-amber-900/40 bg-amber-950/20 p-2 text-[11px] text-amber-300">
                    <button
                      type="button"
                      onClick={() => setWarningsExpanded(!warningsExpanded)}
                      className="flex w-full items-center justify-between font-medium"
                    >
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> Warnings (
                        {parseSummary.warnings.length})
                      </span>
                      {warningsExpanded ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </button>
                    {warningsExpanded && (
                      <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-amber-200/80">
                        {parseSummary.warnings.map((w, idx) => (
                          <li key={idx}>{w}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Expandable operations preview */}
                <div className="overflow-hidden rounded border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setPreviewExpanded(!previewExpanded)}
                    className="flex w-full items-center justify-between bg-zinc-800/40 p-2 text-[11px] font-medium text-zinc-400 hover:bg-zinc-800/70"
                  >
                    <span className="flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-zinc-400" /> Operations Preview (
                      {parseSummary.operationsPreview.length})
                    </span>
                    {previewExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </button>
                  {previewExpanded && (
                    <div className="max-h-40 divide-y divide-zinc-800/60 overflow-y-auto bg-zinc-950/40">
                      {parseSummary.operationsPreview.map((op, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-1.5 text-[11px]"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <MethodBadge method={op.method as HttpMethod} />
                            <span className="truncate font-mono text-zinc-300">{op.path}</span>
                            {op.summary && (
                              <span className="truncate text-zinc-500">- {op.summary}</span>
                            )}
                          </div>
                          {op.tag && (
                            <span className="shrink-0 rounded bg-zinc-800 px-1 py-0.5 text-[10px] text-zinc-400">
                              {op.tag}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Target directory picker */}
            <div className="flex flex-col gap-1.5 border-t border-zinc-800 pt-2">
              <label className="flex items-center gap-1 text-xs font-semibold text-zinc-300">
                Destination Directory <span className="text-rose-400">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Select a folder to save collection files..."
                  value={targetDir}
                  onChange={e => setTargetDir(e.target.value)}
                  className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 font-mono text-xs text-zinc-200 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                />
                <Button
                  variant="secondary"
                  size="compact"
                  onClick={handleSelectTargetDir}
                  className="flex shrink-0 items-center gap-1.5"
                >
                  <FolderOpen className="h-3.5 w-3.5" /> Browse...
                </Button>
              </div>
            </div>

            {/* Collection name & Base URL overrides */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-400">
                  Collection Name Override
                </label>
                <input
                  type="text"
                  placeholder={parseSummary?.title || 'OpenAPI Collection'}
                  value={nameOverride}
                  onChange={e => setNameOverride(e.target.value)}
                  className="rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-400">Base URL Override</label>
                <input
                  type="text"
                  placeholder="https://api.example.com"
                  value={baseUrlOverride}
                  onChange={e => setBaseUrlOverride(e.target.value)}
                  className="rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 font-mono text-xs text-zinc-200 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Re-import / Merge mode options */}
            <div className="flex flex-col gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <span className="text-xs font-semibold text-zinc-300">Re-import Mode</span>
              <div className="mt-1 flex flex-col gap-1.5">
                <label className="flex cursor-pointer items-start gap-2 text-xs text-zinc-300">
                  <input
                    type="radio"
                    name="importMode"
                    value="add-new"
                    checked={mode === 'add-new'}
                    onChange={() => setMode('add-new')}
                    className="mt-0.5 text-blue-500 focus:ring-0"
                  />
                  <div>
                    <span className="font-medium text-zinc-200">Add new only (Recommended)</span>
                    <p className="text-[11px] text-zinc-400">
                      Preserves existing request files on disk; imports only newly added operations.
                    </p>
                  </div>
                </label>
                <label className="flex cursor-pointer items-start gap-2 text-xs text-zinc-300">
                  <input
                    type="radio"
                    name="importMode"
                    value="merge"
                    checked={mode === 'merge'}
                    onChange={() => setMode('merge')}
                    className="mt-0.5 text-blue-500 focus:ring-0"
                  />
                  <div>
                    <span className="font-medium text-zinc-200">Merge updates</span>
                    <p className="text-[11px] text-zinc-400">
                      Preserves user-written scripts, test assertions, and custom headers/parameters
                      while updating URL, method, and new parameters.
                    </p>
                  </div>
                </label>
                <label className="flex cursor-pointer items-start gap-2 text-xs text-zinc-300">
                  <input
                    type="radio"
                    name="importMode"
                    value="clean"
                    checked={mode === 'clean'}
                    onChange={() => setMode('clean')}
                    className="mt-0.5 text-blue-500 focus:ring-0"
                  />
                  <div>
                    <span className="font-medium text-zinc-200">Clean / Overwrite</span>
                    <p className="text-[11px] text-zinc-400">
                      Completely overwrites all files in the destination directory.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Import error */}
            {importError && (
              <div className="flex items-start gap-2 rounded border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                <p>{importError}</p>
              </div>
            )}

            {/* Actions footer */}
            <div className="flex items-center justify-between border-t border-zinc-800 pt-2">
              <Button variant="secondary" onClick={onClose} disabled={isImporting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleImport}
                disabled={
                  isImporting || !targetDir.trim() || (!fileContent && !rawText && !url.trim())
                }
                className="flex items-center gap-1.5"
              >
                {isImporting ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UploadCloud className="h-3.5 w-3.5" />
                )}
                Import Specification
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
