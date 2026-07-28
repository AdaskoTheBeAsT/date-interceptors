import {
  serializeJson,
  transformJson,
} from '@adaskothebeast/typewriter-runtime';
import type {
  JsonSerializerOptions,
  JsonTransformerRegistry,
  JsonTransformerOptions,
  SchemaDescriptor,
} from '@adaskothebeast/typewriter-runtime';

export interface FetchJsonOptions {
  registry?: JsonTransformerRegistry;
  transformOptions?: JsonTransformerOptions;
  fetch?: typeof fetch;
}

export interface SerializeJsonBodyOptions {
  registry?: JsonTransformerRegistry;
  serializeOptions?: JsonSerializerOptions;
}

export class TypewriterFetchError extends Error {
  override readonly name = 'TypewriterFetchError';

  constructor(
    readonly status: number,
    readonly statusText: string,
  ) {
    super(`HTTP request failed with status ${status} ${statusText}`.trim());
  }
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  schema: SchemaDescriptor<T>,
  init?: RequestInit,
  options?: FetchJsonOptions,
): Promise<T> {
  const response = await (options?.fetch ?? globalThis.fetch)(input, init);

  if (!response.ok) {
    throw new TypewriterFetchError(response.status, response.statusText);
  }

  const json: unknown = await response.json();

  return transformJson<T>(
    json,
    schema,
    options?.registry,
    options?.transformOptions,
  );
}

export function serializeJsonBody<T>(
  value: T,
  schema: SchemaDescriptor<T>,
  options?: SerializeJsonBodyOptions,
): string {
  return JSON.stringify(
    serializeJson(
      value,
      schema,
      options?.registry,
      options?.serializeOptions,
    ),
  );
}
