export interface ShortcutDefinition {
  id: string;
  name: string;
  section: 'Request' | 'Navigation' | 'Collection' | 'General';
  keyCombination: string; // e.g. 'Ctrl+Enter'
  description: string;
}

export const SHORTCUT_REGISTRY: ShortcutDefinition[] = [
  {
    id: 'request.send',
    name: 'Send request',
    section: 'Request',
    keyCombination: 'Ctrl+Enter',
    description: 'Execute the active HTTP request in the current tab',
  },
  {
    id: 'request.cancel',
    name: 'Cancel request',
    section: 'Request',
    keyCombination: 'Escape',
    description: 'Cancel the currently in-flight HTTP request',
  },
  {
    id: 'request.save',
    name: 'Save request',
    section: 'Request',
    keyCombination: 'Ctrl+S',
    description: 'Save changes to the active request file',
  },
  {
    id: 'request.new',
    name: 'New request',
    section: 'Request',
    keyCombination: 'Ctrl+N',
    description: 'Create a new request in the current collection',
  },
  {
    id: 'tab.close',
    name: 'Close tab',
    section: 'Navigation',
    keyCombination: 'Ctrl+W',
    description: 'Close the active request tab',
  },
  {
    id: 'sidebar.toggle',
    name: 'Toggle sidebar',
    section: 'Navigation',
    keyCombination: 'Ctrl+B',
    description: 'Expand or collapse the sidebar panel',
  },
  {
    id: 'url.focus',
    name: 'Focus URL bar',
    section: 'Navigation',
    keyCombination: 'Ctrl+L',
    description: 'Select and focus the address bar',
  },
  {
    id: 'commandPalette.open',
    name: 'Command palette',
    section: 'General',
    keyCombination: 'Ctrl+K',
    description: 'Open the quick action and request command palette',
  },
  {
    id: 'shortcuts.help',
    name: 'Keyboard shortcuts',
    section: 'General',
    keyCombination: 'Ctrl+/',
    description: 'Show this keyboard shortcuts reference dialog',
  },
];

export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

export function formatKeyCombination(keys: string): string {
  if (isMac()) {
    return keys.replace(/Ctrl/g, '⌘').replace(/Alt/g, '⌥').replace(/Shift/g, '⇧');
  }
  return keys;
}

export function matchesShortcut(e: KeyboardEvent, keys: string): boolean {
  const parts = keys.split('+').map(p => p.trim().toLowerCase());
  const needsCtrl = parts.includes('ctrl') || parts.includes('cmd');
  const needsAlt = parts.includes('alt');
  const needsShift = parts.includes('shift');

  const mainKey = parts.find(p => !['ctrl', 'cmd', 'alt', 'shift'].includes(p));

  const ctrlPressed = isMac() ? e.metaKey : e.ctrlKey;
  if (needsCtrl !== ctrlPressed) return false;
  if (needsAlt !== e.altKey) return false;
  if (needsShift !== e.shiftKey) return false;

  if (!mainKey) return false;

  if (mainKey === 'enter') return e.key === 'Enter';
  if (mainKey === 'escape') return e.key === 'Escape';
  if (mainKey === '/') return e.key === '/' || e.code === 'Slash';

  return e.key.toLowerCase() === mainKey;
}
