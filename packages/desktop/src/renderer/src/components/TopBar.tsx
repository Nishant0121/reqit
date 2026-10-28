import React from 'react';
import {
  Folder,
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
  onOpenShortcuts?: () => void;
}

export function TopBar({
  sidebarOpen,
  onToggleSidebar,
  activeEnvironment,
  onEnvironmentChange,
  theme,
  onToggleTheme,
  collectionName = strings.topBar.defaultCollection,
  onOpenShortcuts,
}: TopBarProps): React.JSX.Element {
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
      {/* Left: App Logo, Sidebar Toggle, Collection Name */}
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

        <div
          className="flex items-center gap-1.5 ml-1 text-[13px] font-medium"
          style={{ color: 'var(--text-primary)' }}
        >
          <Folder className="w-4 h-4" style={{ color: 'var(--text-muted)' }} strokeWidth={1.75} />
          <span>{collectionName}</span>
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
