import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Command,
  Play,
  Save,
  Plus,
  Download,
  Code,
  PanelLeft,
  Settings,
  Cookie,
  HelpCircle,
  Key,
  Globe,
  FileText,
  Check,
  CornerDownLeft,
} from 'lucide-react';
import { useCollectionStore } from '../stores/collectionStore';
import { useRequestStore } from '../stores/requestStore';
import { useSettingsStore, type SettingsTab } from '../stores/settingsStore';
import { MethodBadge } from './ui/Badge';
import { formatKeyCombination, getEffectiveShortcut } from '../lib/shortcuts';
import type { HttpMethod, CollectionTreeNode } from '@reqit/core';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSendRequest: () => void;
  onSaveRequest: () => void;
  onNewRequest: () => void;
  onImportCurl: () => void;
  onOpenSnippets: () => void;
  onToggleSidebar: () => void;
  onOpenSettings: (tab?: SettingsTab) => void;
  onOpenCookies: () => void;
  onOpenShortcuts: () => void;
  onOpenSecrets?: () => void;
  onRunCollection?: () => void;
  onImportOpenApi?: () => void;
  onImportPostman?: () => void;
}

interface PaletteItem {
  id: string;
  category: 'action' | 'environment' | 'request';
  title: string;
  subtitle?: string;
  shortcut?: string;
  method?: HttpMethod;
  matchDetail?: string;
  icon?: React.ReactNode;
  onSelect: () => void;
}

interface FlatRequest {
  id: string;
  name: string;
  path: string;
  method: HttpMethod;
  url: string;
  bodyContent?: string;
  docs?: string;
  node: CollectionTreeNode;
}

function flattenRequests(nodes: CollectionTreeNode[]): FlatRequest[] {
  const result: FlatRequest[] = [];

  function walk(nodeList: CollectionTreeNode[]) {
    for (const node of nodeList) {
      if (node.type === 'folder' && node.children) {
        walk(node.children);
      } else if (node.type === 'request' && node.request) {
        result.push({
          id: node.id || node.path,
          name: node.name,
          path: node.path,
          method: node.request.method || 'GET',
          url: node.request.url || '',
          bodyContent:
            node.request.body?.type === 'json' || node.request.body?.type === 'text'
              ? node.request.body.content
              : undefined,
          docs: node.request.docs,
          node,
        });
      }
    }
  }

  walk(nodes);
  return result;
}

export function CommandPalette({
  isOpen,
  onClose,
  onSendRequest,
  onSaveRequest,
  onNewRequest,
  onImportCurl,
  onOpenSnippets,
  onToggleSidebar,
  onOpenSettings,
  onOpenCookies,
  onOpenShortcuts,
  onOpenSecrets,
  onRunCollection,
  onImportOpenApi,
  onImportPostman,
}: CommandPaletteProps): React.JSX.Element | null {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { currentTree, environments, activeEnvironment, setActiveEnvironment } =
    useCollectionStore();
  const { openDraftFromFile } = useRequestStore();
  const customShortcuts = useSettingsStore(s => s.settings.customShortcuts);

  // Flatten collection requests for fast fuzzy searching
  const allRequests = useMemo(() => {
    return flattenRequests(currentTree?.tree || []);
  }, [currentTree]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Compute matched items
  const filteredItems = useMemo<PaletteItem[]>(() => {
    const raw = query.trim();
    let filterMode: 'all' | 'action' | 'environment' | 'request' = 'all';
    let term = raw.toLowerCase();

    if (raw.startsWith('>')) {
      filterMode = 'action';
      term = raw.slice(1).trim().toLowerCase();
    } else if (raw.startsWith('@')) {
      filterMode = 'environment';
      term = raw.slice(1).trim().toLowerCase();
    } else if (raw.startsWith('#')) {
      filterMode = 'request';
      term = raw.slice(1).trim().toLowerCase();
    }

    const items: PaletteItem[] = [];

    // 1. Actions
    if (filterMode === 'all' || filterMode === 'action') {
      const actions: {
        id: string;
        title: string;
        subtitle: string;
        shortcutId?: string;
        icon: React.ReactNode;
        run: () => void;
      }[] = [
        {
          id: 'action-send',
          title: 'Send Request',
          subtitle: 'Execute active HTTP request in the current tab',
          shortcutId: 'request.send',
          icon: <Play className="h-4 w-4 text-emerald-500" />,
          run: onSendRequest,
        },
        {
          id: 'action-run-collection',
          title: 'Run Collection / Folder...',
          subtitle:
            'Launch the Collection Runner for batch execution, iterations, and test reports',
          icon: <Play className="h-4 w-4 text-blue-500" />,
          run: () => onRunCollection?.(),
        },
        {
          id: 'action-save',
          title: 'Save Request',
          subtitle: 'Write changes to the active request YAML file',
          shortcutId: 'request.save',
          icon: <Save className="h-4 w-4 text-blue-500" />,
          run: onSaveRequest,
        },
        {
          id: 'action-new',
          title: 'New Request',
          subtitle: 'Create a new untitled request draft',
          shortcutId: 'request.new',
          icon: <Plus className="h-4 w-4 text-violet-500" />,
          run: onNewRequest,
        },
        {
          id: 'action-curl',
          title: 'Import from cURL',
          subtitle: 'Paste and convert cURL command into request',
          shortcutId: 'request.importCurl',
          icon: <Download className="h-4 w-4 text-amber-500" />,
          run: onImportCurl,
        },
        ...(onImportPostman
          ? [
              {
                id: 'action-postman',
                title: 'Import Postman Collection',
                subtitle: 'Import v2.1 Postman collection and environments',
                icon: <Download className="h-4 w-4 text-orange-500" />,
                run: onImportPostman,
              },
            ]
          : []),
        ...(onImportOpenApi
          ? [
              {
                id: 'action-openapi',
                title: 'Import OpenAPI / Swagger',
                subtitle: 'Import OpenAPI 3.x or Swagger 2.0 (file, URL, or raw text)',
                icon: <Globe className="h-4 w-4 text-emerald-400" />,
                run: onImportOpenApi,
              },
            ]
          : []),
        {
          id: 'action-snippets',
          title: 'Generate Code Snippets',
          subtitle: 'View code in cURL, Fetch, Axios, Python, Go, Java',
          shortcutId: 'request.snippets',
          icon: <Code className="h-4 w-4 text-cyan-500" />,
          run: onOpenSnippets,
        },
        {
          id: 'action-sidebar',
          title: 'Toggle Sidebar',
          subtitle: 'Show or hide the collections sidebar',
          shortcutId: 'sidebar.toggle',
          icon: <PanelLeft className="h-4 w-4 text-zinc-400" />,
          run: onToggleSidebar,
        },
        {
          id: 'action-cookies',
          title: 'Manage Cookies',
          subtitle: 'Inspect and clear session cookies',
          icon: <Cookie className="h-4 w-4 text-amber-600" />,
          run: onOpenCookies,
        },
        {
          id: 'action-settings',
          title: 'Open Settings',
          subtitle: 'Preferences, timeout, theme, font size, and proxy',
          icon: <Settings className="h-4 w-4 text-zinc-400" />,
          run: () => onOpenSettings(),
        },
        {
          id: 'action-shortcuts',
          title: 'Keyboard Shortcuts Reference',
          subtitle: 'View and rebind keyboard shortcuts',
          shortcutId: 'shortcuts.help',
          icon: <HelpCircle className="h-4 w-4 text-zinc-400" />,
          run: onOpenShortcuts,
        },
      ];

      if (onOpenSecrets) {
        actions.push({
          id: 'action-secrets',
          title: 'Manage Secrets',
          subtitle: 'View and edit gitignored environment secrets',
          icon: <Key className="h-4 w-4 text-amber-500" />,
          run: onOpenSecrets,
        });
      }

      for (const act of actions) {
        if (
          !term ||
          act.title.toLowerCase().includes(term) ||
          act.subtitle.toLowerCase().includes(term)
        ) {
          const scKey = act.shortcutId
            ? getEffectiveShortcut(act.shortcutId, customShortcuts)
            : undefined;

          items.push({
            id: act.id,
            category: 'action',
            title: act.title,
            subtitle: act.subtitle,
            shortcut: scKey ? formatKeyCombination(scKey) : undefined,
            icon: act.icon,
            onSelect: () => {
              onClose();
              act.run();
            },
          });
        }
      }
    }

    // 2. Environments
    if (filterMode === 'all' || filterMode === 'environment') {
      const envNames = ['none', ...Object.keys(environments)];
      for (const envName of envNames) {
        const isCurrent = activeEnvironment === envName;
        const displayName = envName === 'none' ? 'No Environment' : envName;
        if (!term || displayName.toLowerCase().includes(term)) {
          items.push({
            id: `env-${envName}`,
            category: 'environment',
            title: `Switch Environment: ${displayName}`,
            subtitle: isCurrent
              ? 'Currently active environment'
              : `Switch active environment to ${displayName}`,
            icon: isCurrent ? (
              <Check className="h-4 w-4 text-emerald-500" />
            ) : (
              <Globe className="h-4 w-4 text-sky-400" />
            ),
            onSelect: () => {
              onClose();
              setActiveEnvironment(envName);
            },
          });
        }
      }
    }

    // 3. Requests (Global Search across Name, URL, Body, Docs)
    if (filterMode === 'all' || filterMode === 'request') {
      for (const req of allRequests) {
        const nameMatch = req.name.toLowerCase().includes(term);
        const urlMatch = req.url.toLowerCase().includes(term);
        const bodyMatch = Boolean(req.bodyContent && req.bodyContent.toLowerCase().includes(term));
        const docsMatch = Boolean(req.docs && req.docs.toLowerCase().includes(term));

        if (!term || nameMatch || urlMatch || bodyMatch || docsMatch) {
          let matchDetail: string | undefined = undefined;
          if (term && bodyMatch && req.bodyContent) {
            const idx = req.bodyContent.toLowerCase().indexOf(term);
            const start = Math.max(0, idx - 20);
            const end = Math.min(req.bodyContent.length, idx + term.length + 30);
            matchDetail = `Body: ...${req.bodyContent.substring(start, end).replace(/\s+/g, ' ')}...`;
          } else if (term && docsMatch && req.docs) {
            const idx = req.docs.toLowerCase().indexOf(term);
            const start = Math.max(0, idx - 20);
            const end = Math.min(req.docs.length, idx + term.length + 30);
            matchDetail = `Docs: ...${req.docs.substring(start, end).replace(/\s+/g, ' ')}...`;
          }

          items.push({
            id: `req-${req.id}`,
            category: 'request',
            title: req.name,
            subtitle: req.url || 'Empty URL',
            method: req.method,
            matchDetail,
            icon: <FileText className="h-4 w-4 text-(--text-muted)" />,
            onSelect: () => {
              onClose();
              if (req.node.request) {
                openDraftFromFile(req.path, req.node.request, false);
              }
            },
          });
        }
      }
    }

    return items;
  }, [
    query,
    allRequests,
    environments,
    activeEnvironment,
    customShortcuts,
    onSendRequest,
    onSaveRequest,
    onNewRequest,
    onImportCurl,
    onOpenSnippets,
    onToggleSidebar,
    onOpenSettings,
    onOpenCookies,
    onOpenShortcuts,
    onOpenSecrets,
    onRunCollection,
    onImportOpenApi,
    onImportPostman,
    onClose,
    setActiveEnvironment,
    openDraftFromFile,
  ]);

  // Adjust selection bounds when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems.length]);

  // Scroll active item into view
  useEffect(() => {
    const listEl = listRef.current;
    if (!listEl) return;
    const activeItem = listEl.querySelector(
      `[data-index="${selectedIndex}"]`,
    ) as HTMLElement | null;
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Key navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev =>
        filteredItems.length > 0 ? (prev - 1 + filteredItems.length) % filteredItems.length : 0,
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filteredItems[selectedIndex];
      if (item) {
        item.onSelect();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 backdrop-blur-xs select-none"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.55)' }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="animate-in fade-in zoom-in-95 flex w-full max-w-2xl flex-col overflow-hidden rounded-lg border shadow-2xl duration-100"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border)',
          maxHeight: '65vh',
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div
          className="flex items-center gap-3 border-b px-4 py-3"
          style={{ borderColor: 'var(--border)' }}
        >
          <Search className="h-5 w-5 shrink-0" style={{ color: 'var(--text-muted)' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command, search requests by name/url/body, or switch environments..."
            className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-(--text-muted)"
            style={{ color: 'var(--text-primary)' }}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-[11px] font-medium text-(--text-muted) hover:text-(--text-primary)"
            >
              Clear
            </button>
          ) : (
            <div className="flex items-center gap-1 text-[11px] text-(--text-muted)">
              <kbd className="rounded border border-(--border) bg-(--bg-elevated) px-1 py-0.5 font-mono">
                &gt; actions
              </kbd>
              <kbd className="rounded border border-(--border) bg-(--bg-elevated) px-1 py-0.5 font-mono">
                @ envs
              </kbd>
              <kbd className="rounded border border-(--border) bg-(--bg-elevated) px-1 py-0.5 font-mono">
                # requests
              </kbd>
            </div>
          )}
        </div>

        {/* Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-10 text-[13px]"
              style={{ color: 'var(--text-muted)' }}
            >
              <Command className="mb-2 h-7 w-7 opacity-30" />
              <p>No matching commands, requests, or environments found.</p>
              <p className="mt-1 text-[11px] opacity-75">
                Try searching by request name, URL endpoint, or JSON request body content.
              </p>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  data-index={idx}
                  onClick={item.onSelect}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`group transition-fast flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-[13px] ${
                    isSelected ? 'bg-(--accent) text-white' : 'hover:bg-(--bg-hover)'
                  }`}
                  style={{
                    color: isSelected ? '#ffffff' : 'var(--text-primary)',
                  }}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    {/* Method Badge or Category Icon */}
                    {item.method ? (
                      <MethodBadge method={item.method} short className="shrink-0" />
                    ) : (
                      <span className="shrink-0 opacity-80">{item.icon}</span>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{item.title}</span>
                        <span
                          className={`py-0.2 rounded px-1.5 text-[10px] font-semibold tracking-wider uppercase ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-(--bg-elevated) text-(--text-muted)'
                          }`}
                        >
                          {item.category}
                        </span>
                      </div>

                      {item.subtitle && (
                        <p
                          className={`truncate text-[11px] ${
                            isSelected ? 'text-white/80' : 'text-(--text-muted)'
                          }`}
                        >
                          {item.subtitle}
                        </p>
                      )}

                      {item.matchDetail && (
                        <p
                          className={`mt-0.5 truncate font-mono text-[10px] ${
                            isSelected ? 'text-amber-200' : 'text-amber-500'
                          }`}
                        >
                          {item.matchDetail}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Shortcut or Enter hint */}
                  <div className="ml-3 flex shrink-0 items-center gap-2">
                    {item.shortcut && (
                      <kbd
                        className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold select-none ${
                          isSelected
                            ? 'border-white/30 bg-white/20 text-white'
                            : 'border-(--border-strong) bg-(--bg-elevated) text-(--text-secondary)'
                        }`}
                      >
                        {item.shortcut}
                      </kbd>
                    )}
                    {isSelected && <CornerDownLeft className="h-3.5 w-3.5 opacity-80" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hints */}
        <div
          className="flex items-center justify-between border-t px-4 py-2 text-[11px]"
          style={{
            borderColor: 'var(--border)',
            backgroundColor: 'var(--bg-elevated)',
            color: 'var(--text-muted)',
          }}
        >
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono font-semibold">↑</kbd>{' '}
              <kbd className="font-mono font-semibold">↓</kbd> Navigate
            </span>
            <span>
              <kbd className="font-mono font-semibold">↵</kbd> Select
            </span>
            <span>
              <kbd className="font-mono font-semibold">Esc</kbd> Close
            </span>
          </div>

          <div className="font-medium">
            {filteredItems.length} result{filteredItems.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>
    </div>
  );
}
