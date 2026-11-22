/**
 * Fetches an OpenAPI / Swagger specification from a remote HTTP or HTTPS URL.
 */
export async function fetchSpecFromUrl(url: string, timeoutMs: number = 15000): Promise<string> {
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    throw new Error(`Invalid URL scheme: "${url}". Only http:// and https:// URLs are supported.`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(trimmed, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json, application/yaml, text/yaml, text/plain, */*',
        'User-Agent': 'Reqit-OpenAPI-Importer/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch specification from URL (HTTP ${response.status} ${response.statusText}): ${url}`,
      );
    }

    const content = await response.text();
    if (!content.trim()) {
      throw new Error(`Specification fetched from URL is empty: ${url}`);
    }

    return content;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms while fetching: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
