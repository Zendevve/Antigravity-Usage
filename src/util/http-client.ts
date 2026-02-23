import { z } from 'zod';

export class HttpClientError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'HttpClientError';
  }
}

export async function fetchWithTimeout<T>(
  url: string,
  schema: z.ZodType<T>,
  options: RequestInit = {},
  timeoutMs: number = 10000,
  retries: number = 2
): Promise<T | null> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal as RequestInit['signal'], // Node 20 fetch
    });

    if (!res.ok) {
      throw new HttpClientError(`HTTP ${res.status}`, res.status);
    }

    const data = await res.json();
    const result = schema.safeParse(data);

    if (!result.success) {
      throw new HttpClientError(`Validation failed: ${result.error.message}`);
    }

    return result.data;
  } catch (error) {
    if (retries > 0 && !(error instanceof Error && error.name === 'AbortError')) {
      const backoffMs = 500 * (3 - retries);
      await new Promise(r => setTimeout(r, backoffMs));
      return fetchWithTimeout(url, schema, options, timeoutMs, retries - 1);
    }
    return null;
  } finally {
    clearTimeout(id);
  }
}
