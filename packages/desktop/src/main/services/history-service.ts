import Database from 'better-sqlite3';
import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { HttpMethod, RequestFile, ResponseResult } from '@reqit/core';
import type {
  HistoryEntrySummary,
  HistoryEntryDetail,
  HistorySettings,
  HistoryListFilter,
} from '../../shared/ipc-types.js';

const DEFAULT_SETTINGS: HistorySettings = {
  enabled: true,
  maxEntries: 1000,
  retentionDays: 30,
};

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB cap
const TRUNCATION_NOTICE = '\n... [Truncated: response exceeded 1 MB limit]';

const SENSITIVE_HEADER_REGEX =
  /^(authorization|x-api-key|api-key|apikey|cookie|set-cookie|proxy-authorization|token|secret|access-token|refresh-token)$/i;
const SENSITIVE_PARAM_REGEX = /^(api[_-]?key|password|secret|token|access[_-]?token)$/i;

function getValidDbPath(customPath?: string): string {
  if (customPath) return customPath;
  try {
    const userData = app.getPath('userData');
    return path.join(userData, 'history.sqlite');
  } catch {
    return path.join(process.cwd(), '.reqit-history.sqlite');
  }
}

export interface AddHistoryEntryParams {
  request: RequestFile;
  resolvedUrl?: string;
  collectionPath?: string;
  result?: ResponseResult;
  error?: Error | string;
  durationMs?: number;
  knownSecrets?: string[];
}

export class HistoryService {
  private db: Database.Database;

  constructor(customPath?: string) {
    const dbPath = getValidDbPath(customPath);
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new Database(dbPath);
    // 1. Database & Performance: Enable WAL Mode
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS history_entries (
        rowid_seq INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT UNIQUE NOT NULL,
        timestamp INTEGER NOT NULL,
        collection_path TEXT,
        request_name TEXT NOT NULL,
        method TEXT NOT NULL,
        url TEXT NOT NULL,
        status INTEGER,
        status_text TEXT,
        duration_ms INTEGER,
        size_bytes INTEGER,
        is_error INTEGER NOT NULL DEFAULT 0,
        request_summary_json TEXT NOT NULL,
        response_headers_json TEXT,
        response_body TEXT,
        error_message TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_history_timestamp ON history_entries(timestamp DESC, rowid_seq DESC);
      CREATE INDEX IF NOT EXISTS idx_history_status ON history_entries(status);
      CREATE INDEX IF NOT EXISTS idx_history_method ON history_entries(method);
      CREATE INDEX IF NOT EXISTS idx_history_url ON history_entries(url);

      CREATE TABLE IF NOT EXISTS history_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  /**
   * Returns current settings.
   */
  public getSettings(): HistorySettings {
    try {
      const rows = this.db.prepare('SELECT key, value FROM history_settings').all() as Array<{
        key: string;
        value: string;
      }>;
      const settings: HistorySettings = { ...DEFAULT_SETTINGS };

      for (const row of rows) {
        if (row.key === 'enabled') {
          settings.enabled = row.value === 'true';
        } else if (row.key === 'maxEntries') {
          const num = parseInt(row.value, 10);
          if (!isNaN(num) && num > 0) settings.maxEntries = num;
        } else if (row.key === 'retentionDays') {
          const num = parseInt(row.value, 10);
          if (!isNaN(num) && num > 0) settings.retentionDays = num;
        }
      }

      return settings;
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * Updates settings.
   */
  public updateSettings(partial: Partial<HistorySettings>): HistorySettings {
    const current = this.getSettings();
    const updated: HistorySettings = { ...current, ...partial };

    const upsertStmt = this.db.prepare(
      'INSERT INTO history_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    );

    const updateTx = this.db.transaction(() => {
      if (partial.enabled !== undefined) {
        upsertStmt.run('enabled', String(updated.enabled));
      }
      if (partial.maxEntries !== undefined) {
        upsertStmt.run('maxEntries', String(updated.maxEntries));
      }
      if (partial.retentionDays !== undefined) {
        upsertStmt.run('retentionDays', String(updated.retentionDays));
      }
    });

    updateTx();
    return updated;
  }

  /**
   * Pre-serialization masking for security & privacy.
   */
  public maskSecrets(text: string, knownSecrets: string[] = []): string {
    if (!text) return text;
    let sanitized = text;

    // Mask exact known secrets (filter empty strings)
    for (const secret of knownSecrets) {
      if (secret && secret.length > 0) {
        sanitized = sanitized.split(secret).join('[REDACTED]');
      }
    }

    // Mask Bearer tokens
    sanitized = sanitized.replace(
      /Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/gi,
      'Bearer [REDACTED]',
    );

    // Mask common token patterns (GitHub, Stripe, generic long hex/base64 secrets)
    sanitized = sanitized.replace(/ghp_[A-Za-z0-9]{36}/g, '[REDACTED]');
    sanitized = sanitized.replace(/sk_live_[A-Za-z0-9]{24,}/g, '[REDACTED]');

    return sanitized;
  }

  private sanitizeHeaders(
    headers?: Array<{ name: string; value: string; enabled?: boolean }>,
    knownSecrets: string[] = [],
  ): Array<{ name: string; value: string; enabled?: boolean }> | undefined {
    if (!headers) return undefined;
    return headers.map(h => {
      const isSensitive = SENSITIVE_HEADER_REGEX.test(h.name);
      return {
        ...h,
        value: isSensitive ? '[REDACTED]' : this.maskSecrets(h.value, knownSecrets),
      };
    });
  }

  private sanitizeParams(
    params?: Array<{ name: string; value: string; enabled?: boolean }>,
    knownSecrets: string[] = [],
  ): Array<{ name: string; value: string; enabled?: boolean }> | undefined {
    if (!params) return undefined;
    return params.map(p => {
      const isSensitive = SENSITIVE_PARAM_REGEX.test(p.name);
      return {
        ...p,
        value: isSensitive ? '[REDACTED]' : this.maskSecrets(p.value, knownSecrets),
      };
    });
  }

  private sanitizeAuth(
    auth?: Record<string, unknown>,
    knownSecrets: string[] = [],
  ): Record<string, unknown> | undefined {
    if (!auth) return undefined;
    const sanitized = JSON.parse(JSON.stringify(auth)) as Record<string, unknown>;

    if (sanitized.bearer && typeof sanitized.bearer === 'object') {
      (sanitized.bearer as Record<string, unknown>).token = '[REDACTED]';
    }
    if (sanitized.basic && typeof sanitized.basic === 'object') {
      (sanitized.basic as Record<string, unknown>).password = '[REDACTED]';
    }
    if (sanitized.apiKey && typeof sanitized.apiKey === 'object') {
      (sanitized.apiKey as Record<string, unknown>).value = '[REDACTED]';
    }
    if (sanitized.oauth2 && typeof sanitized.oauth2 === 'object') {
      (sanitized.oauth2 as Record<string, unknown>).clientSecret = '[REDACTED]';
      (sanitized.oauth2 as Record<string, unknown>).token = '[REDACTED]';
    }

    // Mask any remaining known secrets in string fields
    return JSON.parse(this.maskSecrets(JSON.stringify(sanitized), knownSecrets));
  }

  /**
   * Adds a history entry. Pre-serialization masks secrets, caps response body,
   * respects settings, and triggers async pruning.
   */
  public addEntry(params: AddHistoryEntryParams): HistoryEntrySummary | null {
    const settings = this.getSettings();
    // 3. Security & Privacy: Respect disable toggle immediately
    if (!settings.enabled) {
      return null;
    }

    const {
      request,
      resolvedUrl,
      collectionPath,
      result,
      error,
      durationMs,
      knownSecrets = [],
    } = params;

    const id = `hist-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = Date.now();
    const requestName = request.name || 'Untitled Request';
    const method = request.method;
    const displayUrl = this.maskSecrets(resolvedUrl || request.url, knownSecrets);

    const isError = Boolean(error || (result && result.status >= 400));
    const status = result?.status;
    const statusText = result?.statusText;
    const duration = durationMs ?? result?.totalMs;
    const sizeBytes = result?.sizeBytes;
    const errorMessage =
      error instanceof Error ? error.message : typeof error === 'string' ? error : undefined;

    const formRows = Array.isArray(request.body?.form)
      ? (request.body?.form as Array<{ name: string; value: string; enabled?: boolean }>)
      : undefined;

    // Request summary (pre-serialization sanitized)
    const requestSummary = {
      name: requestName,
      method: request.method,
      url: displayUrl,
      headers: this.sanitizeHeaders(request.headers, knownSecrets),
      params: this.sanitizeParams(request.params, knownSecrets),
      auth: this.sanitizeAuth(request.auth as Record<string, unknown> | undefined, knownSecrets),
      bodyType: request.body?.type,
      bodyContent:
        typeof request.body?.content === 'string'
          ? this.maskSecrets(request.body.content, knownSecrets)
          : formRows
            ? formRows
                .filter(r => r.enabled !== false)
                .map(r => `${r.name}=${this.maskSecrets(r.value, knownSecrets)}`)
                .join('&')
            : undefined,
      bodyForm: this.sanitizeParams(formRows, knownSecrets),
    };
    const requestSummaryJson = JSON.stringify(requestSummary);

    // Response headers (pre-serialization sanitized)
    let responseHeadersJson: string | null = null;
    if (result?.headers) {
      const sanitizedRespHeaders: Record<string, string> = {};
      for (const h of result.headers) {
        const isSensitive = SENSITIVE_HEADER_REGEX.test(h.name);
        sanitizedRespHeaders[h.name] = isSensitive
          ? '[REDACTED]'
          : this.maskSecrets(h.value, knownSecrets);
      }
      responseHeadersJson = JSON.stringify(sanitizedRespHeaders);
    }

    // Response body (pre-serialization capped at 1 MB)
    let responseBody: string | null = null;
    if (result?.body !== undefined) {
      let rawBody = result.body;
      if (rawBody.length > MAX_BODY_BYTES) {
        rawBody = rawBody.slice(0, MAX_BODY_BYTES) + TRUNCATION_NOTICE;
      }
      responseBody = this.maskSecrets(rawBody, knownSecrets);
    }

    const insertStmt = this.db.prepare(`
      INSERT INTO history_entries (
        id,
        timestamp,
        collection_path,
        request_name,
        method,
        url,
        status,
        status_text,
        duration_ms,
        size_bytes,
        is_error,
        request_summary_json,
        response_headers_json,
        response_body,
        error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
      id,
      timestamp,
      collectionPath || null,
      requestName,
      method,
      displayUrl,
      status ?? null,
      statusText ?? null,
      duration ?? null,
      sizeBytes ?? null,
      isError ? 1 : 0,
      requestSummaryJson,
      responseHeadersJson,
      responseBody,
      errorMessage || null,
    );

    // 2. Data Size Management: Asynchronous Pruning via setImmediate
    setImmediate(() => {
      try {
        this.pruneOldEntries();
      } catch (pruneErr) {
        console.error('History pruning failed:', pruneErr);
      }
    });

    return {
      id,
      timestamp,
      collectionPath,
      requestName,
      method,
      url: displayUrl,
      status,
      statusText,
      durationMs: duration,
      sizeBytes,
      isError,
    };
  }

  /**
   * Asynchronous pruning: deletes entries older than retentionDays or exceeding maxEntries.
   */
  public pruneOldEntries(): void {
    if (!this.db || !this.db.open) {
      return;
    }
    const settings = this.getSettings();
    const cutoffTimestamp = Date.now() - settings.retentionDays * 24 * 60 * 60 * 1000;

    const pruneTx = this.db.transaction(() => {
      // 1. Delete older than retention days
      this.db.prepare('DELETE FROM history_entries WHERE timestamp < ?').run(cutoffTimestamp);

      // 2. Delete entries exceeding maxEntries
      this.db
        .prepare(
          `
          DELETE FROM history_entries
          WHERE id IN (
            SELECT id FROM history_entries
            ORDER BY timestamp DESC, rowid_seq DESC
            LIMIT -1 OFFSET ?
          )
        `,
        )
        .run(settings.maxEntries);
    });

    pruneTx();
  }

  /**
   * Lazy-loads lightweight list summaries with search and status filtering.
   */
  public listEntries(filter?: HistoryListFilter): {
    entries: HistoryEntrySummary[];
    total: number;
  } {
    const { query, statusFilter = 'all', limit = 100, offset = 0 } = filter || {};

    const whereClauses: string[] = [];
    const params: unknown[] = [];

    // Filter by query (matches request_name or url)
    if (query && query.trim()) {
      whereClauses.push('(request_name LIKE ? OR url LIKE ?)');
      const wild = `%${query.trim()}%`;
      params.push(wild, wild);
    }

    // Filter by status
    if (statusFilter === '2xx') {
      whereClauses.push('(status >= 200 AND status < 300)');
    } else if (statusFilter === '4xx') {
      whereClauses.push('(status >= 400 AND status < 500)');
    } else if (statusFilter === '5xx') {
      whereClauses.push('(status >= 500 AND status < 600)');
    } else if (statusFilter === 'error') {
      whereClauses.push('(is_error = 1 OR status >= 400)');
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Count query
    const countSql = `SELECT COUNT(*) AS total FROM history_entries ${whereSql}`;
    const countRow = this.db.prepare(countSql).get(...params) as { total: number };
    const total = countRow?.total ?? 0;

    // List query (only lightweight summary columns; lazy loads payload!)
    const selectSql = `
      SELECT
        id,
        timestamp,
        collection_path AS collectionPath,
        request_name AS requestName,
        method,
        url,
        status,
        status_text AS statusText,
        duration_ms AS durationMs,
        size_bytes AS sizeBytes,
        is_error AS isError
      FROM history_entries
      ${whereSql}
      ORDER BY timestamp DESC, rowid_seq DESC
      LIMIT ? OFFSET ?
    `;

    const rows = this.db.prepare(selectSql).all(...params, limit, offset) as Array<{
      id: string;
      timestamp: number;
      collectionPath: string | null;
      requestName: string;
      method: string;
      url: string;
      status: number | null;
      statusText: string | null;
      durationMs: number | null;
      sizeBytes: number | null;
      isError: number;
    }>;

    const entries: HistoryEntrySummary[] = rows.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      collectionPath: r.collectionPath ?? undefined,
      requestName: r.requestName,
      method: r.method as HttpMethod,
      url: r.url,
      status: r.status ?? undefined,
      statusText: r.statusText ?? undefined,
      durationMs: r.durationMs ?? undefined,
      sizeBytes: r.sizeBytes ?? undefined,
      isError: r.isError === 1,
    }));

    return { entries, total };
  }

  /**
   * Fetches full detail for a single entry on demand (lazy loading).
   */
  public getEntryById(id: string): HistoryEntryDetail | null {
    const selectSql = `
      SELECT
        id,
        timestamp,
        collection_path AS collectionPath,
        request_name AS requestName,
        method,
        url,
        status,
        status_text AS statusText,
        duration_ms AS durationMs,
        size_bytes AS sizeBytes,
        is_error AS isError,
        request_summary_json AS requestSummaryJson,
        response_headers_json AS responseHeadersJson,
        response_body AS responseBody,
        error_message AS errorMessage
      FROM history_entries
      WHERE id = ?
    `;

    const row = this.db.prepare(selectSql).get(id) as
      | {
          id: string;
          timestamp: number;
          collectionPath: string | null;
          requestName: string;
          method: string;
          url: string;
          status: number | null;
          statusText: string | null;
          durationMs: number | null;
          sizeBytes: number | null;
          isError: number;
          requestSummaryJson: string;
          responseHeadersJson: string | null;
          responseBody: string | null;
          errorMessage: string | null;
        }
      | undefined;

    if (!row) return null;

    let requestSummary = {
      name: row.requestName,
      method: row.method as HttpMethod,
      url: row.url,
    };
    try {
      if (row.requestSummaryJson) {
        requestSummary = JSON.parse(row.requestSummaryJson);
      }
    } catch {
      // keep fallback
    }

    let responseHeaders: Record<string, string> | undefined = undefined;
    try {
      if (row.responseHeadersJson) {
        responseHeaders = JSON.parse(row.responseHeadersJson);
      }
    } catch {
      // ignore
    }

    return {
      id: row.id,
      timestamp: row.timestamp,
      collectionPath: row.collectionPath ?? undefined,
      requestName: row.requestName,
      method: row.method as HttpMethod,
      url: row.url,
      status: row.status ?? undefined,
      statusText: row.statusText ?? undefined,
      durationMs: row.durationMs ?? undefined,
      sizeBytes: row.sizeBytes ?? undefined,
      isError: row.isError === 1,
      requestSummary,
      responseHeaders,
      responseBody: row.responseBody ?? undefined,
      errorMessage: row.errorMessage ?? undefined,
    };
  }

  /**
   * Deletes a single entry by id.
   */
  public deleteEntry(id: string): boolean {
    const res = this.db.prepare('DELETE FROM history_entries WHERE id = ?').run(id);
    return res.changes > 0;
  }

  /**
   * Clears all history entries.
   */
  public clearHistory(): boolean {
    this.db.prepare('DELETE FROM history_entries').run();
    return true;
  }

  /**
   * Closes the database connection.
   */
  public close(): void {
    try {
      this.db.close();
    } catch {
      // ignore
    }
  }
}

export const historyService = new HistoryService();
