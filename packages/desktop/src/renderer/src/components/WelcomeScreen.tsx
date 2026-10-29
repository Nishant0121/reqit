import React, { useEffect } from 'react';
import {
  FolderOpen,
  FolderPlus,
  BookOpen,
  Terminal,
  Clock,
  Sparkles,
  ArrowRight,
  Zap,
  X,
} from 'lucide-react';

export interface WelcomeScreenProps {
  onOpenFolder: () => void;
  onNewCollection: () => void;
  onOpenExample: () => void;
  onImportCurl: () => void;
  onDismissToEditor?: () => void;
  recentCollections: string[];
  onSelectRecent: (path: string) => void;
}

export function WelcomeScreen({
  onOpenFolder,
  onNewCollection,
  onOpenExample,
  onImportCurl,
  onDismissToEditor,
  recentCollections,
  onSelectRecent,
}: WelcomeScreenProps): React.JSX.Element {
  const isMac = navigator.platform.toUpperCase().includes('MAC');
  const modKey = isMac ? '⌘' : 'Ctrl';

  const shortcuts = [
    { label: 'Send Request', keys: `${modKey} + Enter` },
    { label: 'Save Request', keys: `${modKey} + S` },
    { label: 'New Request Tab', keys: `${modKey} + N` },
    { label: 'Open Collection', keys: `${modKey} + O` },
    { label: 'Import cURL', keys: `${modKey} + I` },
    { label: 'Open Settings', keys: `${modKey} + ,` },
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onDismissToEditor) {
        onDismissToEditor();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismissToEditor]);

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-y-auto bg-(--bg-base) p-8 text-(--text-primary) select-none">
      {onDismissToEditor && (
        <button
          type="button"
          onClick={onDismissToEditor}
          className="absolute top-4 right-4 flex items-center gap-1.5 rounded-sm p-1.5 text-(--text-muted) transition-colors hover:bg-(--bg-hover) hover:text-(--text-primary)"
          title="Back to Editor (Escape)"
          aria-label="Close welcome screen"
        >
          <X className="h-5 w-5" />
        </button>
      )}
      <div className="flex w-full max-w-3xl flex-col gap-8">
        {/* Hero Section */}
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-(--accent)/15 text-(--accent)">
            <Zap className="h-8 w-8 fill-current" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-(--text-primary)">
            Welcome to Reqit
          </h1>
          <p className="mt-2 max-w-md text-sm text-(--text-muted)">
            The lightweight, local-first API client. Everything is saved in transparent,
            Git-friendly YAML files right on your filesystem.
          </p>
        </div>

        {/* Primary Action Cards Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Card 1: Open Folder */}
          <button
            type="button"
            onClick={onOpenFolder}
            className="group flex flex-col items-start gap-3 rounded-lg border p-5 text-left transition-all hover:border-(--accent) hover:bg-(--bg-hover)"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-(--accent)/10 text-(--accent) transition-transform group-hover:scale-105">
              <FolderOpen className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[14px] font-semibold text-(--text-primary)">Open Folder</div>
              <div className="mt-1 text-[12px] text-(--text-muted)">
                Open an existing directory containing a{' '}
                <code className="text-(--accent)">reqit.yaml</code> collection.
              </div>
            </div>
            <div className="mt-auto flex items-center gap-1 text-[12px] font-medium text-(--accent)">
              Browse folders <ArrowRight className="h-3 w-3" />
            </div>
          </button>

          {/* Card 2: New Collection */}
          <button
            type="button"
            onClick={onNewCollection}
            className="group flex flex-col items-start gap-3 rounded-lg border p-5 text-left transition-all hover:border-(--accent) hover:bg-(--bg-hover)"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-(--accent)/10 text-(--accent) transition-transform group-hover:scale-105">
              <FolderPlus className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[14px] font-semibold text-(--text-primary)">New Collection</div>
              <div className="mt-1 text-[12px] text-(--text-muted)">
                Create a fresh collection folder with environments, secrets, and Git integration.
              </div>
            </div>
            <div className="mt-auto flex items-center gap-1 text-[12px] font-medium text-(--accent)">
              Create new <ArrowRight className="h-3 w-3" />
            </div>
          </button>

          {/* Card 3: Open Example Collection */}
          <button
            type="button"
            onClick={onOpenExample}
            className="group flex flex-col items-start gap-3 rounded-lg border p-5 text-left transition-all hover:border-(--accent) hover:bg-(--bg-hover)"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-(--accent)/10 text-(--accent) transition-transform group-hover:scale-105">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[14px] font-semibold text-(--text-primary)">Explore Example</div>
              <div className="mt-1 text-[12px] text-(--text-muted)">
                Load a bundled runnable Httpbin collection with auth, variables, and status codes.
              </div>
            </div>
            <div className="mt-auto flex items-center gap-1 text-[12px] font-medium text-(--accent)">
              Try example <ArrowRight className="h-3 w-3" />
            </div>
          </button>
        </div>

        {/* Secondary Bar: Import cURL & Scratchpad */}
        <div className="flex items-center justify-center gap-4 text-[13px]">
          <button
            type="button"
            onClick={onImportCurl}
            className="flex items-center gap-2 rounded px-3 py-1.5 font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-hover) hover:text-(--text-primary)"
          >
            <Terminal className="h-4 w-4" />
            Import cURL command
          </button>

          {onDismissToEditor && (
            <button
              type="button"
              onClick={onDismissToEditor}
              className="flex items-center gap-2 rounded px-3 py-1.5 font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-hover) hover:text-(--text-primary)"
            >
              <BookOpen className="h-4 w-4" />
              Continue to Scratchpad
            </button>
          )}
        </div>

        {/* Bottom Section: Recent Collections & Keyboard Shortcuts */}
        <div
          className="grid grid-cols-1 gap-6 border-t pt-2 md:grid-cols-2"
          style={{ borderColor: 'var(--border)' }}
        >
          {/* Recent Collections */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[12px] font-semibold tracking-wider text-(--text-muted) uppercase">
              <Clock className="h-3.5 w-3.5" />
              Recent Collections
            </div>

            {recentCollections.length > 0 ? (
              <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                {recentCollections.slice(0, 5).map(folderPath => {
                  const folderName = folderPath.split(/[/\\]/).filter(Boolean).pop() || folderPath;
                  return (
                    <button
                      key={folderPath}
                      type="button"
                      onClick={() => onSelectRecent(folderPath)}
                      className="group flex flex-col items-start rounded p-2 text-left transition-colors hover:bg-(--bg-hover)"
                    >
                      <span className="text-[13px] font-medium text-(--text-primary) group-hover:text-(--accent)">
                        {folderName}
                      </span>
                      <span className="max-w-xs truncate text-[11px] text-(--text-muted)">
                        {folderPath}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="py-2 text-[12px] text-(--text-muted) italic">
                No recent collections opened yet.
              </div>
            )}
          </div>

          {/* Quick Shortcuts */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[12px] font-semibold tracking-wider text-(--text-muted) uppercase">
              <Zap className="h-3.5 w-3.5" />
              Keyboard Shortcuts
            </div>

            <div className="grid grid-cols-1 gap-1.5 text-[12px]">
              {shortcuts.map(sc => (
                <div key={sc.label} className="flex items-center justify-between py-0.5">
                  <span className="text-(--text-secondary)">{sc.label}</span>
                  <kbd
                    className="rounded border px-1.5 py-0.5 font-mono text-[11px] text-(--text-muted)"
                    style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border)' }}
                  >
                    {sc.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
