import pc from 'picocolors';
import type { CollectionRunSummary, RequestRunResult } from '../types.js';

export function formatRequestResult(result: RequestRunResult): string {
  const lines: string[] = [];
  const methodBadge = pc.cyan(`[${result.method.toUpperCase()}]`);
  const statusBadge = result.status
    ? result.passed
      ? pc.green(`${result.status} ${result.statusText || 'OK'}`)
      : pc.red(`${result.status} ${result.statusText || 'Error'}`)
    : pc.red('ERROR');

  const duration = pc.dim(`${result.durationMs}ms`);
  const size = result.sizeBytes ? pc.dim(`, ${(result.sizeBytes / 1024).toFixed(1)} KB`) : '';

  lines.push(
    `${methodBadge} ${pc.bold(result.name)} (${result.url}) -> ${statusBadge} ${duration}${size}`,
  );

  // Script logs
  if (result.scriptLogs && result.scriptLogs.length > 0) {
    for (const log of result.scriptLogs) {
      lines.push(pc.dim(`   [log] ${log.args.join(' ')}`));
    }
  }

  // Assertions
  for (const assertion of result.assertions) {
    if (assertion.passed) {
      lines.push(pc.green(`   ✔ ${assertion.name}`) + pc.dim(` (${assertion.durationMs ?? 0}ms)`));
    } else {
      lines.push(
        pc.red(`   ✖ ${assertion.name}`) +
          (assertion.message ? pc.red(`: ${assertion.message}`) : ''),
      );
    }
  }

  // Errors
  if (result.error) {
    lines.push(pc.red(`   ✖ Error: ${result.error}`));
  }

  return lines.join('\n');
}

export function formatSummary(summary: CollectionRunSummary): string {
  const divider = pc.dim('─'.repeat(55));
  const lines: string[] = [];

  lines.push('');
  lines.push(divider);
  lines.push(pc.bold('Reqit Collection Run Summary'));
  lines.push(divider);
  lines.push(`${pc.dim('Collection:')}   ${summary.collectionName}`);
  if (summary.environmentName) {
    lines.push(`${pc.dim('Environment:')}  ${summary.environmentName}`);
  }
  lines.push(`${pc.dim('Duration:')}     ${(summary.totalDurationMs / 1000).toFixed(2)}s`);
  lines.push('');

  const reqStatus =
    summary.failedRequests === 0
      ? pc.green(`${summary.passedRequests} passed`) + `, ${summary.totalRequests} total`
      : pc.red(`${summary.failedRequests} failed`) +
        `, ` +
        pc.green(`${summary.passedRequests} passed`) +
        `, ${summary.totalRequests} total`;

  lines.push(`${pc.dim('Requests:')}     ${reqStatus}`);

  if (summary.totalAssertions > 0) {
    const assertStatus =
      summary.failedAssertions === 0
        ? pc.green(`${summary.passedAssertions} passed`) + `, ${summary.totalAssertions} total`
        : pc.red(`${summary.failedAssertions} failed`) +
          `, ` +
          pc.green(`${summary.passedAssertions} passed`) +
          `, ${summary.totalAssertions} total`;
    lines.push(`${pc.dim('Assertions:')}   ${assertStatus}`);
  }

  lines.push(divider);
  const finalStatus = summary.success
    ? pc.green(pc.bold('SUCCESS (exit code 0)'))
    : pc.red(pc.bold('FAILURE (exit code 1)'));
  lines.push(`${pc.dim('Result:')}       ${finalStatus}`);
  lines.push(divider);

  return lines.join('\n');
}
