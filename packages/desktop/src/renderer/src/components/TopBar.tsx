import React from 'react';
import {
  Folder,
  Sun,
  Moon,
  Laptop,
  PanelLeft,
  PanelLeftClose,
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
}

export function TopBar({
  sidebarOpen,
  onToggleSidebar,
  activeEnvironment,
  onEnvironmentChange,
  theme,
  onToggleTheme,
  collectionName = strings.topBar.defaultCollection,
}: TopBarProps): React.JSX.Element {
  const getThemeIcon = () => {
    switch (theme) {
      case 'dark':
        return <Moon className="w-4 h-4" strokeWidth={1.5} />;
      case 'light':
        return <Sun className="w-4 h-4" strokeWidth={1.5} />;
      default:
        return <Laptop className="w-4 h-4" strokeWidth={1.5} />;
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
      className="h-[40px] px-3 flex items-center justify-between border-b select-none shrink-0"
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
          className="w-7 h-7 inline-flex items-center justify-center rounded-[4px] hover:bg-[var(--bg-hover)] transition-fast app-focus-ring"
          style={{ color: 'var(--text-secondary)' }}
          title={strings.topBar.toggleSidebar}
          aria-label={strings.topBar.toggleSidebar}
        >
          {sidebarOpen ? (
            <PanelLeftClose className="w-4 h-4" strokeWidth={1.5} />
          ) : (
            <PanelLeft className="w-4 h-4" strokeWidth={1.5} />
          )}
        </button>

        <div
          className="w-5 h-5 rounded-[4px] flex items-center justify-center font-bold text-[11px] leading-none"
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
          <Folder
            className="w-3.5 h-3.5"
            style={{ color: 'var(--text-muted)' }}
            strokeWidth={1.5}
          />
          <span>{collectionName}</span>
        </div>
      </div>

      {/* Right: Environment Selector, Theme Toggle, Settings */}
      <div className="flex items-center gap-2">
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
          onClick={onToggleTheme}
          title={getThemeTooltip()}
          aria-label={strings.topBar.themeToggle}
          className="w-7 h-7 p-0"
        >
          {getThemeIcon()}
        </Button>

        <Button
          variant="ghost"
          size="compact"
          title={strings.topBar.settings}
          aria-label={strings.topBar.settings}
          className="w-7 h-7 p-0"
        >
          <SettingsIcon className="w-4 h-4" strokeWidth={1.5} />
        </Button>
      </div>
    </header>
  );
}
