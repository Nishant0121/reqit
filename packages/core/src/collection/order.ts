import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseFolder } from '../format/parser.js';
import { serializeFolder } from '../format/serializer.js';
import type { FolderFile } from '../format/types.js';

export const FOLDER_YAML = 'folder.yaml';

/**
 * Reads and parses `folder.yaml` inside `dirPath` if it exists.
 */
export async function readFolderFile(dirPath: string): Promise<FolderFile | null> {
  const filePath = path.join(dirPath, FOLDER_YAML);
  if (!fs.existsSync(filePath)) return null;

  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return parseFolder(content, filePath);
  } catch {
    return null;
  }
}

/**
 * Ensures a `folder.yaml` file exists in `dirPath` with at least a valid name and version.
 */
export async function ensureFolderFile(dirPath: string, defaultName?: string): Promise<FolderFile> {
  const existing = await readFolderFile(dirPath);
  if (existing) return existing;

  const folderData: FolderFile = {
    version: 1,
    name: defaultName || path.basename(dirPath),
    order: [],
  };

  const yamlText = serializeFolder(folderData);
  await fs.promises.writeFile(path.join(dirPath, FOLDER_YAML), yamlText, 'utf-8');
  return folderData;
}

/**
 * Updates the `order` array in `folder.yaml` for a folder.
 */
export async function writeFolderOrder(dirPath: string, newOrder: string[]): Promise<void> {
  const folder = (await readFolderFile(dirPath)) || {
    version: 1,
    name: path.basename(dirPath),
    order: [],
  };

  folder.order = newOrder;
  const yamlText = serializeFolder(folder);
  await fs.promises.writeFile(path.join(dirPath, FOLDER_YAML), yamlText, 'utf-8');
}

/**
 * Appends a slug to `folder.yaml` order if present.
 */
export async function addSlugToOrder(dirPath: string, slug: string): Promise<void> {
  const folder = await readFolderFile(dirPath);
  if (!folder) return; // If no folder.yaml was created, don't force creation unless needed

  const currentOrder = folder.order || [];
  if (!currentOrder.includes(slug)) {
    folder.order = [...currentOrder, slug];
    await fs.promises.writeFile(path.join(dirPath, FOLDER_YAML), serializeFolder(folder), 'utf-8');
  }
}

/**
 * Removes a slug from `folder.yaml` order.
 */
export async function removeSlugFromOrder(dirPath: string, slug: string): Promise<void> {
  const folder = await readFolderFile(dirPath);
  if (!folder || !folder.order) return;

  folder.order = folder.order.filter(s => s !== slug);
  await fs.promises.writeFile(path.join(dirPath, FOLDER_YAML), serializeFolder(folder), 'utf-8');
}

/**
 * Replaces an old slug with a new slug in `folder.yaml` order.
 */
export async function renameSlugInOrder(
  dirPath: string,
  oldSlug: string,
  newSlug: string,
): Promise<void> {
  const folder = await readFolderFile(dirPath);
  if (!folder || !folder.order) return;

  folder.order = folder.order.map(s => (s === oldSlug ? newSlug : s));
  await fs.promises.writeFile(path.join(dirPath, FOLDER_YAML), serializeFolder(folder), 'utf-8');
}
