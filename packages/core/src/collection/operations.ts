import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseRequest } from '../format/parser.js';
import { serializeCollection, serializeFolder, serializeRequest } from '../format/serializer.js';
import type { RequestFile } from '../format/types.js';
import {
  addSlugToOrder,
  ensureFolderFile,
  readFolderFile,
  removeSlugFromOrder,
  renameSlugInOrder,
  writeFolderOrder,
} from './order.js';
import { REQIT_YAML } from './scanner.js';
import { getUniqueSlug } from './slug.js';
import type { CollectionTreeNode } from './types.js';

/**
 * Creates a new collection on disk with a `reqit.yaml` file.
 */
export async function createCollection(
  targetDir: string,
  name: string,
): Promise<{ rootPath: string; name: string }> {
  const resolved = path.resolve(targetDir);
  await fs.promises.mkdir(resolved, { recursive: true });

  const reqitPath = path.join(resolved, REQIT_YAML);
  const collectionData = {
    version: 1,
    name: name.trim() || path.basename(resolved),
  };

  await fs.promises.writeFile(reqitPath, serializeCollection(collectionData), 'utf-8');

  return {
    rootPath: resolved,
    name: collectionData.name,
  };
}

/**
 * Creates a new request file in `parentDir` and records it in `folder.yaml` order.
 */
export async function createRequest(
  parentDir: string,
  name: string,
  data?: Partial<RequestFile>,
): Promise<CollectionTreeNode> {
  const resolvedParent = path.resolve(parentDir);
  await fs.promises.mkdir(resolvedParent, { recursive: true });

  const slug = getUniqueSlug(resolvedParent, name, { isFolder: false });
  const filePath = path.join(resolvedParent, slug);

  const request: RequestFile = {
    version: 1,
    name: name.trim() || 'Untitled Request',
    method: data?.method || 'GET',
    url: data?.url || 'https://httpbin.org/get',
    ...data,
  };

  const yamlText = serializeRequest(request);
  await fs.promises.writeFile(filePath, yamlText, 'utf-8');

  // Track in parent order
  await addSlugToOrder(resolvedParent, slug);

  return {
    id: filePath,
    name: request.name,
    path: filePath,
    relativePath: slug,
    type: 'request',
    method: request.method,
    request,
  };
}

/**
 * Creates a new subfolder in `parentDir` with an initial `folder.yaml`.
 */
export async function createFolder(parentDir: string, name: string): Promise<CollectionTreeNode> {
  const resolvedParent = path.resolve(parentDir);
  await fs.promises.mkdir(resolvedParent, { recursive: true });

  const slug = getUniqueSlug(resolvedParent, name, { isFolder: true });
  const folderPath = path.join(resolvedParent, slug);
  await fs.promises.mkdir(folderPath, { recursive: true });

  const folderObj = await ensureFolderFile(folderPath, name.trim());

  // Track in parent order
  await addSlugToOrder(resolvedParent, slug);

  return {
    id: folderPath,
    name: folderObj.name,
    path: folderPath,
    relativePath: slug,
    type: 'folder',
    folder: folderObj,
    children: [],
  };
}

/**
 * Persists changes to a request file using `serializeRequest`.
 */
export async function saveRequest(filePath: string, request: RequestFile): Promise<void> {
  const resolved = path.resolve(filePath);
  const yamlText = serializeRequest(request);
  await fs.promises.writeFile(resolved, yamlText, 'utf-8');
}

/**
 * Renames an item: updates the `name` field inside the file/folder.yaml and renames the file on disk.
 */
export async function renameItem(
  itemPath: string,
  newName: string,
): Promise<{ newPath: string; newName: string }> {
  const resolved = path.resolve(itemPath);
  const parentDir = path.dirname(resolved);
  const oldSlug = path.basename(resolved);
  const stat = await fs.promises.stat(resolved);
  const isFolder = stat.isDirectory();

  const trimmedName = newName.trim();
  const newSlug = getUniqueSlug(parentDir, trimmedName, { isFolder, currentPath: resolved });
  const newPath = path.join(parentDir, newSlug);

  if (isFolder) {
    // 1. Rename directory if slug changed
    if (resolved !== newPath) {
      await fs.promises.rename(resolved, newPath);
      await renameSlugInOrder(parentDir, oldSlug, newSlug);
    }
    // 2. Update name in folder.yaml
    const folderYamlPath = path.join(newPath, 'folder.yaml');
    let folderObj = await readFolderFile(newPath);
    if (!folderObj) {
      folderObj = { version: 1, name: trimmedName, order: [] };
    } else {
      folderObj.name = trimmedName;
    }
    await fs.promises.writeFile(folderYamlPath, serializeFolder(folderObj), 'utf-8');

    return { newPath, newName: trimmedName };
  } else {
    // Request file
    const content = await fs.promises.readFile(resolved, 'utf-8');
    const req = parseRequest(content, resolved);
    req.name = trimmedName;

    const newYamlText = serializeRequest(req);

    if (resolved !== newPath) {
      // Remove old file and write to new path
      await fs.promises.unlink(resolved);
      await fs.promises.writeFile(newPath, newYamlText, 'utf-8');
      await renameSlugInOrder(parentDir, oldSlug, newSlug);
    } else {
      await fs.promises.writeFile(resolved, newYamlText, 'utf-8');
    }

    return { newPath, newName: trimmedName };
  }
}

/**
 * Duplicates a request file with collision handling and registers it in the parent order.
 */
export async function duplicateRequest(sourcePath: string): Promise<CollectionTreeNode> {
  const resolved = path.resolve(sourcePath);
  const parentDir = path.dirname(resolved);
  const content = await fs.promises.readFile(resolved, 'utf-8');
  const req = parseRequest(content, resolved);

  const dupName = `${req.name} (Copy)`;
  req.name = dupName;

  const slug = getUniqueSlug(parentDir, dupName, { isFolder: false });
  const newPath = path.join(parentDir, slug);

  await fs.promises.writeFile(newPath, serializeRequest(req), 'utf-8');
  await addSlugToOrder(parentDir, slug);

  return {
    id: newPath,
    name: dupName,
    path: newPath,
    relativePath: slug,
    type: 'request',
    method: req.method,
    request: req,
  };
}

/**
 * Deletes a file or folder and removes it from the parent's `folder.yaml` order.
 */
export async function deleteItem(itemPath: string): Promise<void> {
  const resolved = path.resolve(itemPath);
  const parentDir = path.dirname(resolved);
  const slug = path.basename(resolved);

  const stat = await fs.promises.stat(resolved);
  if (stat.isDirectory()) {
    await fs.promises.rm(resolved, { recursive: true, force: true });
  } else {
    await fs.promises.unlink(resolved);
  }

  await removeSlugFromOrder(parentDir, slug);
}

/**
 * Moves an item from its current directory to `targetDirPath` and updates order in both parent directories.
 */
export async function moveItem(
  sourcePath: string,
  targetDirPath: string,
): Promise<{ newPath: string; newSlug: string }> {
  const resolvedSource = path.resolve(sourcePath);
  const resolvedTargetDir = path.resolve(targetDirPath);
  const oldParentDir = path.dirname(resolvedSource);
  const oldSlug = path.basename(resolvedSource);

  const stat = await fs.promises.stat(resolvedSource);
  const isFolder = stat.isDirectory();

  const newSlug = getUniqueSlug(resolvedTargetDir, oldSlug.replace(/\.ya?ml$/, ''), { isFolder });
  const destPath = path.join(resolvedTargetDir, newSlug);

  await fs.promises.rename(resolvedSource, destPath);

  // Update orders
  await removeSlugFromOrder(oldParentDir, oldSlug);
  await addSlugToOrder(resolvedTargetDir, newSlug);

  return { newPath: destPath, newSlug };
}

/**
 * Updates `order` in `folder.yaml` for drag-and-drop reordering.
 */
export async function reorderFolder(folderPath: string, order: string[]): Promise<void> {
  const resolved = path.resolve(folderPath);
  await writeFolderOrder(resolved, order);
}
