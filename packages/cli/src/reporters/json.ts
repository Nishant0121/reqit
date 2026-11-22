import type { CollectionRunSummary } from '../types.js';

export function generateJsonReport(summary: CollectionRunSummary): string {
  return JSON.stringify(summary, null, 2);
}
