/**
 * Parses CSV lines respecting RFC 4180 quotes and commas.
 */
function parseCsvRow(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let hasQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (char === '"') {
      hasQuotes = true;
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(hasQuotes ? current : current.trim());
      current = '';
      hasQuotes = false;
    } else {
      current += char;
    }
  }

  fields.push(hasQuotes ? current : current.trim());
  return fields;
}

/**
 * Parses raw CSV string into an array of objects where keys are derived from the header row.
 */
export function parseCsvData(csvText: string): Record<string, unknown>[] {
  const clean = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawLines = clean.split('\n').filter(line => line.trim().length > 0);

  if (rawLines.length === 0) {
    throw new Error('CSV content is empty or contains no lines.');
  }

  const headerLine = rawLines[0]!;
  const headers = parseCsvRow(headerLine).map(h => h.trim());

  if (headers.length === 0 || headers.every(h => h.length === 0)) {
    throw new Error('CSV file has invalid or missing header row.');
  }

  const rows: Record<string, unknown>[] = [];

  for (let i = 1; i < rawLines.length; i++) {
    const line = rawLines[i]!;
    const values = parseCsvRow(line);

    const rowObj: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j]!;
      if (!key) continue;
      rowObj[key] = values[j] !== undefined ? values[j]! : '';
    }

    rows.push(rowObj);
  }

  return rows;
}

/**
 * Parses raw JSON string into an array of row objects.
 */
export function parseJsonData(jsonText: string): Record<string, unknown>[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err: unknown) {
    throw new Error(`Invalid JSON data file: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (Array.isArray(parsed)) {
    const validObjects = parsed.filter(
      item => typeof item === 'object' && item !== null && !Array.isArray(item),
    ) as Record<string, unknown>[];

    if (validObjects.length !== parsed.length) {
      throw new Error('JSON data file must be an array of objects.');
    }
    return validObjects;
  }

  if (typeof parsed === 'object' && parsed !== null) {
    return [parsed as Record<string, unknown>];
  }

  throw new Error('JSON data file must be an array of row objects or a single object.');
}

/**
 * Parses CSV or JSON content based on filename or auto-detection.
 */
export function parseDataFileContent(
  content: string,
  filenameOrExt?: string,
): Record<string, unknown>[] {
  const ext = (filenameOrExt || '').toLowerCase();

  if (ext.endsWith('.json')) {
    return parseJsonData(content);
  }

  if (ext.endsWith('.csv')) {
    return parseCsvData(content);
  }

  // Auto-detect: if starts with [ or {, try JSON first
  const trimmed = content.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      return parseJsonData(content);
    } catch {
      // Fallback to CSV
    }
  }

  return parseCsvData(content);
}
