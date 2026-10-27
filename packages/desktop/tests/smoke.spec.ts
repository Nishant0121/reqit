import * as http from 'node:http';
import * as path from 'node:path';
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
});
