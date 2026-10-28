import React, { useEffect, useRef, useCallback } from 'react';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { RequestTabs } from './components/RequestTabs';
import { UrlBar } from './components/UrlBar';
import { RequestPanel } from './components/RequestPanel';
import { ResponsePanel } from './components/ResponsePanel';
import { StatusBar } from './components/StatusBar';
import { ToastContainer } from './components/ui/Toast';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { useAppStore } from './stores/appStore';
import { useCollectionStore } from './stores/collectionStore';
import { useRequestStore } from './stores/requestStore';
import { matchesShortcut } from './lib/shortcuts';
import { parseUrlQueryParams, syncUrlWithParams } from './lib/url-sync';
import type { ThemeMode } from './lib/theme';
import type { KeyValueRow } from './components/ui/KeyValueTable';

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
    environment,
    setEnvironment,
    version,
    setVersion,
    toasts,
    addToast,
    removeToast,
    shortcutsModalOpen,
    setShortcutsModalOpen,
  } = useAppStore();

  // 2. Collection store
  const { activeCollection } = useCollectionStore();

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
    openRequest,
    closeTab,
    updateActiveDraft,
    saveActiveDraft,
    setLoading,
    setResult,
    setError,
    setActiveExecutionId,
    incrementHistoryCount,
  } = useRequestStore();

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
    }
  }, [setVersion, updateActiveDraft]);

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
  const handleSave = useCallback(() => {
    saveActiveDraft();
    addToast({
      type: 'success',
      message: 'Request saved',
    });
  }, [saveActiveDraft, addToast]);

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

    // Build headers array (only enabled with names)
    const finalHeaders = activeDraft.headers
      .filter(row => row.enabled && row.key.trim() !== '')
      .map(row => ({ name: row.key.trim(), value: row.value, enabled: true }));

    // Prepare auth configuration
    let authConfig = undefined;
    if (activeDraft.authType === 'bearer' && activeDraft.bearerToken) {
      authConfig = { type: 'bearer' as const, token: activeDraft.bearerToken };
    } else if (
      activeDraft.authType === 'basic' &&
      (activeDraft.basicUser || activeDraft.basicPass)
    ) {
      authConfig = {
        type: 'basic' as const,
        username: activeDraft.basicUser,
        password: activeDraft.basicPass,
      };
    } else if (activeDraft.authType === 'apiKey' && activeDraft.apiKeyName) {
      authConfig = {
        type: 'apikey' as const,
        key: activeDraft.apiKeyName,
        value: activeDraft.apiKeyValue,
        in: activeDraft.apiKeyIn || ('header' as const),
      };
    }

    // Prepare body payload based on type
    let bodyPayload = undefined;
    if (activeDraft.bodyType === 'json' || activeDraft.bodyType === 'text') {
      if (activeDraft.bodyContent) {
        bodyPayload = { type: activeDraft.bodyType, content: activeDraft.bodyContent };
      }
    } else if (activeDraft.bodyType === 'form') {
      const enabledForm = (activeDraft.bodyFormRows || [])
        .filter(r => r.enabled && r.key.trim() !== '')
        .map(r => ({ name: r.key.trim(), value: r.value, enabled: true }));
      if (enabledForm.length > 0) {
        bodyPayload = { type: 'form' as const, form: enabledForm };
      }
    } else if (activeDraft.bodyType === 'multipart') {
      const enabledMultipart = (activeDraft.bodyMultipartRows || [])
        .filter(r => r.enabled && r.key.trim() !== '')
        .map(r => ({
          name: r.key.trim(),
          value: r.value,
          type: r.type,
          isFile: r.type === 'file',
          enabled: true,
        }));
      if (enabledMultipart.length > 0) {
        bodyPayload = { type: 'multipart' as const, form: enabledMultipart };
      }
    }

    const { requestId, promise } = window.reqitApi.sendRequest({
      version: 1,
      name: activeDraft.name,
      method: activeDraft.method,
      url: activeDraft.url,
      headers: finalHeaders.length > 0 ? finalHeaders : undefined,
      auth: authConfig,
      body: bodyPayload,
    });

    setActiveExecutionId(requestId);

    try {
      const res = await promise;
      setResult(res);
      incrementHistoryCount();
    } catch (err: unknown) {
      const errStr = err instanceof Error ? err.message : String(err);
      let cause = 'Connection refused or request aborted.';
      let action = 'Check that the destination server is running and accessible.';

      if (errStr.includes('ECONNREFUSED')) {
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
  }, [activeDraft, setLoading, setError, setResult, setActiveExecutionId, incrementHistoryCount]);

  // Cancel request execution
  const handleCancel = useCallback(async () => {
    if (activeExecutionId && window.reqitApi) {
      await window.reqitApi.cancelRequest(activeExecutionId);
      setLoading(false);
      setActiveExecutionId(null);
    }
  }, [activeExecutionId, setLoading, setActiveExecutionId]);

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

      // 8. Shortcuts cheat sheet (Ctrl/Cmd + /)
      if (matchesShortcut(e, 'Ctrl+/')) {
        e.preventDefault();
        setShortcutsModalOpen(true);
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
  ]);

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

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden select-none bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* 1. Top Bar (40px) */}
      <TopBar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={toggleSidebar}
        activeEnvironment={environment}
        onEnvironmentChange={setEnvironment}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        collectionName={activeCollection.name}
        onOpenShortcuts={() => setShortcutsModalOpen(true)}
      />

      {/* 2. Middle Area: Sidebar + Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar (280px resizable, collapsible) */}
        {sidebarOpen && (
          <Sidebar
            width={sidebarWidth}
            onWidthChange={setSidebarWidth}
            requests={requestsList}
            activeRequestId={activeRequestId}
            onSelectRequest={openRequest}
            onNewRequest={() => createRequest()}
          />
        )}

        {/* Main Workspace Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[var(--bg-base)]">
          {/* Request Tabs (32px) */}
          <RequestTabs
            tabs={tabs}
            activeTabId={activeRequestId}
            onSelectTab={openRequest}
            onCloseTab={closeTab}
            onNewTab={() => createRequest()}
          />

          {/* URL Bar (32px) */}
          <UrlBar
            method={activeDraft.method}
            onMethodChange={m => updateActiveDraft({ method: m })}
            url={activeDraft.url}
            onUrlChange={handleUrlChange}
            onSend={handleSend}
            onCancel={handleCancel}
            loading={loading}
            knownVariables={KNOWN_VARIABLES}
          />

          {/* Split Panes: Request Panel (top) + Response Panel (bottom) */}
          <div ref={containerRef} className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
            {/* Request Panel (min 200px) */}
            <div
              style={{ height: `${splitHeight}px` }}
              className="shrink-0 flex flex-col min-h-[200px] overflow-hidden"
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
                knownVariables={KNOWN_VARIABLES}
              />
            </div>

            {/* Drag Handle / Split Divider */}
            <div
              onMouseDown={handleSplitResize}
              className="h-[5px] w-full border-t border-b cursor-row-resize hover:bg-[var(--accent)] transition-fast select-none shrink-0 relative z-10 flex items-center justify-center"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--bg-surface)',
              }}
              title="Resize panels"
              aria-hidden="true"
            >
              <div
                className="w-8 h-[2px] rounded-full"
                style={{ backgroundColor: 'var(--border-strong)' }}
              />
            </div>

            {/* Response Panel (bottom pane, min 200px) */}
            <div className="flex-1 min-h-[200px] overflow-hidden">
              <ResponsePanel result={result} error={error} loading={loading} onSend={handleSend} />
            </div>
          </div>
        </main>
      </div>

      {/* 3. Status Bar (24px) */}
      <StatusBar
        branch="master"
        environmentName={environment === 'none' ? 'No environment' : environment}
        historyCount={historyCount}
        version={version}
      />

      {/* 4. Global Modals and Toasts */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
      <ShortcutsDialog isOpen={shortcutsModalOpen} onClose={() => setShortcutsModalOpen(false)} />
    </div>
  );
}
