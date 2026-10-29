import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseCollection, parseFolder, parseRequest } from '../format/parser.js';
import { serializeCollection } from '../format/serializer.js';
import type { CollectionFile } from '../format/types.js';
import { loadEnvironments, loadSecrets } from './environments.js';
import { readFolderFile } from './order.js';
import type { CollectionTree, CollectionTreeNode } from './types.js';

export const REQIT_YAML = 'reqit.yaml';

const IGNORED_NAMES = new Set([
  '.git',
  '.svn',
  '.hg',
  'node_modules',
  '.DS_Store',
  'Thumbs.db',
  'reqit.yaml',
  'folder.yaml',
  'environments',
  '.reqit',
]);

/**
 * Recursively scans a collection directory on disk and builds a full tree of requests and folders.
 * Corrupt files are captured with a `parseError` property on their node and do not halt scanning.
 */
export async function scanCollection(rootPath: string): Promise<CollectionTree> {
  const resolvedRoot = path.resolve(rootPath);

  // 1. Load or initialize reqit.yaml
  const reqitPath = path.join(resolvedRoot, REQIT_YAML);
  let collection: CollectionFile;

  if (fs.existsSync(reqitPath)) {
    try {
      const text = await fs.promises.readFile(reqitPath, 'utf-8');
      collection = parseCollection(text, reqitPath);
    } catch {
      // If reqit.yaml is corrupted, provide a safe fallback so the app stays functional
      collection = {
        version: 1,
        name: path.basename(resolvedRoot),
      };
    }
  } else {
    // Auto-create minimal reqit.yaml
    collection = {
      version: 1,
      name: path.basename(resolvedRoot),
    };
    try {
      await fs.promises.writeFile(reqitPath, serializeCollection(collection), 'utf-8');
    } catch {
      // ignore
    }
  }

  // 2. Scan children recursively starting at root
  const tree = await scanDirectory(resolvedRoot, resolvedRoot);

  // 3. Load environments and secrets
  const environments = await loadEnvironments(resolvedRoot);
  const secrets = await loadSecrets(resolvedRoot);

  return {
    rootPath: resolvedRoot,
    collection,
    tree,
    environments,
    secrets,
  };
}

async function scanDirectory(currentDir: string, rootPath: string): Promise<CollectionTreeNode[]> {
  const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
  const folderData = await readFolderFile(currentDir);
  const orderList = folderData?.order || [];

  const children: CollectionTreeNode[] = [];

  for (const entry of entries) {
    const entryName = entry.name;

    // Skip hidden files/directories and reserved filenames
    if (entryName.startsWith('.') || IGNORED_NAMES.has(entryName)) {
      continue;
    }

    const fullPath = path.join(currentDir, entryName);
    const relPath = path.relative(rootPath, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      // Subdirectory (Folder node)
      let folderName = entryName;
      let folderFileObj = undefined;
      let parseErr = undefined;

      const subFolderYamlPath = path.join(fullPath, 'folder.yaml');
      if (fs.existsSync(subFolderYamlPath)) {
        try {
          const yamlContent = await fs.promises.readFile(subFolderYamlPath, 'utf-8');
          folderFileObj = parseFolder(yamlContent, subFolderYamlPath);
          folderName = folderFileObj.name || entryName;
        } catch (err: unknown) {
          parseErr = err instanceof Error ? err.message : String(err);
        }
      }

      const subChildren = await scanDirectory(fullPath, rootPath);

      children.push({
        id: fullPath,
        name: folderName,
        path: fullPath,
        relativePath: relPath,
        type: 'folder',
        folder: folderFileObj,
        parseError: parseErr,
        children: subChildren,
      });
    } else if (entry.isFile() && (entryName.endsWith('.yaml') || entryName.endsWith('.yml'))) {
      // Request file node
      // Skip environment or secrets files if present
      if (entryName.endsWith('.env.yaml') || entryName.endsWith('.secrets.yaml')) {
        continue;
      }

      const baseNameWithoutExt = path.basename(entryName, path.extname(entryName));

      try {
        const fileContent = await fs.promises.readFile(fullPath, 'utf-8');
        const req = parseRequest(fileContent, fullPath);

        children.push({
          id: fullPath,
          name: req.name || baseNameWithoutExt,
          path: fullPath,
          relativePath: relPath,
          type: 'request',
          method: req.method,
          request: req,
        });
      } catch (err: unknown) {
        // Corrupt or invalid YAML file: record parseError without halting
        children.push({
          id: fullPath,
          name: baseNameWithoutExt,
          path: fullPath,
          relativePath: relPath,
          type: 'request',
          parseError: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // 3. Sort children based on folder.yaml order, then alphabetically
  return sortChildren(children, orderList);
}

/**
 * Sorts nodes:
 * 1. Items in `order` array appear first in the exact order specified.
 * 2. Unlisted items appear after: folders first alphabetically, then requests alphabetically.
 */
function sortChildren(items: CollectionTreeNode[], order: string[]): CollectionTreeNode[] {
  const orderMap = new Map<string, number>();
  order.forEach((name, idx) => orderMap.set(name, idx));

  return [...items].sort((a, b) => {
    const aBase = path.basename(a.path);
    const bBase = path.basename(b.path);

    const aOrder = orderMap.get(aBase);
    const bOrder = orderMap.get(bBase);

    if (aOrder !== undefined && bOrder !== undefined) {
      return aOrder - bOrder;
    }
    if (aOrder !== undefined) return -1;
    if (bOrder !== undefined) return 1;

    // Both unlisted: folders first, then alphabetically
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }

    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
  });
}
