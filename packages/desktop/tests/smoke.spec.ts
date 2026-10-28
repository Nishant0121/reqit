import * as http from 'node:http';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Desktop App Shell Smoke Test (Phase 5)', () => {
  let app: ElectronApplication;
  let page: Page;
  let server: http.Server;
  let port: number;

  test.beforeAll(async () => {
    // 1. Start a local HTTP test server for the smoke test
    server = http.createServer((req, res) => {
      if (req.url === '/image') {
        const pngHex =
          '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082';
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(Buffer.from(pngHex, 'hex'));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          message: 'Hello from main process request engine!',
          method: req.method,
          ok: true,
        }),
      );
    });

    await new Promise<void>(resolve => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        port = addr.port;
        resolve();
      });
    });

    // 2. Launch the Electron app using the built main process entry
    const appPath = path.resolve(__dirname, '../out/main/index.js');
    app = await electron.launch({
      args: [appPath],
      env: {
        ...process.env,
        TEST_SERVER_PORT: String(port),
      },
    });

    page = await app.firstWindow();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err));
  });

  test.afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (server) {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });

  test('launches app window, verifies title, clicks button, and displays response from main engine', async () => {
    await page.waitForLoadState('domcontentloaded');

    // Title verification
    expect(await page.title()).toBe('Reqit');

    // Button should be visible
    const sendButton = page.locator('#send-test-btn');
    await expect(sendButton).toBeVisible();

    // Click the temporary GET button
    await sendButton.click();

    // The response result container should become visible and render the response
    const responseBox = page.locator('#response-result');
    await expect(responseBox).toBeVisible();

    // Verify status code, message, and body are rendered in the window
    await expect(responseBox).toContainText('200 OK');
    await expect(responseBox).toContainText('Hello from main process request engine!');
  });

  test('verifies Phase 6 UI features: sidebar toggle, theme toggle, shortcuts modal, and CodeMirror editor', async () => {
    // 1. Sidebar toggle
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();

    const toggleSidebarBtn = page.locator('button[aria-label="Toggle sidebar (Ctrl+B)"]');
    await toggleSidebarBtn.click();
    await expect(sidebar).not.toBeVisible();

    await toggleSidebarBtn.click();
    await expect(sidebar).toBeVisible();

    // 2. Theme toggle
    const themeToggleBtn = page.locator('button[aria-label="Toggle theme"]');
    await expect(themeToggleBtn).toBeVisible();
    await themeToggleBtn.click();
    const htmlTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    );
    expect(htmlTheme).toBeDefined();

    // 3. Keyboard shortcuts modal
    const shortcutsBtn = page.locator('button[aria-label="Keyboard shortcuts"]');
    await expect(shortcutsBtn).toBeVisible();
    await shortcutsBtn.click();

    const modalTitle = page.locator('#modal-title');
    await expect(modalTitle).toHaveText('Keyboard shortcuts');
    await expect(page.locator('text=Send request')).toBeVisible();

    // Close modal with Escape key
    await page.keyboard.press('Escape');
    await expect(modalTitle).not.toBeVisible();

    // 4. Request Body tab and CodeMirror 6 editor
    const bodyTab = page.locator('button[role="tab"]:has-text("Body")').first();
    await bodyTab.click();

    // Select JSON body format
    const jsonRadio = page.locator('input[type="radio"][value="json"]');
    await jsonRadio.check();

    // CodeMirror editors are mounted for both request body and response body
    const codeMirrors = page.locator('.cm-editor');
    await expect(codeMirrors.first()).toBeVisible();
    await expect(codeMirrors).toHaveCount(2);
  });

  test('verifies Phase 7 Request Builder: URL-params bidirectional sync, auth, headers autocomplete, JSON beautify, and save', async () => {
    await page.waitForLoadState('domcontentloaded');

    // 1. URL bar and Query params bidirectional sync
    const urlInput = page.locator('#url-input');
    await expect(urlInput).toBeVisible();

    // Type query param in URL input
    await urlInput.fill(`http://127.0.0.1:${port}/test?filter=active&limit=25`);

    // Params tab should automatically show 2 active params
    const paramsTab = page.locator('button[role="tab"]:has-text("Params")').first();
    await paramsTab.click();

    // Look for key cells containing 'filter' and 'limit'
    const paramKeyInputs = page.locator('table input[placeholder="Key"]');
    await expect(paramKeyInputs.first()).toHaveValue('filter');
    const paramValInputs = page.locator('table input[placeholder="Value"]');
    await expect(paramValInputs.first()).toHaveValue('active');

    // Edit the second param value to '50'
    await paramValInputs.nth(1).fill('50');

    // Verify URL bar updated to reflect the new value limit=50
    await expect(urlInput).toHaveValue(`http://127.0.0.1:${port}/test?filter=active&limit=50`);

    // 2. Unsaved changes dirty dot and Save (Ctrl+S)
    const dirtyDot = page.locator('span[title="Unsaved changes"]');
    await expect(dirtyDot).toBeVisible();

    // Press Ctrl+S to save
    await page.keyboard.press('Control+s');

    // Toast notification should appear and dirty dot should disappear
    const toast = page.locator('text=Request saved');
    await expect(toast).toBeVisible();
    await expect(dirtyDot).not.toBeVisible();

    // 3. Variable autocomplete in URL bar and visible trailing text
    await urlInput.fill('http://127.0.0.1/{{');
    const varDropdown = page.locator('text=baseUrl');
    await expect(varDropdown).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(urlInput).toHaveValue('http://127.0.0.1/{{baseUrl}}');

    // Type text after variable and verify trailing text is fully visible (not hidden by opacity-0)
    await page.keyboard.press('End');
    await page.keyboard.type('/api/v1/users');
    await expect(urlInput).toHaveValue('http://127.0.0.1/{{baseUrl}}/api/v1/users');
    const trailingSpan = page.locator('span:has-text("/api/v1/users")');
    await expect(trailingSpan).toBeVisible();

    // Reset url back to test server url
    await urlInput.fill(`http://127.0.0.1:${port}/`);

    // 4. Headers tab autocomplete
    const headersTab = page.locator('button[role="tab"]:has-text("Headers")').first();
    await headersTab.click();

    const headerKeyInput = page.locator('table input[placeholder="Key"]').first();
    await headerKeyInput.fill('Content-T');
    const headerSuggestion = page.locator('[data-suggestion="Content-Type"]').first();
    await expect(headerSuggestion).toBeVisible();
    await headerSuggestion.click();
    await expect(headerKeyInput).toHaveValue('Content-Type');

    // 5. Auth tab options including API Key with Header / Query params selector
    const authTab = page.locator('button[role="tab"]:has-text("Auth")').first();
    await authTab.click();

    const authSelect = page.locator('select:has(option[value="apiKey"])');
    await authSelect.selectOption('apiKey');

    // Check radio buttons for "Add to: Header / Query params"
    const headerRadio = page.locator('input[type="radio"][value="header"]');
    const queryRadio = page.locator('input[type="radio"][value="query"]');
    await expect(headerRadio).toBeVisible();
    await expect(queryRadio).toBeVisible();
    await expect(headerRadio).toBeChecked();

    await queryRadio.check();
    await expect(queryRadio).toBeChecked();

    // 6. Body tab: Form, Multipart, and JSON Beautify
    const bodyTab = page.locator('button[role="tab"]:has-text("Body")').first();
    await bodyTab.click();

    // Multipart body type selector
    const multipartRadio = page.locator('input[type="radio"][value="multipart"]');
    await multipartRadio.check();

    // Change type from Text to File
    const typeSelect = page.locator('table select').first();
    await typeSelect.selectOption('file');
    await expect(page.locator('text=Choose file...')).toBeVisible();

    // Form body type selector
    const formRadio = page.locator('input[type="radio"][value="form"]');
    await formRadio.check();
    await expect(page.locator('input[placeholder="Field name"]').first()).toBeVisible();

    // JSON body format and Beautify action
    const jsonRadio = page.locator('input[type="radio"][value="json"]');
    await jsonRadio.check();

    const beautifyBtn = page.locator('button:has-text("Beautify")');
    await expect(beautifyBtn).toBeVisible();

    // 7. Send request and verify response
    const sendBtn = page.locator('#send-test-btn');
    await sendBtn.click();

    const responseBox = page.locator('#response-result');
    await expect(responseBox).toBeVisible();
    await expect(responseBox).toContainText('200 OK');
  });

  test('verifies Phase 8 Response Viewer: status strip, body view modes, in-body search, searchable headers table, and timing waterfall', async () => {
    await page.waitForLoadState('domcontentloaded');

    // 1. Send test request to have a fresh response
    const sendBtn = page.locator('#send-test-btn');
    await sendBtn.click();

    const responsePanel = page.locator('#response-result');
    await expect(responsePanel).toBeVisible();

    // 2. Status badge, duration, and size in header strip
    await expect(responsePanel).toContainText('200 OK');
    await expect(responsePanel.locator('span:has-text("ms")').first()).toBeVisible();
    await expect(responsePanel.locator('span:has-text("B")').first()).toBeVisible();

    // 3. In-body search button, search panel buttons and checkboxes
    const searchBtn = responsePanel.locator('button[aria-label="Search response"]');
    await expect(searchBtn).toBeVisible();
    await searchBtn.click();
    const searchPanel = page.locator('.cm-panel.cm-search');
    await expect(searchPanel).toBeVisible();

    const nextBtn = searchPanel.locator('button[name="next"]');
    await expect(nextBtn).toBeVisible();
    const prevBtn = searchPanel.locator('button[name="prev"]');
    await expect(prevBtn).toBeVisible();
    const selectBtn = searchPanel.locator('button[name="select"]');
    await expect(selectBtn).toBeVisible();

    // Verify search input and active match highlight
    const searchInput = searchPanel.locator('input[name="search"]');
    await searchInput.fill('engine');
    await nextBtn.click();
    await expect(page.locator('.cm-searchMatch-selected')).toBeVisible();

    // 4. Body view format modes (Pretty / Raw / Preview)
    const rawBtn = responsePanel.locator('button:has-text("Raw")');
    await rawBtn.click();
    await expect(rawBtn).toBeVisible();

    const prettyBtn = responsePanel.locator('button:has-text("Pretty")');
    await prettyBtn.click();
    await expect(prettyBtn).toBeVisible();

    const previewBtn = responsePanel.locator('button:has-text("Preview")');
    await previewBtn.click();
    await expect(previewBtn).toBeVisible();

    // Switch back to Pretty
    await prettyBtn.click();

    // 5. Copy and Save action buttons
    const copyBtn = responsePanel.locator('button[aria-label="Copy response"]');
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();

    const saveBtn = responsePanel.locator('button[aria-label="Save response"]');
    await expect(saveBtn).toBeVisible();

    // 6. Headers tab with searchable filter
    const headersTab = responsePanel.locator('button[role="tab"]:has-text("Headers")').first();
    await headersTab.click();

    const headerFilterInput = responsePanel.locator('input[placeholder="Filter headers..."]');
    await expect(headerFilterInput).toBeVisible();
    await headerFilterInput.fill('content');

    // Verify filtered table shows content-type
    const headerRow = responsePanel.locator('td:has-text("content-type")');
    await expect(headerRow).toBeVisible();

    // Clear filter
    const clearBtn = responsePanel.locator('button[title="Clear filter"]');
    await clearBtn.click();
    await expect(headerFilterInput).toHaveValue('');

    // 7. Timing tab with waterfall chart
    const timingTab = responsePanel.locator('button[role="tab"]:has-text("Timing")').first();
    await timingTab.click();

    await expect(responsePanel.locator('text=Timing breakdown')).toBeVisible();
    await expect(responsePanel.locator('text=DNS lookup')).toBeVisible();
    await expect(responsePanel.locator('text=TCP handshake')).toBeVisible();
    await expect(responsePanel.locator('text=Time to first byte (TTFB)')).toBeVisible();
    await expect(responsePanel.locator('text=Content download')).toBeVisible();

    // 8. Image preview test
    const urlInput = page.locator('#url-input');
    await urlInput.fill(`http://127.0.0.1:${port}/image`);
    const sendMainBtn = page.locator('#send-test-btn');
    await sendMainBtn.click();

    // Verify image preview renders an <img> with valid data URI
    const imgPreview = responsePanel.locator('img[alt="Response preview"]');
    await expect(imgPreview).toBeVisible();
    const imgSrc = await imgPreview.getAttribute('src');
    expect(imgSrc).toContain('data:image/png;base64,');
  });

  test('verifies Phase 9 collection and request management on disk', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reqit-smoke-col-'));
    try {
      // 1. Create collection on disk via reqitApi
      const tree = await page.evaluate(async dir => {
        return window.reqitApi.createCollection({ name: 'Smoke Collection', targetDir: dir });
      }, tmpDir);
      expect(tree).toBeTruthy();
      expect(tree?.collection.name).toBe('Smoke Collection');

      // Verify reqit.yaml was created on disk
      expect(fs.existsSync(path.join(tmpDir, 'reqit.yaml'))).toBe(true);

      // 2. Open collection
      const opened = await page.evaluate(async dir => {
        return window.reqitApi.openCollection(dir);
      }, tmpDir);
      expect(opened).toBeTruthy();
      expect(opened?.rootPath).toBe(path.resolve(tmpDir));

      // 3. Create request on disk
      const reqNode = await page.evaluate(async dir => {
        return window.reqitApi.createRequest({ parentDir: dir, name: 'Get Users' });
      }, tmpDir);
      expect(reqNode).toBeTruthy();
      expect(reqNode.name).toBe('Get Users');

      // Verify yaml file created on disk
      expect(fs.existsSync(reqNode.path)).toBe(true);

      // 4. Create folder on disk
      const folderNode = await page.evaluate(async dir => {
        return window.reqitApi.createFolder({ parentDir: dir, name: 'Auth' });
      }, tmpDir);
      expect(folderNode).toBeTruthy();
      expect(fs.existsSync(path.join(folderNode.path, 'folder.yaml'))).toBe(true);

      // 5. Rename request
      const renameRes = await page.evaluate(async p => {
        return window.reqitApi.renameItem({ itemPath: p, newName: 'Fetch Users List' });
      }, reqNode.path);
      expect(renameRes.newName).toBe('Fetch Users List');
      expect(fs.existsSync(renameRes.newPath)).toBe(true);
      expect(fs.existsSync(reqNode.path)).toBe(false);

      // 6. Move request into folder
      const moveRes = await page.evaluate(
        async ({ src, target }) => {
          return window.reqitApi.moveItem({ sourcePath: src, targetDirPath: target });
        },
        { src: renameRes.newPath, target: folderNode.path },
      );
      expect(fs.existsSync(moveRes.newPath)).toBe(true);

      // 7. Save modified request to disk
      await page.evaluate(async filePath => {
        return window.reqitApi.saveRequest({
          filePath,
          request: {
            version: 1,
            name: 'Fetch Users List',
            method: 'POST',
            url: 'https://httpbin.org/post',
          },
        });
      }, moveRes.newPath);

      const content = fs.readFileSync(moveRes.newPath, 'utf-8');
      expect(content).toContain('method: POST');
      expect(content).toContain('https://httpbin.org/post');

      // 8. Delete request
      const deleted = await page.evaluate(async p => {
        return window.reqitApi.deleteItem(p);
      }, moveRes.newPath);
      expect(deleted).toBe(true);
      expect(fs.existsSync(moveRes.newPath)).toBe(false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('verifies live method badge update in sidebar', async () => {
    const methodSelect = page.locator('#method-select');
    await expect(methodSelect).toBeVisible();

    // Change method to POST
    await methodSelect.selectOption('POST');

    // Sidebar should reflect POST immediately
    const sidebar = page.locator('aside');
    const postBadge = sidebar.locator('span:has-text("POST")').first();
    await expect(postBadge).toBeVisible();

    // Change method to DELETE
    await methodSelect.selectOption('DELETE');
    const deleteBadge = sidebar.locator('span:has-text("DEL")').first();
    await expect(deleteBadge).toBeVisible();

    // Revert back to GET
    await methodSelect.selectOption('GET');
    const getBadge = sidebar.locator('span:has-text("GET")').first();
    await expect(getBadge).toBeVisible();
  });
});
