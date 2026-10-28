import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Converts a human-readable display name to a clean, filesystem-safe slug.
 */
export function slugify(name: string): string {
  const clean = (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return clean || 'untitled';
}

/**
 * Computes a unique filename or directory name inside `dirPath` with numerical collision handling.
 * Example: `create-user.yaml` -> `create-user-2.yaml` -> `create-user-3.yaml`.
 */
export function getUniqueSlug(
  dirPath: string,
  name: string,
  options: { isFolder?: boolean; currentPath?: string } = {},
): string {
  const baseSlug = slugify(name);
  const ext = options.isFolder ? '' : '.yaml';

  let candidate = `${baseSlug}${ext}`;
  let fullPath = path.join(dirPath, candidate);

  // If this candidate is the item's current path, it is not a collision
  if (options.currentPath && path.resolve(fullPath) === path.resolve(options.currentPath)) {
    return candidate;
  }

  let counter = 2;
  while (fs.existsSync(fullPath)) {
    // If the collided path is the item itself, we can keep it
    if (options.currentPath && path.resolve(fullPath) === path.resolve(options.currentPath)) {
      return candidate;
    }
    candidate = `${baseSlug}-${counter}${ext}`;
    fullPath = path.join(dirPath, candidate);
    counter++;
  }

  return candidate;
}
