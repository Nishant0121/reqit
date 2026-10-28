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
} from 'lucide-react';
import { Button } from './ui/Button';
import { strings } from '../lib/strings';
import type { ThemeMode } from '../lib/theme';

export interface TopBarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  activeEnvironment: string;
  onEnvironmentChange: (env: string) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  collectionName?: string;
  collectionPath?: string;
  onOpenShortcuts?: () => void;
  onOpenCollection?: () => void;
  onNewCollection?: () => void;
  recentCollections?: string[];
  onSelectRecentCollection?: (path: string) => void;
}

export function TopBar({
  sidebarOpen,
  onToggleSidebar,
  activeEnvironment,
  onEnvironmentChange,
  theme,
  onToggleTheme,
  collectionName = strings.topBar.defaultCollection,
  collectionPath,
  onOpenShortcuts,
  onOpenCollection,
  onNewCollection,
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
        return <Moon className="w-5 h-5" strokeWidth={1.75} />;
      case 'light':
        return <Sun className="w-5 h-5" strokeWidth={1.75} />;
      default:
        return <Laptop className="w-5 h-5" strokeWidth={1.75} />;
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
      className="h-[42px] px-3 flex items-center justify-between border-b select-none shrink-0"
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
          className="w-8 h-8 inline-flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-fast app-focus-ring"
          title={strings.topBar.toggleSidebar}
          aria-label={strings.topBar.toggleSidebar}
        >
          {sidebarOpen ? (
            <PanelLeftClose className="w-5 h-5" strokeWidth={1.75} />
          ) : (
            <PanelLeft className="w-5 h-5" strokeWidth={1.75} />
          )}
        </button>

        <div
          className="w-6 h-6 rounded-[var(--radius-sm)] flex items-center justify-center font-bold text-[12px] leading-none"
          style={{
            backgroundColor: 'var(--accent-strong)',
            color: 'var(--accent-fg)',
          }}
        >
          R
        </div>

        {/* Collection Dropdown Trigger */}
        <div className="relative ml-1" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-sm)] text-[13px] font-medium hover:bg-[var(--bg-hover)] transition-fast app-focus-ring"
            style={{ color: 'var(--text-primary)' }}
            title={collectionPath ? `${collectionName}\n${collectionPath}` : collectionName}
          >
            <Folder className="w-4 h-4" style={{ color: 'var(--accent)' }} strokeWidth={1.75} />
            <span className="max-w-[180px] truncate">{collectionName}</span>
            <ChevronDown
              className="w-3.5 h-3.5"
              style={{ color: 'var(--text-muted)' }}
              strokeWidth={1.75}
            />
          </button>

          {/* Collection Menu Dropdown */}
          {menuOpen && (
            <div
              className="absolute left-0 mt-1 w-64 rounded-[var(--radius-md)] border shadow-lg py-1 z-50 text-[12px]"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-strong)',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenCollection?.();
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--bg-hover)] text-left transition-fast"
                style={{ color: 'var(--text-primary)' }}
              >
                <FolderOpen className="w-4 h-4 text-[var(--accent)]" />
                <span className="flex-1 font-medium">Open Collection Folder...</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onNewCollection?.();
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--bg-hover)] text-left transition-fast"
                style={{ color: 'var(--text-primary)' }}
              >
                <FolderPlus className="w-4 h-4 text-[var(--accent)]" />
                <span className="flex-1 font-medium">New Collection...</span>
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
                        className="w-full px-3 py-1.5 flex flex-col items-start hover:bg-[var(--bg-hover)] text-left transition-fast"
                        style={{
                          backgroundColor: isCurrent ? 'var(--accent-subtle)' : 'transparent',
                          color: isCurrent ? 'var(--accent)' : 'var(--text-primary)',
                        }}
                        title={p}
                      >
                        <span className="font-medium text-[12px] truncate max-w-full">
                          {basename}
                        </span>
                        <span
                          className="font-mono text-[10px] truncate max-w-full"
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
            className="h-[28px] px-2 text-[12px] bg-transparent border rounded-[4px] app-focus-ring outline-none cursor-pointer"
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
            <option
              value="dev"
              style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
            >
              {strings.topBar.devEnvironment}
            </option>
            <option
              value="prod"
              style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
            >
              {strings.topBar.prodEnvironment}
            </option>
          </select>
        </div>

        <Button
          variant="ghost"
          size="compact"
          onClick={onOpenShortcuts}
          title="Keyboard shortcuts (Ctrl+/)"
          aria-label="Keyboard shortcuts"
          className="w-8 h-8 p-0 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-fast"
        >
          <Keyboard className="w-5 h-5" strokeWidth={1.75} />
        </Button>

        <Button
          variant="ghost"
          size="compact"
          onClick={onToggleTheme}
          title={getThemeTooltip()}
          aria-label={strings.topBar.themeToggle}
          className="w-8 h-8 p-0 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-fast"
        >
          {getThemeIcon()}
        </Button>

        <Button
          variant="ghost"
          size="compact"
          title={strings.topBar.settings}
          aria-label={strings.topBar.settings}
          className="w-8 h-8 p-0 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-fast"
        >
          <SettingsIcon className="w-5 h-5" strokeWidth={1.75} />
        </Button>
      </div>
    </header>
  );
}
