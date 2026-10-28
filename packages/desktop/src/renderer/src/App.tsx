import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { HttpMethod, ResponseResult } from '@reqit/core';
import { TopBar } from './components/TopBar';
import { Sidebar, type RequestItem } from './components/Sidebar';
import { RequestTabs, type TabItemData } from './components/RequestTabs';
import { UrlBar } from './components/UrlBar';
import { RequestPanel, type AuthType, type BodyType } from './components/RequestPanel';
import { ResponsePanel } from './components/ResponsePanel';
import { StatusBar } from './components/StatusBar';
import type { KeyValueRow } from './components/ui/KeyValueTable';
import { getStoredTheme, applyTheme, type ThemeMode } from './lib/theme';
import { strings } from './lib/strings';

const INITIAL_REQUEST: RequestItem = {
  id: 'req-1',
  name: 'Smoke test GET',
  method: 'GET',
  url: 'https://httpbin.org/get',
};

export default function App(): React.JSX.Element {
  // Theme state
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);

  // App version
  const [version, setVersion] = useState<string>('0.1.0');

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [sidebarWidth, setSidebarWidth] = useState<number>(260);

  // Environment state
  const [environment, setEnvironment] = useState<string>('none');

  // Split height state (vertical split between request and response)
  const [requestSplitHeight, setRequestSplitHeight] = useState<number>(300);

  // Active request and tabs state
  const [requests, setRequests] = useState<RequestItem[]>([INITIAL_REQUEST]);
  const [activeRequestId, setActiveRequestId] = useState<string>(INITIAL_REQUEST.id);
  const [tabs, setTabs] = useState<TabItemData[]>([
    {
      id: INITIAL_REQUEST.id,
      name: INITIAL_REQUEST.name,
      method: INITIAL_REQUEST.method,
    },
  ]);

  // Request form state
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [url, setUrl] = useState<string>(INITIAL_REQUEST.url);
  const [params, setParams] = useState<KeyValueRow[]>([]);
  const [headers, setHeaders] = useState<KeyValueRow[]>([]);
  const [authType, setAuthType] = useState<AuthType>('none');
  const [bearerToken, setBearerToken] = useState<string>('');
  const [basicUser, setBasicUser] = useState<string>('');
  const [basicPass, setBasicPass] = useState<string>('');
  const [apiKeyName, setApiKeyName] = useState<string>('');
  const [apiKeyValue, setApiKeyValue] = useState<string>('');
  const [bodyType, setBodyType] = useState<BodyType>('none');
  const [bodyContent, setBodyContent] = useState<string>('');

  // Execution state
  const [loading, setLoading] = useState<boolean>(false);
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(null);
  const [result, setResult] = useState<ResponseResult | null>(null);
  const [error, setError] = useState<{ message: string; cause?: string; action?: string } | null>(
    null,
  );
  const [historyCount, setHistoryCount] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize from preload API
  useEffect(() => {
    if (window.reqitApi) {
      window.reqitApi.getVersion().then(v => setVersion(v));
      window.reqitApi.getTestUrl().then(testUrl => {
        if (testUrl) {
          setUrl(testUrl);
          setRequests(prev =>
            prev.map(r => (r.id === INITIAL_REQUEST.id ? { ...r, url: testUrl } : r)),
          );
        }
      });
    }
  }, []);

  // Theme toggle cycle: system -> light -> dark -> system
  const handleToggleTheme = () => {
    const nextTheme: ThemeMode =
      theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  // Execute request
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

    // Build URL with enabled query params
    let finalUrl = url;
    const enabledParams = params.filter(p => p.enabled && p.key.trim() !== '');
    if (enabledParams.length > 0) {
      try {
        const parsedUrl = new URL(url);
        for (const p of enabledParams) {
          parsedUrl.searchParams.append(p.key.trim(), p.value);
        }
        finalUrl = parsedUrl.toString();
      } catch {
        // Fallback if URL is relative or variable template
      }
    }

    // Build headers and params arrays
    const finalHeaders = headers
      .filter(row => row.enabled && row.key.trim() !== '')
      .map(row => ({ name: row.key.trim(), value: row.value, enabled: true }));

    const finalParams = params
      .filter(row => row.enabled && row.key.trim() !== '')
      .map(row => ({ name: row.key.trim(), value: row.value, enabled: true }));

    // Prepare auth configuration
    let authConfig = undefined;
    if (authType === 'bearer' && bearerToken) {
      authConfig = { type: 'bearer' as const, token: bearerToken };
    } else if (authType === 'basic' && (basicUser || basicPass)) {
      authConfig = { type: 'basic' as const, username: basicUser, password: basicPass };
    } else if (authType === 'apiKey' && apiKeyName) {
      authConfig = {
        type: 'apikey' as const,
        key: apiKeyName,
        value: apiKeyValue,
        in: 'header' as const,
      };
    }

    const { requestId, promise } = window.reqitApi.sendRequest({
      version: 1,
      name: requests.find(r => r.id === activeRequestId)?.name || 'Smoke Test GET',
      method,
      url: finalUrl,
      params: finalParams.length > 0 ? finalParams : undefined,
      headers: finalHeaders.length > 0 ? finalHeaders : undefined,
      auth: authConfig,
      body:
        bodyType !== 'none' && bodyContent ? { type: bodyType, content: bodyContent } : undefined,
    });

    setActiveExecutionId(requestId);

    try {
      const res = await promise;
      setResult(res);
      setHistoryCount(c => c + 1);
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
  }, [
    url,
    method,
    params,
    headers,
    authType,
    bearerToken,
    basicUser,
    basicPass,
    apiKeyName,
    apiKeyValue,
    bodyType,
    bodyContent,
    requests,
    activeRequestId,
  ]);

  // Cancel request
  const handleCancel = useCallback(async () => {
    if (activeExecutionId && window.reqitApi) {
      await window.reqitApi.cancelRequest(activeExecutionId);
      setLoading(false);
      setActiveExecutionId(null);
    }
  }, [activeExecutionId]);

  // Keyboard shortcuts (Section 10.1)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter: Send
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (!loading) {
          handleSend();
        }
      }
      // Escape while in flight: Cancel
      if (e.key === 'Escape' && loading) {
        e.preventDefault();
        handleCancel();
      }
      // Ctrl/Cmd + B: Toggle Sidebar
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        setSidebarOpen(prev => !prev);
      }
      // Ctrl/Cmd + L: Focus URL bar
      if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        document.getElementById('url-input')?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, handleSend, handleCancel]);

  // New request handler
  const handleNewRequest = () => {
    const newId = `req-${Date.now()}`;
    const newReq: RequestItem = {
      id: newId,
      name: `${strings.sidebar.newRequest} ${requests.length + 1}`,
      method: 'GET',
      url: 'https://httpbin.org/get',
    };
    setRequests(prev => [...prev, newReq]);
    setTabs(prev => [...prev, { id: newId, name: newReq.name, method: 'GET' }]);
    setActiveRequestId(newId);
    setMethod('GET');
    setUrl('https://httpbin.org/get');
    setResult(null);
    setError(null);
  };

  // Close tab handler
  const handleCloseTab = (id: string) => {
    if (tabs.length === 1) return; // Keep at least one tab open
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeRequestId === id) {
      const nextActive = newTabs[newTabs.length - 1];
      if (nextActive) {
        setActiveRequestId(nextActive.id);
        const req = requests.find(r => r.id === nextActive.id);
        if (req) {
          setMethod(req.method);
          setUrl(req.url);
        }
      }
    }
  };

  // Split resize handle
  const handleSplitResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = requestSplitHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      const totalHeight = containerRef.current.clientHeight;
      const delta = moveEvent.clientY - startY;
      const newHeight = Math.max(200, Math.min(totalHeight - 200, startHeight + delta));
      setRequestSplitHeight(newHeight);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden select-none bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* 1. Top Bar (40px) */}
      <TopBar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(prev => !prev)}
        activeEnvironment={environment}
        onEnvironmentChange={setEnvironment}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* 2. Middle Area: Sidebar + Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar (280px resizable, collapsible) */}
        {sidebarOpen && (
          <Sidebar
            width={sidebarWidth}
            onWidthChange={setSidebarWidth}
            requests={requests}
            activeRequestId={activeRequestId}
            onSelectRequest={id => {
              setActiveRequestId(id);
              const found = requests.find(r => r.id === id);
              if (found) {
                setMethod(found.method);
                setUrl(found.url);
                if (!tabs.some(t => t.id === id)) {
                  setTabs(prev => [...prev, { id, name: found.name, method: found.method }]);
                }
              }
            }}
            onNewRequest={handleNewRequest}
          />
        )}

        {/* Main Workspace Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[var(--bg-base)]">
          {/* Request Tabs (32px) */}
          <RequestTabs
            tabs={tabs}
            activeTabId={activeRequestId}
            onSelectTab={id => {
              setActiveRequestId(id);
              const found = requests.find(r => r.id === id);
              if (found) {
                setMethod(found.method);
                setUrl(found.url);
              }
            }}
            onCloseTab={handleCloseTab}
            onNewTab={handleNewRequest}
          />

          {/* URL Bar (32px) */}
          <UrlBar
            method={method}
            onMethodChange={setMethod}
            url={url}
            onUrlChange={setUrl}
            onSend={handleSend}
            onCancel={handleCancel}
            loading={loading}
          />

          {/* Split Panes: Request Panel (top) + Response Panel (bottom) */}
          <div ref={containerRef} className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
            {/* Request Panel (min 200px) */}
            <div
              style={{ height: `${requestSplitHeight}px` }}
              className="shrink-0 flex flex-col min-h-[200px] overflow-hidden"
            >
              <RequestPanel
                params={params}
                onParamsChange={setParams}
                headers={headers}
                onHeadersChange={setHeaders}
                authType={authType}
                onAuthTypeChange={setAuthType}
                bearerToken={bearerToken}
                onBearerTokenChange={setBearerToken}
                basicUser={basicUser}
                onBasicUserChange={setBasicUser}
                basicPass={basicPass}
                onBasicPassChange={setBasicPass}
                apiKeyName={apiKeyName}
                onApiKeyNameChange={setApiKeyName}
                apiKeyValue={apiKeyValue}
                onApiKeyValueChange={setApiKeyValue}
                bodyType={bodyType}
                onBodyTypeChange={setBodyType}
                bodyContent={bodyContent}
                onBodyContentChange={setBodyContent}
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
        environmentName={environment === 'none' ? strings.topBar.noEnvironment : environment}
        historyCount={historyCount}
        version={version}
      />
    </div>
  );
}
