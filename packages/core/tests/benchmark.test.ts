import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { scanCollection } from '../src/collection/scanner.js';

describe('Performance Benchmark: 500-request collection', () => {
  let tempDir: string;
  const FOLDER_COUNT = 10;
  const REQUESTS_PER_FOLDER = 50;
  const TOTAL_REQUESTS = FOLDER_COUNT * REQUESTS_PER_FOLDER;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reqit-benchmark-'));

    // Write reqit.yaml
    fs.writeFileSync(
      path.join(tempDir, 'reqit.yaml'),
      `version: 1
name: Benchmark 500 Collection
defaults:
  variables:
    baseUrl: https://api.example.com
`,
      'utf-8',
    );

    // Create 10 folders with 50 requests each (500 requests total)
    for (let f = 1; f <= FOLDER_COUNT; f++) {
      const folderPath = path.join(tempDir, `Folder_${f}`);
      fs.mkdirSync(folderPath, { recursive: true });

      for (let r = 1; r <= REQUESTS_PER_FOLDER; r++) {
        const reqPath = path.join(folderPath, `Request_${r}.yaml`);
        fs.writeFileSync(
          reqPath,
          `version: 1
name: Request ${r} in Folder ${f}
method: GET
url: "{{baseUrl}}/items/${r}"
headers:
  - name: Accept
    value: application/json
`,
          'utf-8',
        );
      }
    }
  });

  afterAll(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('scans 500 requests efficiently', async () => {
    const startTime = performance.now();
    const tree = await scanCollection(tempDir);
    const durationMs = performance.now() - startTime;

    expect(tree).toBeDefined();
    expect(tree.collection.name).toBe('Benchmark 500 Collection');
    expect(tree.tree.length).toBe(FOLDER_COUNT);

    let totalCount = 0;
    for (const folder of tree.tree) {
      if (folder.children) {
        totalCount += folder.children.length;
      }
    }

    expect(totalCount).toBe(TOTAL_REQUESTS);
    console.log(`[Benchmark] Scanned ${TOTAL_REQUESTS} requests in ${durationMs.toFixed(2)} ms`);
    // Assert scanning completes well within threshold
    expect(durationMs).toBeLessThan(3000);
  });
});
