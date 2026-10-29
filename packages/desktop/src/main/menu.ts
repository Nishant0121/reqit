import { app, Menu, MenuItemConstructorOptions, BrowserWindow, shell, dialog } from 'electron';

export function setupApplicationMenu(mainWindow: BrowserWindow): void {
  const isMac = process.platform === 'darwin';

  const sendAction = (action: string) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('menu:action', action);
    }
  };

  const template: MenuItemConstructorOptions[] = [
    // macOS App Menu
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              {
                label: `About ${app.name}`,
                click: () => sendAction('open-about'),
              },
              { type: 'separator' as const },
              {
                label: 'Preferences...',
                accelerator: 'CmdOrCtrl+,',
                click: () => sendAction('open-settings'),
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),

    // File Menu
    {
      label: 'File',
      submenu: [
        {
          label: 'New Request',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendAction('new-request'),
        },
        {
          label: 'New Collection...',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => sendAction('new-collection'),
        },
        {
          label: 'Open Collection...',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendAction('open-collection'),
        },
        {
          label: 'Open Example Collection',
          click: () => sendAction('open-example'),
        },
        { type: 'separator' as const },
        {
          label: 'Import cURL...',
          accelerator: 'CmdOrCtrl+I',
          click: () => sendAction('import-curl'),
        },
        { type: 'separator' as const },
        {
          label: 'Save Request',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendAction('save-request'),
        },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => sendAction('close-tab'),
        },
        ...(!isMac
          ? [
              { type: 'separator' as const },
              {
                label: 'Settings',
                accelerator: 'CmdOrCtrl+,',
                click: () => sendAction('open-settings'),
              },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ]
          : []),
      ],
    },

    // Edit Menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
      ],
    },

    // View Menu
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+B',
          click: () => sendAction('toggle-sidebar'),
        },
        { type: 'separator' as const },
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
      ],
    },

    // Help Menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'Welcome Screen',
          click: () => sendAction('open-welcome'),
        },
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'CmdOrCtrl+/',
          click: () => sendAction('open-shortcuts'),
        },
        { type: 'separator' as const },
        {
          label: 'Documentation',
          click: () => {
            shell.openExternal('https://github.com/reqit-app/reqit');
          },
        },
        {
          label: 'Report an Issue',
          click: () => {
            shell.openExternal('https://github.com/reqit-app/reqit/issues');
          },
        },
        { type: 'separator' as const },
        {
          label: 'About Reqit',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Reqit',
              message: 'Reqit — Git-native, file-based API client',
              detail: `Version: ${app.getVersion() || '0.1.0'}\nElectron: ${process.versions.electron}\nNode: ${process.versions.node}\nOS: ${process.platform} ${process.arch}`,
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
