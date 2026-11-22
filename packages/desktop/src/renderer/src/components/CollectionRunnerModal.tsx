import React, { useState, useEffect, useMemo } from 'react';
import {
  Play,
  Square,
  RefreshCw,
  FileText,
  FileCode,
  CheckCircle,
  XCircle,
  Upload,
  Folder,
  Layers,
  ChevronDown,
  ChevronRight,
  Database,
  Trash2,
} from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import type {
  CollectionTree,
  CollectionTreeNode,
  RunnerProgressEvent,
  RunnerRequestResult,
  RunnerSummary,
} from '@reqit/core';
import type { OpenDataFileResult } from '../../../shared/ipc-types';

export interface CollectionRunnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  collectionTree: CollectionTree | null;
  activeEnvironment?: string;
  initialFolderPath?: string;
}

interface FlattenedRequest {
  id: string;
  name: string;
  path: string;
  method: string;
  folderPath: string;
}

export function CollectionRunnerModal({
  isOpen,
  onClose,
  collectionTree,
  activeEnvironment,
  initialFolderPath,
}: CollectionRunnerModalProps): React.JSX.Element | null {
  // Navigation / Phase
  const [step, setStep] = useState<'configure' | 'running' | 'completed'>('configure');

  // Configuration options
  const [targetFolder, setTargetFolder] = useState<string>(initialFolderPath || '');
  const [selectedEnv, setSelectedEnv] = useState<string>(activeEnvironment || '');
  const [iterations, setIterations] = useState<number>(1);
  const [delayMs, setDelayMs] = useState<number>(0);
  const [bail, setBail] = useState<boolean>(false);
  const [selectedReqIds, setSelectedReqIds] = useState<Set<string>>(new Set());

  // Data-driven testing file
  const [dataFile, setDataFile] = useState<OpenDataFileResult | null>(null);

  // Live execution state
  const [progress, setProgress] = useState<RunnerProgressEvent | null>(null);
  const [liveResults, setLiveResults] = useState<RunnerRequestResult[]>([]);
  const [summary, setSummary] = useState<RunnerSummary | null>(null);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  // Extract all available folders
  const availableFolders = useMemo(() => {
    if (!collectionTree) return [];
    const list: Array<{ path: string; name: string }> = [];

    const walk = (nodes: CollectionTreeNode[]) => {
      for (const node of nodes) {
        if (node.type === 'folder') {
          list.push({ path: node.path, name: node.name || node.relativePath });
          if (node.children) walk(node.children);
        }
      }
    };

    walk(collectionTree.tree);
    return list;
  }, [collectionTree]);

  // Extract requests scoped to currently selected folder
  const availableRequests = useMemo(() => {
    if (!collectionTree) return [];
    const list: FlattenedRequest[] = [];

    let rootNodes = collectionTree.tree;
    if (targetFolder) {
      const findFolder = (nodes: CollectionTreeNode[]): CollectionTreeNode | undefined => {
        for (const n of nodes) {
          if (n.type === 'folder' && (n.path === targetFolder || n.relativePath === targetFolder)) {
            return n;
          }
          if (n.children) {
            const found = findFolder(n.children);
            if (found) return found;
          }
        }
        return undefined;
      };
      const found = findFolder(collectionTree.tree);
      rootNodes = found?.children || [];
    }

    const walk = (nodes: CollectionTreeNode[], curFolder: string) => {
      for (const n of nodes) {
        if (n.type === 'folder') {
          if (n.children) walk(n.children, n.name);
        } else if (n.type === 'request') {
          list.push({
            id: n.id || n.path,
            name: n.name,
            path: n.path,
            method: (n.method || n.request?.method || 'GET').toUpperCase(),
            folderPath: curFolder,
          });
        }
      }
    };

    walk(rootNodes, '');
    return list;
  }, [collectionTree, targetFolder]);

  // Auto-select all available requests on open or folder change
  useEffect(() => {
    if (availableRequests.length > 0) {
      setSelectedReqIds(new Set(availableRequests.map(r => r.id)));
    }
  }, [availableRequests]);

  // Reset or initialize on open
  useEffect(() => {
    if (isOpen) {
      setStep('configure');
      setTargetFolder(initialFolderPath || '');
      setSelectedEnv(activeEnvironment || '');
      setProgress(null);
      setLiveResults([]);
      setSummary(null);
    }
  }, [isOpen, initialFolderPath, activeEnvironment]);

  // Toggle single request selection
  const handleToggleRequest = (id: string) => {
    setSelectedReqIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select all or deselect all
  const handleSelectAll = (select: boolean) => {
    if (select) {
      setSelectedReqIds(new Set(availableRequests.map(r => r.id)));
    } else {
      setSelectedReqIds(new Set());
    }
  };

  // Open data file dialog (CSV or JSON)
  const handleOpenDataFile = async () => {
    if (!window.reqitApi?.openDataFileDialog) return;
    try {
      const result = await window.reqitApi.openDataFileDialog();
      if (result) {
        setDataFile(result);
        if (result.rows.length > 0) {
          setIterations(result.rows.length);
        }
      }
    } catch (err) {
      console.error('Failed to open data file:', err);
    }
  };

  // Start Collection Run
  const handleStartRun = async () => {
    if (!collectionTree || !window.reqitApi?.startCollectionRunner) return;

    setStep('running');
    setProgress(null);
    setLiveResults([]);
    setSummary(null);

    // Subscribe to progress events
    const unsubscribe = window.reqitApi.onRunnerProgress(evt => {
      setProgress(evt);
      if (evt.latestResult) {
        setLiveResults(prev => [...prev, evt.latestResult!]);
      }
    });

    try {
      const resultSummary = await window.reqitApi.startCollectionRunner({
        collectionPath: collectionTree.rootPath,
        folderPath: targetFolder || undefined,
        environmentName: selectedEnv || undefined,
        iterations: iterations > 0 ? iterations : 1,
        delayMs: delayMs >= 0 ? delayMs : 0,
        bail,
        data: dataFile?.rows,
        selectedRequestIds: Array.from(selectedReqIds),
      });

      setSummary(resultSummary);
      setStep('completed');
    } catch (err) {
      console.error('Runner execution failed:', err);
      setStep('completed');
    } finally {
      unsubscribe();
    }
  };

  // Cancel Collection Run
  const handleCancelRun = async () => {
    if (!window.reqitApi?.cancelCollectionRunner) return;
    try {
      await window.reqitApi.cancelCollectionRunner();
    } catch (err) {
      console.error('Failed to cancel runner:', err);
    }
  };

  // Export JSON Report
  const handleExportJson = async () => {
    if (!summary || !window.reqitApi?.exportRunnerReport) return;
    try {
      await window.reqitApi.exportRunnerReport({
        summary,
        defaultFilename: `${summary.collectionName || 'reqit'}-run.json`,
        type: 'json',
      });
    } catch (err) {
      console.error('Failed to export JSON report:', err);
    }
  };

  // Export HTML Report
  const handleExportHtml = async () => {
    if (!summary || !window.reqitApi?.exportRunnerReport) return;
    try {
      await window.reqitApi.exportRunnerReport({
        summary,
        defaultFilename: `${summary.collectionName || 'reqit'}-report.html`,
        type: 'html',
      });
    } catch (err) {
      console.error('Failed to export HTML report:', err);
    }
  };

  // Toggle assertion breakdown in results list
  const toggleResultExpanded = (key: string) => {
    setExpandedResults(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        step === 'configure'
          ? 'Collection Runner'
          : step === 'running'
            ? 'Running Collection...'
            : 'Run Results'
      }
      size="xlarge"
    >
      <div className="flex h-[75vh] max-h-[800px] flex-col text-zinc-100">
        {/* ==================== SCREEN 1: CONFIGURE ==================== */}
        {step === 'configure' && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="grid grid-cols-1 gap-6 overflow-y-auto p-4 md:grid-cols-2">
              {/* Left Column: Scope & Execution Parameters */}
              <div className="flex flex-col gap-4">
                <div className="space-y-4 rounded-lg border border-zinc-700/60 bg-zinc-800/50 p-4">
                  <h3 className="flex items-center gap-2 text-xs font-bold tracking-wider text-zinc-400 uppercase">
                    <Layers className="h-4 w-4 text-blue-400" /> Target & Environment
                  </h3>

                  {/* Scope Selector */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-300">Target</label>
                    <select
                      value={targetFolder}
                      onChange={e => setTargetFolder(e.target.value)}
                      className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">All Requests (Whole Collection)</option>
                      {availableFolders.map(f => (
                        <option key={f.path} value={f.path}>
                          Folder: {f.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Environment Selector */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-300">
                      Environment
                    </label>
                    <select
                      value={selectedEnv}
                      onChange={e => setSelectedEnv(e.target.value)}
                      className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">No Environment</option>
                      {collectionTree?.environments &&
                        Object.keys(collectionTree.environments).map(env => (
                          <option key={env} value={env}>
                            {env}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Execution Controls */}
                <div className="space-y-4 rounded-lg border border-zinc-700/60 bg-zinc-800/50 p-4">
                  <h3 className="flex items-center gap-2 text-xs font-bold tracking-wider text-zinc-400 uppercase">
                    <RefreshCw className="h-4 w-4 text-emerald-400" /> Run Settings
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-300">
                        Iterations
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={iterations}
                        onChange={e =>
                          setIterations(Math.max(1, parseInt(e.target.value, 10) || 1))
                        }
                        className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-300">
                        Delay (ms)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={delayMs}
                        onChange={e => setDelayMs(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="pt-1">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300 select-none">
                      <input
                        type="checkbox"
                        checked={bail}
                        onChange={e => setBail(e.target.checked)}
                        className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-0 focus:ring-offset-0"
                      />
                      <span>Stop run on first failure (Bail)</span>
                    </label>
                  </div>
                </div>

                {/* Data File (CSV / JSON) */}
                <div className="space-y-3 rounded-lg border border-zinc-700/60 bg-zinc-800/50 p-4">
                  <h3 className="flex items-center justify-between text-xs font-bold tracking-wider text-zinc-400 uppercase">
                    <span className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-amber-400" /> Data File (CSV / JSON)
                    </span>
                    {dataFile && (
                      <button
                        onClick={() => setDataFile(null)}
                        className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-3 w-3" /> Remove
                      </button>
                    )}
                  </h3>

                  {dataFile ? (
                    <div className="space-y-1 rounded border border-zinc-700 bg-zinc-900/80 p-3 text-xs">
                      <div className="flex items-center gap-2 font-semibold text-zinc-200">
                        <FileText className="h-4 w-4 text-blue-400" /> {dataFile.filename}
                      </div>
                      <div className="text-zinc-400">
                        Loaded{' '}
                        <strong className="text-zinc-200">{dataFile.rows.length} rows</strong>
                      </div>
                      {dataFile.headers.length > 0 && (
                        <div className="pt-1 text-[11px] text-zinc-400">
                          Variables:{' '}
                          <span className="font-mono text-zinc-300">
                            {dataFile.headers.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <Button
                        variant="secondary"
                        size="compact"
                        onClick={handleOpenDataFile}
                        className="flex w-full items-center justify-center gap-2"
                      >
                        <Upload className="h-3.5 w-3.5" /> Select CSV or JSON File...
                      </Button>
                      <p className="mt-1.5 text-[11px] text-zinc-400">
                        Each row in the dataset parameterizes requests across iterations.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Request Selection & Execution Order */}
              <div className="flex flex-col overflow-hidden rounded-lg border border-zinc-700/60 bg-zinc-800/50">
                <div className="flex items-center justify-between border-b border-zinc-700/60 bg-zinc-900/40 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold tracking-wider text-zinc-400 uppercase">
                      Requests to Execute ({selectedReqIds.size}/{availableRequests.length})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      onClick={() => handleSelectAll(true)}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      All
                    </button>
                    <span className="text-zinc-600">|</span>
                    <button
                      onClick={() => handleSelectAll(false)}
                      className="text-zinc-400 hover:text-zinc-300"
                    >
                      None
                    </button>
                  </div>
                </div>

                <div className="max-h-[460px] flex-1 space-y-1 overflow-y-auto p-2">
                  {availableRequests.length === 0 ? (
                    <div className="p-8 text-center text-xs text-zinc-400">
                      No requests found in this folder.
                    </div>
                  ) : (
                    availableRequests.map((req, index) => {
                      const isSelected = selectedReqIds.has(req.id);
                      return (
                        <label
                          key={req.id}
                          className={`flex cursor-pointer items-center gap-3 rounded p-2 text-xs transition ${
                            isSelected
                              ? 'bg-zinc-800/80 hover:bg-zinc-800'
                              : 'opacity-50 hover:opacity-80'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleRequest(req.id)}
                            className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900 text-blue-600"
                          />
                          <span className="w-4 font-mono text-[11px] text-zinc-400">
                            {index + 1}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              req.method === 'GET'
                                ? 'bg-blue-900/50 text-blue-400'
                                : req.method === 'POST'
                                  ? 'bg-emerald-900/50 text-emerald-400'
                                  : req.method === 'PUT'
                                    ? 'bg-amber-900/50 text-amber-400'
                                    : 'bg-rose-900/50 text-rose-400'
                            }`}
                          >
                            {req.method}
                          </span>
                          <span className="flex-1 truncate font-medium text-zinc-200">
                            {req.name}
                          </span>
                          {req.folderPath && (
                            <span className="flex items-center gap-1 text-[10px] text-zinc-400">
                              <Folder className="h-3 w-3 text-zinc-400" /> {req.folderPath}
                            </span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Configure Footer */}
            <div className="mt-auto flex justify-end gap-3 border-t border-zinc-800 bg-zinc-900/60 p-4">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleStartRun}
                disabled={selectedReqIds.size === 0}
                className="flex items-center gap-2"
              >
                <Play className="h-4 w-4 fill-current" /> Run Collection
              </Button>
            </div>
          </div>
        )}

        {/* ==================== SCREEN 2: RUNNING ==================== */}
        {step === 'running' && (
          <div className="flex flex-1 flex-col overflow-hidden p-4">
            {/* Header progress bar */}
            <div className="mb-4 rounded-lg border border-zinc-700/60 bg-zinc-800/80 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />
                  <span>
                    Iteration {progress?.iteration || 1} of{' '}
                    {progress?.totalIterations || iterations}
                  </span>
                  <span className="text-zinc-500">•</span>
                  <span className="text-xs text-zinc-400">
                    Request {progress?.requestIndex || 1} of{' '}
                    {progress?.totalRequestsInIteration || selectedReqIds.size}
                  </span>
                </div>
                <Button
                  variant="danger"
                  size="compact"
                  onClick={handleCancelRun}
                  className="flex items-center gap-1.5"
                >
                  <Square className="h-3.5 w-3.5 fill-current" /> Stop Run
                </Button>
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-900">
                <div
                  className="h-2 rounded-full bg-blue-500 transition-all duration-200"
                  style={{
                    width: `${
                      progress
                        ? Math.min(
                            100,
                            Math.round(
                              (((progress.iteration - 1) * progress.totalRequestsInIteration +
                                progress.requestIndex) /
                                (progress.totalIterations * progress.totalRequestsInIteration)) *
                                100,
                            ),
                          )
                        : 5
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Realtime execution log stream */}
            <div className="flex-1 space-y-2 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
              {liveResults.map((result, idx) => {
                const rowKey = `${result.iteration}-${result.id}-${idx}`;
                const isExpanded = expandedResults.has(rowKey);

                return (
                  <div
                    key={rowKey}
                    className={`rounded border p-2.5 text-xs transition ${
                      result.passed
                        ? 'border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/40'
                        : 'border-red-900/50 bg-red-950/20'
                    }`}
                  >
                    <div
                      className="flex cursor-pointer items-center gap-2.5"
                      onClick={() => toggleResultExpanded(rowKey)}
                    >
                      <span className="font-mono text-[11px] text-zinc-400">
                        #{result.iteration}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          result.method === 'GET'
                            ? 'bg-blue-900/50 text-blue-400'
                            : result.method === 'POST'
                              ? 'bg-emerald-900/50 text-emerald-400'
                              : 'bg-zinc-800 text-zinc-300'
                        }`}
                      >
                        {result.method}
                      </span>
                      <span className="flex-1 truncate font-semibold text-zinc-200">
                        {result.name}
                      </span>
                      <span className="max-w-[200px] truncate font-mono text-[11px] text-zinc-400">
                        {result.url}
                      </span>

                      {/* Status */}
                      {result.status ? (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                            result.passed
                              ? 'bg-emerald-950/60 text-emerald-400'
                              : 'bg-rose-950/60 text-rose-400'
                          }`}
                        >
                          {result.status}
                        </span>
                      ) : (
                        <span className="rounded bg-rose-950/60 px-1.5 py-0.5 text-[11px] font-semibold text-rose-400">
                          ERROR
                        </span>
                      )}

                      <span className="w-12 text-right text-[11px] text-zinc-400">
                        {result.durationMs}ms
                      </span>
                      {result.assertions.length > 0 && (
                        <span className="text-zinc-400 hover:text-zinc-200">
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </span>
                      )}
                    </div>

                    {/* Expandable assertions */}
                    {isExpanded && result.assertions.length > 0 && (
                      <div className="mt-2 space-y-1 border-t border-zinc-800 pt-2 pl-4">
                        {result.assertions.map((a, aIdx) => (
                          <div key={aIdx} className="flex items-center gap-2 text-[11px]">
                            {a.passed ? (
                              <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 flex-shrink-0 text-rose-400" />
                            )}
                            <span className={a.passed ? 'text-zinc-300' : 'text-rose-300'}>
                              {a.name}
                            </span>
                            {a.message && !a.passed && (
                              <span className="text-[10px] text-rose-400">({a.message})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== SCREEN 3: COMPLETED ==================== */}
        {step === 'completed' && summary && (
          <div className="flex flex-1 flex-col overflow-hidden p-4">
            {/* Top Metric Cards */}
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div
                className={`flex flex-col justify-between rounded-lg border p-3 ${
                  summary.success
                    ? 'border-emerald-800/60 bg-emerald-950/30'
                    : 'border-rose-800/60 bg-rose-950/30'
                }`}
              >
                <div className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                  Result
                </div>
                <div
                  className={`mt-1 text-xl font-bold ${
                    summary.success ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {summary.success ? 'PASSED' : summary.stoppedEarly ? 'STOPPED' : 'FAILED'}
                </div>
                <div className="mt-1 text-[11px] text-zinc-400">
                  {(summary.totalDurationMs / 1000).toFixed(2)}s duration
                </div>
              </div>

              <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-3">
                <div className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                  Requests
                </div>
                <div className="mt-1 text-xl font-bold text-zinc-200">
                  {summary.passedRequests} / {summary.totalRequests}
                </div>
                <div className="mt-1 text-[11px] text-zinc-400">
                  {summary.failedRequests === 0
                    ? '100% Passed'
                    : `${summary.failedRequests} Failed`}
                </div>
              </div>

              <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-3">
                <div className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                  Assertions
                </div>
                <div className="mt-1 text-xl font-bold text-zinc-200">
                  {summary.passedAssertions} / {summary.totalAssertions}
                </div>
                <div className="mt-1 text-[11px] text-zinc-400">
                  {summary.failedAssertions === 0
                    ? 'All passed'
                    : `${summary.failedAssertions} Failed`}
                </div>
              </div>

              <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-3">
                <div className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                  Iterations
                </div>
                <div className="mt-1 text-xl font-bold text-zinc-200">
                  {summary.totalIterations}
                </div>
                <div className="mt-1 text-[11px] text-zinc-400">Cycles executed</div>
              </div>
            </div>

            {/* Results scroll list */}
            <div className="mb-4 flex-1 space-y-2 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
              {summary.results.map((result, idx) => {
                const rowKey = `${result.iteration}-${result.id}-${idx}`;
                const isExpanded = expandedResults.has(rowKey);

                return (
                  <div
                    key={rowKey}
                    className={`rounded border p-2.5 text-xs ${
                      result.passed
                        ? 'border-zinc-800 bg-zinc-900/40'
                        : 'border-red-900/50 bg-red-950/20'
                    }`}
                  >
                    <div
                      className="flex cursor-pointer items-center gap-2.5"
                      onClick={() => toggleResultExpanded(rowKey)}
                    >
                      <span className="font-mono text-[11px] text-zinc-400">
                        #{result.iteration}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          result.method === 'GET'
                            ? 'bg-blue-900/50 text-blue-400'
                            : result.method === 'POST'
                              ? 'bg-emerald-900/50 text-emerald-400'
                              : 'bg-zinc-800 text-zinc-300'
                        }`}
                      >
                        {result.method}
                      </span>
                      <span className="flex-1 truncate font-semibold text-zinc-200">
                        {result.name}
                      </span>
                      <span className="max-w-[200px] truncate font-mono text-[11px] text-zinc-400">
                        {result.url}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                          result.passed
                            ? 'bg-emerald-950/60 text-emerald-400'
                            : 'bg-rose-950/60 text-rose-400'
                        }`}
                      >
                        {result.status || 'ERROR'}
                      </span>
                      <span className="w-12 text-right text-[11px] text-zinc-400">
                        {result.durationMs}ms
                      </span>
                      {result.assertions.length > 0 && (
                        <span className="text-zinc-400 hover:text-zinc-200">
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </span>
                      )}
                    </div>

                    {/* Expanded assertions */}
                    {isExpanded && result.assertions.length > 0 && (
                      <div className="mt-2 space-y-1 border-t border-zinc-800 pt-2 pl-4">
                        {result.assertions.map((a, aIdx) => (
                          <div key={aIdx} className="flex items-center gap-2 text-[11px]">
                            {a.passed ? (
                              <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 flex-shrink-0 text-rose-400" />
                            )}
                            <span className={a.passed ? 'text-zinc-300' : 'text-rose-300'}>
                              {a.name}
                            </span>
                            {a.message && !a.passed && (
                              <span className="text-[10px] text-rose-400">({a.message})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Results Footer Actions */}
            <div className="flex items-center justify-between border-t border-zinc-800 pt-2">
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="compact"
                  onClick={handleExportJson}
                  className="flex items-center gap-1.5"
                >
                  <FileCode className="h-3.5 w-3.5" /> Export JSON
                </Button>
                <Button
                  variant="secondary"
                  size="compact"
                  onClick={handleExportHtml}
                  className="flex items-center gap-1.5"
                >
                  <FileText className="h-3.5 w-3.5" /> Export HTML Report
                </Button>
              </div>

              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setStep('configure')}>
                  Run Again
                </Button>
                <Button variant="primary" onClick={onClose}>
                  Done
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
