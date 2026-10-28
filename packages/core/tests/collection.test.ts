import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createCollection,
  createFolder,
  createRequest,
  deleteItem,
  duplicateRequest,
  getUniqueSlug,
  moveItem,
  parseRequest,
  renameItem,
  reorderFolder,
  saveRequest,
  scanCollection,
} from '../src/index.js';

describe('Collection disk operations and tree scanner (Phase 9)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'reqit-col-test-'));
  });

  afterEach(async () => {
    if (fs.existsSync(tmpDir)) {
      await fs.promises.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('creates a new collection on disk with reqit.yaml', async () => {
    const colPath = path.join(tmpDir, 'My Collection');
    const res = await createCollection(colPath, 'My Collection');
    expect(res.name).toBe('My Collection');

    const tree = await scanCollection(colPath);
    expect(tree.collection.name).toBe('My Collection');
    expect(tree.tree).toEqual([]);
  });

  it('handles slug generation with numerical collision handling', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'create-user.yaml'),
      'version: 1\nname: Create User\nurl: http://x',
    );
    const slug1 = getUniqueSlug(tmpDir, 'Create User');
    expect(slug1).toBe('create-user-2.yaml');

    fs.writeFileSync(
      path.join(tmpDir, 'create-user-2.yaml'),
      'version: 1\nname: Create User\nurl: http://x',
    );
    const slug2 = getUniqueSlug(tmpDir, 'Create User');
    expect(slug2).toBe('create-user-3.yaml');
  });

  it('creates requests and folders, updating folder.yaml order', async () => {
    await createCollection(tmpDir, 'API Collection');

    const req1 = await createRequest(tmpDir, 'Get Users', {
      method: 'GET',
      url: 'https://api.example.com/users',
    });
    expect(req1.name).toBe('Get Users');
    expect(fs.existsSync(req1.path)).toBe(true);

    const folder1 = await createFolder(tmpDir, 'Auth');
    expect(folder1.name).toBe('Auth');
    expect(fs.existsSync(folder1.path)).toBe(true);
    expect(fs.existsSync(path.join(folder1.path, 'folder.yaml'))).toBe(true);

    const subReq = await createRequest(folder1.path, 'Login', {
      method: 'POST',
      url: 'https://api.example.com/login',
    });
    expect(subReq.name).toBe('Login');

    const treeData = await scanCollection(tmpDir);
    expect(treeData.tree).toHaveLength(2);

    const authFolder = treeData.tree.find(n => n.name === 'Auth');
    expect(authFolder).toBeDefined();
    expect(authFolder?.type).toBe('folder');
    expect(authFolder?.children).toHaveLength(1);
    expect(authFolder?.children?.[0]?.name).toBe('Login');
  });

  it('renames an item, updating both the name inside YAML and the filename on disk', async () => {
    await createCollection(tmpDir, 'Renaming Collection');
    const req = await createRequest(tmpDir, 'Old Name');
    expect(path.basename(req.path)).toBe('old-name.yaml');

    const renameResult = await renameItem(req.path, 'New Name');
    expect(renameResult.newName).toBe('New Name');
    expect(path.basename(renameResult.newPath)).toBe('new-name.yaml');
    expect(fs.existsSync(req.path)).toBe(false);
    expect(fs.existsSync(renameResult.newPath)).toBe(true);

    const fileContent = fs.readFileSync(renameResult.newPath, 'utf-8');
    const parsed = parseRequest(fileContent);
    expect(parsed.name).toBe('New Name');
  });

  it('duplicates a request with collision naming and order registration', async () => {
    await createCollection(tmpDir, 'Dup Collection');
    const req = await createRequest(tmpDir, 'List Items');

    const dup = await duplicateRequest(req.path);
    expect(dup.name).toBe('List Items (Copy)');
    expect(path.basename(dup.path)).toBe('list-items-copy.yaml');
    expect(fs.existsSync(dup.path)).toBe(true);

    const tree = await scanCollection(tmpDir);
    expect(tree.tree).toHaveLength(2);
  });

  it('moves an item between folders and updates order in both parent folders', async () => {
    await createCollection(tmpDir, 'Move Collection');
    const f1 = await createFolder(tmpDir, 'Folder 1');
    const f2 = await createFolder(tmpDir, 'Folder 2');
    const req = await createRequest(f1.path, 'Request in F1');

    const moveRes = await moveItem(req.path, f2.path);
    expect(fs.existsSync(req.path)).toBe(false);
    expect(fs.existsSync(moveRes.newPath)).toBe(true);

    const tree = await scanCollection(tmpDir);
    const folder1Node = tree.tree.find(n => n.name === 'Folder 1');
    const folder2Node = tree.tree.find(n => n.name === 'Folder 2');

    expect(folder1Node?.children).toHaveLength(0);
    expect(folder2Node?.children).toHaveLength(1);
    expect(folder2Node?.children?.[0]?.name).toBe('Request in F1');
  });

  it('deletes an item and cleans up from disk and folder.yaml order', async () => {
    await createCollection(tmpDir, 'Delete Collection');
    const req = await createRequest(tmpDir, 'To Delete');
    expect(fs.existsSync(req.path)).toBe(true);

    await deleteItem(req.path);
    expect(fs.existsSync(req.path)).toBe(false);

    const tree = await scanCollection(tmpDir);
    expect(tree.tree).toHaveLength(0);
  });

  it('captures corrupt files without halting collection scanning', async () => {
    await createCollection(tmpDir, 'Corrupt Collection');
    await createRequest(tmpDir, 'Valid Request');

    // Create an invalid corrupted YAML file
    const corruptPath = path.join(tmpDir, 'broken-file.yaml');
    fs.writeFileSync(corruptPath, 'foo: [broken yaml unclosed array', 'utf-8');

    const tree = await scanCollection(tmpDir);
    expect(tree.tree).toHaveLength(2);

    const validNode = tree.tree.find(n => n.name === 'Valid Request');
    const corruptNode = tree.tree.find(n => n.name === 'broken-file');

    expect(validNode).toBeDefined();
    expect(validNode?.parseError).toBeUndefined();

    expect(corruptNode).toBeDefined();
    expect(corruptNode?.parseError).toBeDefined();
    expect(typeof corruptNode?.parseError).toBe('string');
  });

  it('saving an untouched request produces no Git diff (exact raw text preservation)', async () => {
    await createCollection(tmpDir, 'Diff Test');

    const rawYaml = [
      '# Top-level comment about user creation',
      'version: 1',
      'name: Create User',
      'method: POST',
      'url: https://api.example.com/users',
      '',
      'headers:',
      '  - name: X-Custom-Header',
      '    value: 12345',
      '',
      'body:',
      '  type: json',
      '  content: |',
      '    {',
      '      "role": "admin"',
      '    }',
      '',
    ].join('\n');

    const filePath = path.join(tmpDir, 'create-user.yaml');
    fs.writeFileSync(filePath, rawYaml, 'utf-8');

    // Parse the file
    const parsed = parseRequest(rawYaml, filePath);

    // Save without touching any properties
    await saveRequest(filePath, parsed);

    const savedContent = fs.readFileSync(filePath, 'utf-8');
    expect(savedContent).toBe(rawYaml);
  });

  it('reorders folder items via folder.yaml order only', async () => {
    await createCollection(tmpDir, 'Reorder Collection');
    const reqA = await createRequest(tmpDir, 'Alpha');
    const reqB = await createRequest(tmpDir, 'Beta');
    const reqC = await createRequest(tmpDir, 'Gamma');

    // Default alphabetical or creation order
    let tree = await scanCollection(tmpDir);
    expect(tree.tree.map(n => n.name)).toEqual(['Alpha', 'Beta', 'Gamma']);

    // Reorder: Gamma, Alpha, Beta
    await reorderFolder(tmpDir, [
      path.basename(reqC.path),
      path.basename(reqA.path),
      path.basename(reqB.path),
    ]);

    tree = await scanCollection(tmpDir);
    expect(tree.tree.map(n => n.name)).toEqual(['Gamma', 'Alpha', 'Beta']);
  });
});
