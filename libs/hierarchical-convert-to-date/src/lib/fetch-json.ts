import { hierarchicalConvertToDate } from './hierarchical-convert-to-date';

export interface FetchJsonOptions {
  readonly fetch?: typeof globalThis.fetch;
}

export class FetchJsonError extends Error {
  override readonly name = 'FetchJsonError';

  constructor(
    readonly status: number,
    readonly statusText: string,
  ) {
    super(`HTTP request failed with status ${status} ${statusText}`.trim());
  }
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: FetchJsonOptions,
): Promise<T> {
  const response = await (options?.fetch ?? globalThis.fetch)(input, init);

  if (!response.ok) {
    throw new FetchJsonError(response.status, response.statusText);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data: unknown = await response.json();
  hierarchicalConvertToDate(data);
  return data as T;
}
