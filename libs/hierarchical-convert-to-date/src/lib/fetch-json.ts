import {
  isProblemDetailsContentType,
  readProblemDetailsResponse,
  withProblemDetails,
} from '@adaskothebeast/hierarchical-convert-core';

import { hierarchicalConvertToDate } from './hierarchical-convert-to-date';

export interface FetchJsonOptions {
  readonly fetch?: typeof globalThis.fetch;
}

export class FetchJsonError extends Error {
  override readonly name = 'FetchJsonError';

  constructor(
    readonly status: number,
    readonly statusText: string,
    readonly response?: Response,
  ) {
    super(`HTTP request failed with status ${status} ${statusText}`.trim());
  }
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: FetchJsonOptions,
): Promise<T | undefined> {
  const response = await (options?.fetch ?? globalThis.fetch)(input, init);

  if (isProblemDetailsContentType(response.headers.get('content-type'))) {
    const { body, cause } = await readProblemDetailsResponse(response);
    const error = new FetchJsonError(
      response.status,
      response.statusText,
      response,
    );
    if (cause !== undefined) Object.assign(error, { cause });
    throw withProblemDetails(error, response.status, body);
  }

  if (!response.ok) {
    throw new FetchJsonError(response.status, response.statusText, response);
  }

  if (response.status === 204 || response.status === 205) {
    return undefined;
  }

  const text = await response.text();
  if (text.trim() === '') {
    return undefined;
  }
  const data: unknown = JSON.parse(text);
  hierarchicalConvertToDate(data);
  return data as T;
}
