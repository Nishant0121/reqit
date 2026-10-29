import React, { useState, useRef, useEffect } from 'react';
import {
  Folder,
  FolderPlus,
  FolderOpen,
  ChevronDown,
  Sun,
  Moon,
  Laptop,
  PanelLeft,
  PanelLeftClose,
  Keyboard,
  Settings as SettingsIcon,
  Globe,
  Terminal,
  Zap,
  Sparkles,
} from 'lucide-react';
import { Button } from './ui/Button';
import { strings } from '../lib/strings';
import type { ThemeMode } from '../lib/theme';
import type { EnvironmentFile } from '@reqit/core/format';

export interface TopBarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  activeEnvironment: string;
  onEnvironmentChange: (env: string) => void;
  environments?: Record<string, EnvironmentFile> | string[];
  onManageEnvironments?: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  collectionName?: string;
  collectionPath?: string;
  onOpenShortcuts?: () => void;
  onOpenImportCurl?: () => void;
  onOpenCollection?: () => void;
  onNewCollection?: () => void;
  onOpenSettings?: () => void;
  onOpenWelcome?: () => void;
  onOpenExample?: () => void;
  recentCollections?: string[];
  onSelectRecentCollection?: (path: string) => void;
}

export function TopBar({
  sidebarOpen,
  onToggleSidebar,
  activeEnvironment,
  onEnvironmentChange,
  environments,
  onManageEnvironments,
  theme,
  onToggleTheme,
  collectionName = strings.topBar.defaultCollection,
  collectionPath,
  onOpenShortcuts,
  onOpenImportCurl,
  onOpenCollection,
  onNewCollection,
  onOpenSettings,
  onOpenWelcome,
  onOpenExample,
  recentCollections = [],
  onSelectRecentCollection,
}: TopBarProps): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const getThemeIcon = () => {
    switch (theme) {
      case 'dark':
        return <Moon className="h-5 w-5" strokeWidth={1.75} />;
      case 'light':
        return <Sun className="h-5 w-5" strokeWidth={1.75} />;
      default:
        return <Laptop className="h-5 w-5" strokeWidth={1.75} />;
    }
  };

  const getThemeTooltip = () => {
    switch (theme) {
      case 'dark':
        return strings.topBar.themeDark;
      case 'light':
        return strings.topBar.themeLight;
      default:
        return strings.topBar.themeSystem;
    }
  };

  return (
    <header
      className="flex h-10.5 shrink-0 items-center justify-between border-b px-3 select-none"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Left: App Logo, Sidebar Toggle, Collection Menu */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="transition-fast app-focus-ring inline-flex h-8 w-8 items-center justify-center rounded-sm text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary)"
          title={strings.topBar.toggleSidebar}
          aria-label={strings.topBar.toggleSidebar}
        >
          {sidebarOpen ? (
            <PanelLeftClose className="h-5 w-5" strokeWidth={1.75} />
          ) : (
            <PanelLeft className="h-5 w-5" strokeWidth={1.75} />
          )}
        </button>

        <button
          type="button"
          onClick={onOpenWelcome}
          className="transition-fast flex h-6 w-6 items-center justify-center rounded-sm text-[12px] leading-none font-bold hover:opacity-90"
          style={{
            backgroundColor: 'var(--accent-strong)',
            color: 'var(--accent-fg)',
          }}
          title="Open Welcome Screen"
          aria-label="Open Welcome Screen"
        >
          R
        </button>

        {/* Collection Dropdown Trigger */}
        <div className="relative ml-1" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="transition-fast app-focus-ring flex items-center gap-1.5 rounded-sm px-2 py-1 text-[13px] font-medium hover:bg-(--bg-hover)"
            style={{ color: 'var(--text-primary)' }}
            title={collectionPath ? `${collectionName}\n${collectionPath}` : collectionName}
          >
            <Folder className="h-4 w-4" style={{ color: 'var(--accent)' }} strokeWidth={1.75} />
            <span className="max-w-45 truncate">{collectionName}</span>
            <ChevronDown
              className="h-3.5 w-3.5"
              style={{ color: 'var(--text-muted)' }}
              strokeWidth={1.75}
            />
          </button>

          {/* Collection Menu Dropdown */}
          {menuOpen && (
            <div
              className="absolute left-0 z-50 mt-1 w-64 rounded-md border py-1 text-[12px] shadow-lg"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-strong)',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenWelcome?.();
                }}
                className="transition-fast flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-(--bg-hover)"
                style={{ color: 'var(--text-primary)' }}
              >
                <Zap className="h-5 w-5 text-(--accent)" strokeWidth={1.75} />
                <span className="flex-1 font-medium">Welcome Screen...</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenExample?.();
                }}
                className="transition-fast flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-(--bg-hover)"
                style={{ color: 'var(--text-primary)' }}
              >
                <Sparkles className="h-5 w-5 text-(--accent)" strokeWidth={1.75} />
                <span className="flex-1 font-medium">Explore Example Collection...</span>
              </button>

              <div className="my-1 border-t" style={{ borderColor: 'var(--border)' }} />

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenCollection?.();
                }}
                className="transition-fast flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-(--bg-hover)"
                style={{ color: 'var(--text-primary)' }}
              >
                <FolderOpen className="h-5 w-5 text-(--accent)" strokeWidth={1.75} />
                <span className="flex-1 font-medium">Open Collection Folder...</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onNewCollection?.();
                }}
                className="transition-fast flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-(--bg-hover)"
                style={{ color: 'var(--text-primary)' }}
              >
                <FolderPlus className="h-5 w-5 text-(--accent)" strokeWidth={1.75} />
                <span className="flex-1 font-medium">New Collection...</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenImportCurl?.();
                }}
                className="transition-fast flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-(--bg-hover)"
                style={{ color: 'var(--text-primary)' }}
              >
                <Terminal className="h-5 w-5 text-(--accent)" strokeWidth={1.75} />
                <span className="flex-1 font-medium">Import cURL...</span>
                <span className="font-mono text-[10px] text-(--text-muted)">Ctrl+I</span>
              </button>

              {recentCollections.length > 0 && (
                <>
                  <div className="my-1 border-t" style={{ borderColor: 'var(--border)' }} />
                  <div
                    className="px-3 py-1 text-[11px] font-semibold tracking-wider uppercase"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Recent Collections
                  </div>
                  {recentCollections.map(p => {
                    const basename =
                      p
                        .replace(/[\\/]$/, '')
                        .split(/[\\/]/)
                        .pop() || p;
                    const isCurrent = p === collectionPath;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onSelectRecentCollection?.(p);
                        }}
                        className="transition-fast flex w-full flex-col items-start px-3 py-1.5 text-left hover:bg-(--bg-hover)"
                        style={{
                          backgroundColor: isCurrent ? 'var(--accent-subtle)' : 'transparent',
                          color: isCurrent ? 'var(--accent)' : 'var(--text-primary)',
                        }}
                        title={p}
                      >
                        <span className="max-w-full truncate text-[12px] font-medium">
                          {basename}
                        </span>
                        <span
                          className="max-w-full truncate font-mono text-[10px]"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {p}
                        </span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Environment Selector, Theme Toggle, Settings */}
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1">
          <select
            value={activeEnvironment}
            onChange={e => onEnvironmentChange(e.target.value)}
            className="app-focus-ring h-7 cursor-pointer rounded-sm border bg-transparent px-2 text-[12px] outline-none"
            style={{
              borderColor: 'var(--border-strong)',
              color: 'var(--text-primary)',
              backgroundColor: 'var(--bg-input)',
            }}
            aria-label="Active environment"
          >
            <option
              value="none"
              style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
            >
              {strings.topBar.noEnvironment}
            </option>
            {(() => {
              const envList = Array.isArray(environments)
                ? environments
                : environments && Object.keys(environments).length > 0
                  ? Object.keys(environments)
                  : ['dev', 'prod'];
              return envList.map(env => (
                <option
                  key={env}
                  value={env}
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                >
                  {env}
                </option>
              ));
            })()}
          </select>
          {onManageEnvironments && (
            <button
              type="button"
              onClick={onManageEnvironments}
              className="transition-fast flex h-7 w-7 items-center justify-center rounded-sm text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary)"
              title="Manage Environments & Secrets"
              aria-label="Manage Environments & Secrets"
            >
              <Globe className="h-4 w-4" />
            </button>
          )}
        </div>

        {onOpenImportCurl && (
          <Button
            variant="ghost"
            size="compact"
            onClick={onOpenImportCurl}
            title="Import cURL (Ctrl+I)"
            aria-label="Import cURL"
            className="transition-fast flex h-8 w-8 items-center justify-center rounded-sm p-0 text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary)"
          >
            <Terminal className="h-5 w-5" strokeWidth={1.75} />
          </Button>
        )}

        {onOpenWelcome && (
          <Button
            variant="ghost"
            size="compact"
            onClick={onOpenWelcome}
            title="Welcome screen"
            aria-label="Welcome screen"
            className="transition-fast flex h-8 w-8 items-center justify-center rounded-sm p-0 text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary)"
          >
            <Zap className="h-5 w-5" strokeWidth={1.75} />
          </Button>
        )}

        <Button
          variant="ghost"
          size="compact"
          onClick={onOpenShortcuts}
          title="Keyboard shortcuts (Ctrl+/)"
          aria-label="Keyboard shortcuts"
          className="transition-fast flex h-8 w-8 items-center justify-center rounded-sm p-0 text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary)"
        >
          <Keyboard className="h-5 w-5" strokeWidth={1.75} />
        </Button>

        <Button
          variant="ghost"
          size="compact"
          onClick={onToggleTheme}
          title={getThemeTooltip()}
          aria-label={strings.topBar.themeToggle}
          className="transition-fast flex h-8 w-8 items-center justify-center rounded-sm p-0 text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary)"
        >
          {getThemeIcon()}
        </Button>

        <Button
          variant="ghost"
          size="compact"
          onClick={onOpenSettings}
          title={strings.topBar.settings}
          aria-label={strings.topBar.settings}
          className="transition-fast flex h-8 w-8 items-center justify-center rounded-sm p-0 text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary)"
        >
          <SettingsIcon className="h-5 w-5" strokeWidth={1.75} />
        </Button>
      </div>
    </header>
  );
}
