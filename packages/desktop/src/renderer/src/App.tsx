import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { RequestTabs } from './components/RequestTabs';
import { UrlBar } from './components/UrlBar';
import { RequestPanel } from './components/RequestPanel';
import { ResponsePanel } from './components/ResponsePanel';
import { StatusBar } from './components/StatusBar';
import { ToastContainer } from './components/ui/Toast';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { NewCollectionModal } from './components/NewCollectionModal';
import { ConflictBanner } from './components/ConflictBanner';
import { DeletedBanner } from './components/DeletedBanner';
import { DiffModal } from './components/DiffModal';
import { EnvironmentSecretsModal } from './components/EnvironmentSecretsModal';
import { HistoryDetailModal } from './components/HistoryDetailModal';
import { HistorySettingsModal } from './components/HistorySettingsModal';
import { ClearHistoryConfirmModal } from './components/ClearHistoryConfirmModal';
import { ImportCurlModal } from './components/ImportCurlModal';
import { useAppStore } from './stores/appStore';
import { useCollectionStore } from './stores/collectionStore';
import { useRequestStore } from './stores/requestStore';
import { useHistoryStore } from './stores/historyStore';
import { matchesShortcut } from './lib/shortcuts';
import { parseUrlQueryParams, syncUrlWithParams } from './lib/url-sync';
import { draftToRequestFile } from './lib/request-mapper';
import { serializeRequest } from '@reqit/core/format';
import type { ThemeMode } from './lib/theme';
import type { KeyValueRow } from './components/ui/KeyValueTable';
import type { CollectionTreeNode, ShellTarget } from '@reqit/core';
import { generateCurl } from '@reqit/core/curl';
import { resolveRequest } from '@reqit/core/variables';

const KNOWN_VARIABLES = ['baseUrl', 'token', 'userId', 'apiKey', 'env', 'apiVersion', 'port'];

export default function App(): React.JSX.Element {
  // 1. App store
  const {
    theme,
    setTheme,
    sidebarOpen,
    toggleSidebar,
    sidebarWidth,
    setSidebarWidth,
    splitHeight,
    setSplitHeight,
    version,
    setVersion,
    toasts,
    addToast,
    removeToast,
    shortcutsModalOpen,
    setShortcutsModalOpen,
  } = useAppStore();

  const [newCollectionModalOpen, setNewCollectionModalOpen] = useState(false);
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [envModalOpen, setEnvModalOpen] = useState(false);
  const [envModalTab, setEnvModalTab] = useState<'environments' | 'secrets'>('environments');
  const [envModalVarName, setEnvModalVarName] = useState<string | undefined>(undefined);
  const [importCurlModalOpen, setImportCurlModalOpen] = useState(false);

  // 2. Collection store
  const {
    currentTree,
    activeCollection,
    recentCollections,
    environments,
    secrets,
    activeEnvironment,
    setActiveEnvironment,
    loadCollection,
    createCollection,
    saveRequest: storeSaveRequest,
    applyWatcherChange,
    getResolvedVariables,
  } = useCollectionStore();

  const handleOpenEnvModal = (
    tab: 'environments' | 'secrets' = 'environments',
    varName?: string,
  ) => {
    setEnvModalTab(tab);
    setEnvModalVarName(varName);
    setEnvModalOpen(true);
  };

  // 3. Request store
  const {
    drafts,
    tabs,
    activeRequestId,
    result,
    error,
    loading,
    activeExecutionId,
    historyCount,
    createRequest,
    importCurlToDraft,
    openRequest,
    openDraftFromFile,
    closeTab,
    updateActiveDraft,
    saveActiveDraft,
    setLoading,
    setResult,
    setError,
    setActiveExecutionId,
    incrementHistoryCount,
    resolveConflictKeepMine,
    resolveConflictLoadDisk,
  } = useRequestStore();

  const loadHistoryEntries = useHistoryStore(s => s.loadEntries);

  const activeDraft = drafts[activeRequestId] || {
    id: activeRequestId,
    name: 'Untitled',
    method: 'GET',
    url: 'https://httpbin.org/get',
    params: [],
    headers: [],
    authType: 'none',
    bearerToken: '',
    basicUser: '',
    basicPass: '',
    apiKeyName: '',
    apiKeyValue: '',
    apiKeyIn: 'header',
    bodyType: 'none',
    bodyContent: '',
    bodyFormRows: [],
    bodyMultipartRows: [],
    isDirty: false,
  };

  const variablesMap = React.useMemo(() => {
    return getResolvedVariables(activeDraft.filePath);
  }, [
    getResolvedVariables,
    activeDraft.filePath,
    activeEnvironment,
    environments,
    secrets,
    currentTree,
  ]);

  const knownVariableNames = React.useMemo(() => {
    const names = Object.keys(variablesMap);
    return names.length > 0 ? names : KNOWN_VARIABLES;
  }, [variablesMap]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize from preload API
  useEffect(() => {
    if (window.reqitApi) {
      window.reqitApi.getVersion().then(v => setVersion(v));
      window.reqitApi.getTestUrl().then(testUrl => {
        if (testUrl) {
          updateActiveDraft({ url: testUrl });
        }
      });
      window.reqitApi.getRecentCollections().then(recents => {
        if (recents && recents.length > 0 && recents[0]) {
          loadCollection(recents[0]);
        }
      });
    }
  }, [setVersion, updateActiveDraft, loadCollection]);

  // Subscribe to live file watcher changes from main process (Phase 10)
  useEffect(() => {
    if (!window.reqitApi?.onCollectionChange) return;
    const unsubscribe = window.reqitApi.onCollectionChange(event => {
      applyWatcherChange(event);
    });
    return () => {
      unsubscribe();
    };
  }, [applyWatcherChange]);

  // Theme toggle cycle: system -> light -> dark -> system
  const handleToggleTheme = () => {
    const nextTheme: ThemeMode =
      theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    setTheme(nextTheme);
  };

  // Bidirectional URL <-> Params sync
  const handleUrlChange = useCallback(
    (newUrl: string) => {
      const newParams = parseUrlQueryParams(newUrl, activeDraft.params);
      updateActiveDraft({ url: newUrl, params: newParams });
    },
    [activeDraft.params, updateActiveDraft],
  );

  const handleParamsChange = useCallback(
    (newParams: KeyValueRow[]) => {
      const syncedUrl = syncUrlWithParams(activeDraft.url, newParams);
      updateActiveDraft({ params: newParams, url: syncedUrl });
    },
    [activeDraft.url, updateActiveDraft],
  );

  // Save active request
  const handleSave = useCallback(async () => {
    if (activeDraft.filePath) {
      const reqFile = draftToRequestFile(activeDraft);
      try {
        await storeSaveRequest(activeDraft.filePath, reqFile);
        saveActiveDraft();
        addToast({
          type: 'success',
          message: `Saved ${activeDraft.name}`,
        });
      } catch (err: unknown) {
        addToast({
          type: 'error',
          message: `Failed to save: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    } else {
      saveActiveDraft();
      addToast({
        type: 'success',
        message: 'Request saved',
      });
    }
  }, [activeDraft, storeSaveRequest, saveActiveDraft, addToast]);

  // Re-create a deleted file on disk (Phase 10)
  const handleRecreateFile = useCallback(async () => {
    if (activeDraft.filePath) {
      const reqFile = draftToRequestFile(activeDraft);
      try {
        await storeSaveRequest(activeDraft.filePath, reqFile);
        saveActiveDraft();
        addToast({
          type: 'success',
          message: `Re-created ${activeDraft.name} on disk`,
        });
      } catch (err: unknown) {
        addToast({
          type: 'error',
          message: `Failed to recreate file: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }, [activeDraft, storeSaveRequest, saveActiveDraft, addToast]);

  // Send request execution
  const handleSend = useCallback(async () => {
    if (!window.reqitApi) {
      setError({
        message: 'window.reqitApi is not available.',
        cause: 'Desktop IPC bridge did not initialize.',
        action: 'Restart the desktop application.',
      });
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const reqFile = draftToRequestFile(activeDraft);
    if (activeDraft.filePath) {
      (reqFile as { filePath?: string }).filePath = activeDraft.filePath;
    }
    const { requestId, promise } = window.reqitApi.sendRequest(reqFile, undefined, {
      activeEnvironment,
      collectionPath: currentTree?.rootPath,
    });

    setActiveExecutionId(requestId);

    try {
      const res = await promise;
      setResult(res);
      incrementHistoryCount();
      loadHistoryEntries();
    } catch (err: unknown) {
      loadHistoryEntries();
      const errStr = err instanceof Error ? err.message : String(err);
      let cause = 'Connection refused or request aborted.';
      let action = 'Check that the destination server is running and accessible.';

      if (errStr.includes('Undefined variable')) {
        cause =
          'The variable is not defined in any active scope (collection, folder, environment, or secrets).';
        action = 'Click "Add variable" below to define it in the active environment or collection.';
      } else if (errStr.includes('ECONNREFUSED')) {
        cause = 'Server refused the TCP connection on that port.';
        action = 'Ensure your local server is running on the specified port.';
      } else if (errStr.includes('ENOTFOUND')) {
        cause = 'DNS lookup failed for the provided hostname.';
        action = 'Check the domain name spelling and your network connection.';
      } else if (errStr.includes('timeout')) {
        cause = 'Server took longer to respond than the configured timeout.';
        action = 'Increase the request timeout or check server performance.';
      }

      setError({
        message: errStr,
        cause,
        action,
      });
    } finally {
      setLoading(false);
      setActiveExecutionId(null);
    }
  }, [
    activeDraft,
    activeEnvironment,
    currentTree?.rootPath,
    setLoading,
    setError,
    setResult,
    setActiveExecutionId,
    incrementHistoryCount,
    loadHistoryEntries,
  ]);

  // Cancel request execution
  const handleCancel = useCallback(async () => {
    if (activeExecutionId && window.reqitApi) {
      await window.reqitApi.cancelRequest(activeExecutionId);
      setLoading(false);
      setActiveExecutionId(null);
    }
  }, [activeExecutionId, setLoading, setActiveExecutionId]);

  // Import cURL command into current draft
  const handleImportCurl = useCallback(
    (curlCommand: string) => {
      try {
        const { warnings } = importCurlToDraft(activeRequestId, curlCommand);
        addToast({
          type: 'success',
          message: 'Imported request from cURL',
        });
        if (warnings.length > 0) {
          addToast({
            type: 'warning',
            message: `cURL warning: ${warnings.join('; ')}`,
          });
        }
      } catch (err: unknown) {
        addToast({
          type: 'error',
          message: `Failed to import cURL: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },
    [activeRequestId, importCurlToDraft, addToast],
  );

  // Copy active request as cURL command
  const handleCopyCurl = useCallback(
    (options: { target: ShellTarget; resolveVariables: boolean }) => {
      try {
        const baseReq = draftToRequestFile(activeDraft);
        let reqToExport = baseReq;

        if (options.resolveVariables) {
          const simpleVars: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(variablesMap)) {
            simpleVars[k] = v.value;
          }
          reqToExport = resolveRequest(
            baseReq,
            { environment: simpleVars },
            { allowUndefined: true },
          );
        }

        const curlStr = generateCurl(reqToExport, { target: options.target });
        navigator.clipboard.writeText(curlStr);

        const targetName =
          options.target === 'bash'
            ? 'Bash'
            : options.target === 'powershell'
              ? 'PowerShell'
              : 'cmd';
        const modeName = options.resolveVariables ? 'Resolved' : 'Raw';

        addToast({
          type: 'success',
          message: `Copied as cURL (${targetName}, ${modeName})`,
        });
      } catch (err: unknown) {
        addToast({
          type: 'error',
          message: `Failed to copy cURL: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },
    [activeDraft, variablesMap, addToast],
  );

  // Keyboard shortcut registry listener (Section 10.1)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Send request (Ctrl/Cmd + Enter)
      if (matchesShortcut(e, 'Ctrl+Enter')) {
        e.preventDefault();
        if (!loading) handleSend();
        return;
      }

      // 2. Cancel request (Escape while loading)
      if (e.key === 'Escape' && loading) {
        e.preventDefault();
        handleCancel();
        return;
      }

      // 3. Save request (Ctrl/Cmd + S)
      if (matchesShortcut(e, 'Ctrl+S')) {
        e.preventDefault();
        handleSave();
        return;
      }

      // 4. Toggle sidebar (Ctrl/Cmd + B)
      if (matchesShortcut(e, 'Ctrl+B')) {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // 5. Focus URL bar (Ctrl/Cmd + L)
      if (matchesShortcut(e, 'Ctrl+L')) {
        e.preventDefault();
        document.getElementById('url-input')?.focus();
        return;
      }

      // 6. New request (Ctrl/Cmd + N)
      if (matchesShortcut(e, 'Ctrl+N')) {
        e.preventDefault();
        createRequest();
        return;
      }

      // 7. Close tab (Ctrl/Cmd + W)
      if (matchesShortcut(e, 'Ctrl+W')) {
        e.preventDefault();
        closeTab(activeRequestId);
        return;
      }

      // 8. Open collection (Ctrl/Cmd + O)
      if (matchesShortcut(e, 'Ctrl+O')) {
        e.preventDefault();
        loadCollection();
        return;
      }

      // 9. Shortcuts cheat sheet (Ctrl/Cmd + /)
      if (matchesShortcut(e, 'Ctrl+/')) {
        e.preventDefault();
        setShortcutsModalOpen(true);
        return;
      }

      // 10. Import cURL (Ctrl/Cmd + I)
      if (matchesShortcut(e, 'Ctrl+I')) {
        e.preventDefault();
        setImportCurlModalOpen(true);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    loading,
    handleSend,
    handleCancel,
    handleSave,
    toggleSidebar,
    createRequest,
    closeTab,
    activeRequestId,
    setShortcutsModalOpen,
    setImportCurlModalOpen,
    loadCollection,
  ]);

  // Request node selection handler
  const handleSelectRequestNode = useCallback(
    (node: CollectionTreeNode) => {
      if (node.parseError) {
        addToast({
          type: 'error',
          message: `YAML Parse Error in ${node.name}: ${node.parseError}`,
        });
        return;
      }
      if (node.request) {
        openDraftFromFile(node.path, node.request);
      }
    },
    [addToast, openDraftFromFile],
  );

  // Split resize handle
  const handleSplitResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = splitHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      const totalHeight = containerRef.current.clientHeight;
      const delta = moveEvent.clientY - startY;
      const newHeight = Math.max(200, Math.min(totalHeight - 200, startHeight + delta));
      setSplitHeight(newHeight);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const requestsList = Object.values(drafts).map(d => ({
    id: d.id,
    name: d.name,
    method: d.method,
    url: d.url,
  }));

  const tabsWithStatus = tabs.map(tab => {
    const draft = drafts[tab.id];
    return {
      ...tab,
      isDirty: draft?.isDirty,
      hasConflict: Boolean(draft?.conflict),
      isDeleted: Boolean(draft?.isDeletedOnDisk),
    };
  });

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-(--bg-base) text-(--text-primary) select-none">
      {/* 1. Top Bar (40px) */}
      <TopBar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={toggleSidebar}
        activeEnvironment={activeEnvironment}
        onEnvironmentChange={setActiveEnvironment}
        environments={environments}
        onManageEnvironments={() => handleOpenEnvModal('environments')}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        collectionName={activeCollection.name}
        collectionPath={activeCollection.path}
        onOpenShortcuts={() => setShortcutsModalOpen(true)}
        onOpenImportCurl={() => setImportCurlModalOpen(true)}
        onOpenCollection={() => loadCollection()}
        onNewCollection={() => setNewCollectionModalOpen(true)}
        recentCollections={recentCollections}
        onSelectRecentCollection={p => loadCollection(p)}
      />

      {/* 2. Middle Area: Sidebar + Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar (280px resizable, collapsible) */}
        {sidebarOpen && (
          <Sidebar
            width={sidebarWidth}
            onWidthChange={setSidebarWidth}
            tree={currentTree}
            activeRequestId={activeRequestId}
            onSelectRequestNode={handleSelectRequestNode}
            requests={requestsList}
            onSelectRequest={openRequest}
            onNewRequest={() => createRequest()}
          />
        )}

        {/* Main Workspace Area */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-(--bg-base)">
          {/* Request Tabs (32px) */}
          <RequestTabs
            tabs={tabsWithStatus}
            activeTabId={activeRequestId}
            onSelectTab={openRequest}
            onCloseTab={closeTab}
            onNewTab={() => createRequest()}
          />

          {/* Conflict Banner (Phase 10) */}
          {activeDraft.conflict && (
            <ConflictBanner
              onKeepMine={() => resolveConflictKeepMine(activeDraft.id)}
              onLoadDisk={() => resolveConflictLoadDisk(activeDraft.id)}
              onViewDiff={() => setDiffModalOpen(true)}
            />
          )}

          {/* Deleted On Disk Banner (Phase 10) */}
          {activeDraft.isDeletedOnDisk && (
            <DeletedBanner
              filePath={activeDraft.filePath}
              onRecreate={handleRecreateFile}
              onCloseTab={() => closeTab(activeDraft.id)}
            />
          )}

          {/* URL Bar (32px) */}
          <UrlBar
            method={activeDraft.method}
            onMethodChange={m => updateActiveDraft({ method: m })}
            url={activeDraft.url}
            onUrlChange={handleUrlChange}
            onSend={handleSend}
            onCancel={handleCancel}
            loading={loading}
            knownVariables={knownVariableNames}
            variablesMap={variablesMap}
            onImportCurl={handleImportCurl}
            onOpenImportCurl={() => setImportCurlModalOpen(true)}
            onCopyCurl={handleCopyCurl}
          />

          {/* Split Panes: Request Panel (top) + Response Panel (bottom) */}
          <div ref={containerRef} className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* Request Panel (min 200px) */}
            <div
              style={{ height: `${splitHeight}px` }}
              className="flex min-h-50 shrink-0 flex-col overflow-hidden"
            >
              <RequestPanel
                params={activeDraft.params}
                onParamsChange={handleParamsChange}
                headers={activeDraft.headers}
                onHeadersChange={h => updateActiveDraft({ headers: h })}
                authType={activeDraft.authType}
                onAuthTypeChange={a => updateActiveDraft({ authType: a })}
                bearerToken={activeDraft.bearerToken}
                onBearerTokenChange={t => updateActiveDraft({ bearerToken: t })}
                basicUser={activeDraft.basicUser}
                onBasicUserChange={u => updateActiveDraft({ basicUser: u })}
                basicPass={activeDraft.basicPass}
                onBasicPassChange={p => updateActiveDraft({ basicPass: p })}
                apiKeyName={activeDraft.apiKeyName}
                onApiKeyNameChange={k => updateActiveDraft({ apiKeyName: k })}
                apiKeyValue={activeDraft.apiKeyValue}
                onApiKeyValueChange={v => updateActiveDraft({ apiKeyValue: v })}
                apiKeyIn={activeDraft.apiKeyIn || 'header'}
                onApiKeyInChange={inLoc => updateActiveDraft({ apiKeyIn: inLoc })}
                bodyType={activeDraft.bodyType}
                onBodyTypeChange={b => updateActiveDraft({ bodyType: b })}
                bodyContent={activeDraft.bodyContent}
                onBodyContentChange={c => updateActiveDraft({ bodyContent: c })}
                bodyFormRows={activeDraft.bodyFormRows || []}
                onBodyFormRowsChange={rows => updateActiveDraft({ bodyFormRows: rows })}
                bodyMultipartRows={activeDraft.bodyMultipartRows || []}
                onBodyMultipartRowsChange={rows => updateActiveDraft({ bodyMultipartRows: rows })}
                knownVariables={knownVariableNames}
                variablesMap={variablesMap}
                onOpenSecrets={() => handleOpenEnvModal('secrets')}
              />
            </div>

            {/* Drag Handle / Split Divider */}
            <div
              onMouseDown={handleSplitResize}
              className="transition-fast relative z-10 flex h-1.25 w-full shrink-0 cursor-row-resize items-center justify-center border-t border-b select-none hover:bg-(--accent)"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--bg-surface)',
              }}
              title="Resize panels"
              aria-hidden="true"
            >
              <div
                className="h-0.5 w-8 rounded-full"
                style={{ backgroundColor: 'var(--border-strong)' }}
              />
            </div>

            {/* Response Panel (bottom pane, min 200px) */}
            <div className="min-h-50 flex-1 overflow-hidden">
              <ResponsePanel
                result={result}
                error={error}
                loading={loading}
                onSend={handleSend}
                onCancel={handleCancel}
                onAddVariable={varName => handleOpenEnvModal('environments', varName)}
              />
            </div>
          </div>
        </main>
      </div>

      {/* 3. Status Bar (24px) */}
      <StatusBar
        branch="master"
        environmentName={activeEnvironment === 'none' ? 'No environment' : activeEnvironment}
        historyCount={historyCount}
        version={version}
      />

      {/* 4. Global Modals and Toasts */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
      <ShortcutsDialog isOpen={shortcutsModalOpen} onClose={() => setShortcutsModalOpen(false)} />
      <NewCollectionModal
        isOpen={newCollectionModalOpen}
        onClose={() => setNewCollectionModalOpen(false)}
        onCreate={async (name, targetDir) => {
          await createCollection(name, targetDir);
        }}
      />
      <EnvironmentSecretsModal
        isOpen={envModalOpen}
        onClose={() => setEnvModalOpen(false)}
        initialTab={envModalTab}
        initialVariableName={envModalVarName}
      />
      {activeDraft.conflict && (
        <DiffModal
          isOpen={diffModalOpen}
          onClose={() => setDiffModalOpen(false)}
          requestName={activeDraft.name}
          filePath={activeDraft.filePath}
          diskContent={activeDraft.conflict.diskContent}
          localContent={serializeRequest(draftToRequestFile(activeDraft))}
          onKeepMine={() => resolveConflictKeepMine(activeDraft.id)}
          onLoadDisk={() => resolveConflictLoadDisk(activeDraft.id)}
        />
      )}
      <HistoryDetailModal />
      <HistorySettingsModal />
      <ClearHistoryConfirmModal />
      <ImportCurlModal isOpen={importCurlModalOpen} onClose={() => setImportCurlModalOpen(false)} />
    </div>
  );
}
