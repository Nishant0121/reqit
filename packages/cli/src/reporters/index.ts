import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CollectionRunSummary } from '../types.js';
import { formatRequestResult, formatSummary } from './console.js';
import { generateJsonReport } from './json.js';
import { generateJunitReport } from './junit.js';

export { formatRequestResult, formatSummary, generateJsonReport, generateJunitReport };

export interface ProcessReportersOptions {
  reporter?: string | string[];
  output?: string;
  silent?: boolean;
}

export function parseReporterList(reporterOpt?: string | string[]): string[] {
  if (!reporterOpt) return ['console'];
  if (Array.isArray(reporterOpt)) {
    return reporterOpt.flatMap(r => r.split(',')).map(r => r.trim().toLowerCase());
  }
  return reporterOpt.split(',').map(r => r.trim().toLowerCase());
}

export async function processReporters(
  summary: CollectionRunSummary,
  options: ProcessReportersOptions = {},
): Promise<void> {
  const reporters = parseReporterList(options.reporter);
  const wantsConsole = reporters.includes('console');
  const wantsJson = reporters.includes('json');
  const wantsJunit = reporters.includes('junit');

  // Console output
  if (wantsConsole && !options.silent) {
    console.log(formatSummary(summary));
  }

  // Handle file output or stdout for JSON
  if (wantsJson) {
    const jsonOutput = generateJsonReport(summary);
    if (options.output && (reporters.length === 1 || !wantsJunit)) {
      const outPath = path.resolve(options.output);
      await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
      await fs.promises.writeFile(outPath, jsonOutput, 'utf-8');
    } else if (!wantsConsole) {
      console.log(jsonOutput);
    }
  }

  // Handle file output or stdout for JUnit
  if (wantsJunit) {
    const junitOutput = generateJunitReport(summary);
    if (options.output) {
      const outPath = path.resolve(options.output);
      await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
      await fs.promises.writeFile(outPath, junitOutput, 'utf-8');
    } else if (!wantsConsole && !wantsJson) {
      console.log(junitOutput);
    }
  }
}
