import type { RunnerSummary } from './types.js';

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateHtmlReport(summary: RunnerSummary): string {
  const durationSec = (summary.totalDurationMs / 1000).toFixed(2);
  const statusColor = summary.success ? '#10b981' : '#ef4444';
  const statusLabel = summary.success ? 'PASSED' : 'FAILED';

  let iterationsHtml = '';

  for (const iter of summary.iterations) {
    let dataRowHtml = '';
    if (iter.dataRow && Object.keys(iter.dataRow).length > 0) {
      const badges = Object.entries(iter.dataRow)
        .map(
          ([k, v]) =>
            `<span class="data-badge"><strong>${escapeHtml(k)}:</strong> ${escapeHtml(String(v))}</span>`,
        )
        .join(' ');
      dataRowHtml = `<div class="data-row-container"><span class="data-label">Data Variables:</span> ${badges}</div>`;
    }

    let requestsHtml = '';
    for (const req of iter.results) {
      const method = escapeHtml(req.method.toUpperCase());
      const methodClass = `method-${method.toLowerCase()}`;
      const statusClass = req.passed ? 'status-pass' : 'status-fail';
      const statusText = req.status ? `${req.status} ${escapeHtml(req.statusText || '')}` : 'ERROR';

      let assertionsListHtml = '';
      if (req.assertions && req.assertions.length > 0) {
        const items = req.assertions
          .map(a => {
            const icon = a.passed
              ? '<span class="icon-pass">✔</span>'
              : '<span class="icon-fail">✖</span>';
            const msg = a.message
              ? `<div class="assertion-msg">${escapeHtml(a.message)}</div>`
              : '';
            return `<li class="assertion-item ${a.passed ? 'item-pass' : 'item-fail'}">
              <div class="assertion-title">${icon} ${escapeHtml(a.name || 'Assertion')} <span class="assertion-time">${a.durationMs ?? 0}ms</span></div>
              ${msg}
            </li>`;
          })
          .join('');
        assertionsListHtml = `<ul class="assertions-list">${items}</ul>`;
      }

      let errorHtml = '';
      if (req.error) {
        errorHtml = `<div class="request-error"><strong>Error:</strong> ${escapeHtml(req.error)}</div>`;
      }

      let logsHtml = '';
      if (req.scriptLogs && req.scriptLogs.length > 0) {
        const logLines = req.scriptLogs
          .map(l => `<div>[${l.level}] ${escapeHtml(l.args.join(' '))}</div>`)
          .join('');
        logsHtml = `<details class="script-logs"><summary>Console Logs (${req.scriptLogs.length})</summary><pre>${logLines}</pre></details>`;
      }

      requestsHtml += `
        <div class="request-card ${req.passed ? 'card-pass' : 'card-fail'}">
          <div class="request-header">
            <span class="method-badge ${methodClass}">${method}</span>
            <span class="request-name">${escapeHtml(req.name)}</span>
            <span class="request-url">${escapeHtml(req.url)}</span>
            <span class="status-badge ${statusClass}">${statusText}</span>
            <span class="duration-badge">${req.durationMs}ms</span>
          </div>
          ${errorHtml}
          ${assertionsListHtml}
          ${logsHtml}
        </div>
      `;
    }

    iterationsHtml += `
      <div class="iteration-section">
        <div class="iteration-header">
          <h3>Iteration ${iter.iteration}</h3>
          <span class="iteration-badge ${iter.passed ? 'status-pass' : 'status-fail'}">${iter.passed ? 'Passed' : 'Failed'}</span>
        </div>
        ${dataRowHtml}
        <div class="requests-container">
          ${requestsHtml}
        </div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reqit Test Report - ${escapeHtml(summary.collectionName)}</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --text-dim: #94a3b8;
      --primary: #3b82f6;
      --success: #10b981;
      --error: #ef4444;
      --warning: #f59e0b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); padding: 2rem; line-height: 1.5; }
    .container { max-width: 1100px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--border); padding-bottom: 1.5rem; margin-bottom: 2rem; }
    .brand { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--primary); font-weight: 700; margin-bottom: 0.25rem; }
    h1 { font-size: 1.85rem; font-weight: 700; }
    .subtitle { color: var(--text-dim); font-size: 0.95rem; margin-top: 0.25rem; }
    .status-banner { font-size: 1.1rem; font-weight: 800; padding: 0.5rem 1.25rem; border-radius: 9999px; text-align: center; border: 2px solid ${statusColor}; color: ${statusColor}; background: rgba(0,0,0,0.2); }
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 2.5rem; }
    .metric-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 1rem 1.25rem; }
    .metric-title { font-size: 0.8rem; text-transform: uppercase; color: var(--text-dim); font-weight: 600; margin-bottom: 0.25rem; }
    .metric-value { font-size: 1.6rem; font-weight: 700; }
    .metric-sub { font-size: 0.85rem; color: var(--text-dim); margin-top: 0.25rem; }
    .iteration-section { background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; padding: 1.5rem; margin-bottom: 2rem; }
    .iteration-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem; margin-bottom: 1rem; }
    .data-row-container { background: rgba(0,0,0,0.25); border: 1px solid var(--border); border-radius: 6px; padding: 0.5rem 0.75rem; margin-bottom: 1rem; display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
    .data-label { font-size: 0.8rem; color: var(--text-dim); font-weight: 600; text-transform: uppercase; }
    .data-badge { background: #334155; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.85rem; }
    .request-card { background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border); border-radius: 6px; padding: 0.85rem 1rem; margin-bottom: 0.75rem; }
    .card-fail { border-left: 4px solid var(--error); }
    .card-pass { border-left: 4px solid var(--success); }
    .request-header { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .method-badge { font-size: 0.75rem; font-weight: 800; padding: 0.2rem 0.45rem; border-radius: 4px; }
    .method-get { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
    .method-post { background: rgba(16, 185, 129, 0.2); color: #34d399; }
    .method-put { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
    .method-delete { background: rgba(239, 68, 68, 0.2); color: #f87171; }
    .request-name { font-weight: 600; font-size: 0.95rem; }
    .request-url { color: var(--text-dim); font-family: monospace; font-size: 0.85rem; flex-grow: 1; word-break: break-all; }
    .status-badge { font-weight: 700; font-size: 0.85rem; padding: 0.15rem 0.5rem; border-radius: 4px; }
    .status-pass { color: var(--success); background: rgba(16, 185, 129, 0.1); }
    .status-fail { color: var(--error); background: rgba(239, 68, 68, 0.1); }
    .duration-badge { font-size: 0.85rem; color: var(--text-dim); }
    .request-error { color: var(--error); background: rgba(239,68,68,0.1); padding: 0.5rem; border-radius: 4px; margin-top: 0.5rem; font-size: 0.85rem; }
    .assertions-list { list-style: none; margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px dashed var(--border); }
    .assertion-item { font-size: 0.85rem; padding: 0.25rem 0; display: flex; flex-direction: column; }
    .assertion-title { display: flex; align-items: center; gap: 0.4rem; }
    .assertion-time { color: var(--text-dim); font-size: 0.75rem; margin-left: auto; }
    .assertion-msg { color: var(--error); font-size: 0.8rem; margin-left: 1.25rem; margin-top: 0.15rem; }
    .icon-pass { color: var(--success); font-weight: bold; }
    .icon-fail { color: var(--error); font-weight: bold; }
    .script-logs { margin-top: 0.5rem; font-size: 0.8rem; color: var(--text-dim); }
    .script-logs pre { background: rgba(0,0,0,0.3); padding: 0.5rem; border-radius: 4px; margin-top: 0.25rem; font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <div class="brand">Reqit Collection Runner</div>
        <h1>${escapeHtml(summary.collectionName)}</h1>
        <div class="subtitle">
          ${summary.environmentName ? `Environment: <strong>${escapeHtml(summary.environmentName)}</strong> • ` : ''}
          Generated: ${escapeHtml(summary.endTime)}
        </div>
      </div>
      <div class="status-banner">${statusLabel}</div>
    </header>

    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-title">Requests</div>
        <div class="metric-value">${summary.passedRequests} / ${summary.totalRequests}</div>
        <div class="metric-sub">${summary.failedRequests === 0 ? '<span style="color:var(--success)">100% Passed</span>' : `<span style="color:var(--error)">${summary.failedRequests} Failed</span>`}</div>
      </div>
      <div class="metric-card">
        <div class="metric-title">Assertions</div>
        <div class="metric-value">${summary.passedAssertions} / ${summary.totalAssertions}</div>
        <div class="metric-sub">${summary.failedAssertions === 0 ? '<span style="color:var(--success)">All assertions passed</span>' : `<span style="color:var(--error)">${summary.failedAssertions} Failed</span>`}</div>
      </div>
      <div class="metric-card">
        <div class="metric-title">Iterations</div>
        <div class="metric-value">${summary.totalIterations}</div>
        <div class="metric-sub">Cycles executed</div>
      </div>
      <div class="metric-card">
        <div class="metric-title">Total Duration</div>
        <div class="metric-value">${durationSec}s</div>
        <div class="metric-sub">Execution time</div>
      </div>
    </div>

    ${iterationsHtml}
  </div>
</body>
</html>`;
}
