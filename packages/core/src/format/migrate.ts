import { CURRENT_FORMAT_VERSION } from './types.js';

/**
 * Migration helper for format versions.
 * In v1, this is an identity function.
 * When breaking format changes occur in future versions, migration functions
 * will sequentially transform objects from version N to N+1.
 */
export function migrate<T extends { version: number }>(
  data: T,
  targetVersion: number = CURRENT_FORMAT_VERSION,
): T {
  if (typeof data.version !== 'number' || isNaN(data.version)) {
    throw new Error('Invalid format version: version must be a valid number.');
  }

  if (data.version === targetVersion) {
    return data;
  }

  if (data.version > targetVersion) {
    throw new Error(
      `Cannot migrate down from format version ${data.version} to ${targetVersion}. Please update Reqit.`,
    );
  }

  // Future migration dispatch:
  // let current = data;
  // while (current.version < targetVersion) {
  //   current = runMigrationStep(current, current.version + 1);
  // }
  // return current;

  return data;
}
