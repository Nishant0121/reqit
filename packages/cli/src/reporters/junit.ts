import type { CollectionRunSummary } from '../types.js';

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generateJunitReport(summary: CollectionRunSummary): string {
  const totalTests = summary.totalAssertions > 0 ? summary.totalAssertions : summary.totalRequests;
  const totalFailures =
    summary.failedAssertions + (summary.totalAssertions === 0 ? summary.failedRequests : 0);
  const totalTimeSec = (summary.totalDurationMs / 1000).toFixed(3);

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    `<testsuites name="Reqit: ${escapeXml(summary.collectionName)}" tests="${totalTests}" failures="${totalFailures}" errors="0" time="${totalTimeSec}">`,
  );

  for (const res of summary.results) {
    const suiteName = escapeXml(res.name);
    const suiteTimeSec = (res.durationMs / 1000).toFixed(3);
    const assertionsCount = res.assertions.length;

    if (assertionsCount === 0) {
      // Single test case for the whole request
      const failed = !res.passed;
      lines.push(
        `  <testsuite name="${suiteName}" tests="1" failures="${failed ? 1 : 0}" errors="0" time="${suiteTimeSec}">`,
      );
      lines.push(
        `    <testcase classname="${suiteName}" name="HTTP Request ${escapeXml(res.method)} ${escapeXml(res.url)}" time="${suiteTimeSec}">`,
      );
      if (failed) {
        const errorMsg = escapeXml(res.error || `Request failed with status ${res.status}`);
        lines.push(
          `      <failure message="${errorMsg}" type="RequestError">${errorMsg}</failure>`,
        );
      }
      lines.push('    </testcase>');
      lines.push('  </testsuite>');
    } else {
      const suiteFailures = res.assertions.filter(a => !a.passed).length;
      lines.push(
        `  <testsuite name="${suiteName}" tests="${assertionsCount}" failures="${suiteFailures}" errors="0" time="${suiteTimeSec}">`,
      );

      for (const assertion of res.assertions) {
        const testName = escapeXml(assertion.name || 'Assertion');
        const testTimeSec = ((assertion.durationMs ?? 0) / 1000).toFixed(3);
        lines.push(
          `    <testcase classname="${suiteName}" name="${testName}" time="${testTimeSec}">`,
        );
        if (!assertion.passed) {
          const message = escapeXml(assertion.message || 'Assertion failed');
          lines.push(
            `      <failure message="${message}" type="AssertionFailure">${message}</failure>`,
          );
        }
        lines.push('    </testcase>');
      }

      if (res.error) {
        // Additional testcase for unexpected script/network error
        lines.push(`    <testcase classname="${suiteName}" name="Execution Error" time="0.000">`);
        const errorMsg = escapeXml(res.error);
        lines.push(
          `      <failure message="${errorMsg}" type="ExecutionError">${errorMsg}</failure>`,
        );
        lines.push('    </testcase>');
      }

      lines.push('  </testsuite>');
    }
  }

  lines.push('</testsuites>');
  return lines.join('\n');
}
