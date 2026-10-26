/**
 * Internal symbols for attaching parsed document AST and snapshot metadata
 * to format objects without polluting enumerable properties.
 */

export const RAW_DOC = Symbol.for('reqit.rawDoc');
export const RAW_TEXT = Symbol.for('reqit.rawText');
export const RAW_SNAPSHOT = Symbol.for('reqit.rawSnapshot');

export function createSnapshot(obj: unknown): string {
  try {
    return JSON.stringify(obj, (key, value) => {
      // Ignore internal symbol properties
      if (typeof key === 'symbol') {
        return undefined;
      }
      return value;
    });
  } catch {
    return '';
  }
}
