/**
 * @reqit/core
 * Core engine and format handler for Reqit.
 */

export const VERSION = '0.1.0';

export function ping(): string {
  return 'pong';
}

export * from './format/index.js';
export * from './variables/index.js';
export * from './engine/index.js';
export * from './collection/index.js';
