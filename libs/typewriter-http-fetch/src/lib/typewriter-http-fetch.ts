import {
  isProblemDetailsContentType,
  readProblemDetailsResponse,
  withProblemDetails,
} from '@adaskothebeast/hierarchical-convert-core';
import {
  serializeJson,
  transformJson,
  withStrictDefault,
} from '@adaskothebeast/typewriter-runtime';
import type {
  JsonSerializerOptions,
  JsonTransformerOptions,
  JsonTransformerRegistry,
  SchemaDescriptor,
} from '@adaskothebeast/typewriter-runtime';

export interface FetchJsonOptions {
  /** Registry for response schema references and custom transformers. */
  registry?: JsonTransformerRegistry;
  /** Hydration options. Strict unless `strict: false` is passed. */
  transformOptions?: JsonTransformerOptions;
  fetch?: typeof fetch;
}

export interface SerializeJsonBodyOptions {
  /** Registry for request schema references and custom serializers. */
  registry?: JsonTransformerRegistry;
  /** Serialization options. Strict unless `strict: false` is passed. */
  serializeOptions?: JsonSerializerOptions;
}

export interface SendJsonSchemas<TRequest, TResponse> {
  readonly requestSchema: SchemaDescriptor<TRequest>;
  readonly responseSchema: SchemaDescriptor<TResponse>;
}

export interface SendJsonOptions extends FetchJsonOptions {
  /** Registry used in both directions unless a direction-specific one is set. */
  registry?: JsonTransformerRegistry;
  requestRegistry?: JsonTransformerRegistry;
  responseRegistry?: JsonTransformerRegistry;
  /** Serialization options. Strict unless `strict: false` is passed. */
  serializeOptions?: JsonSerializerOptions;
}

export class TypewriterFetchError extends Error {
  override readonly name: string = 'TypewriterFetchError';

  constructor(
    readonly status: number,
    readonly statusText: string,
    readonly response?: Response,
    message?: string,
    options?: ErrorOptions,
  ) {
    super(
      message ??
        `HTTP request failed with status ${status} ${statusText}`.trim(),
      options,
    );
  }
}

/**
 * A successful response whose nonempty body is not valid JSON. The body has
 * been read; its text is available as `body` and the `SyntaxError` as `cause`.
 */
export class TypewriterJsonParseError extends TypewriterFetchError {
  override readonly name: string = 'TypewriterJsonParseError';

  constructor(
    response: Response,
    readonly body: string,
    cause: unknown,
  ) {
    super(
      response.status,
      response.statusText,
      response,
      `Response body is not valid JSON (HTTP ${response.status})`,
      { cause },
    );
  }
}

const JSON_ACCEPT = 'application/json, application/problem+json';

export async function fetchJson<T>(
  input: RequestInfo | URL,
  schema: SchemaDescriptor<T>,
  init?: RequestInit,
  options?: FetchJsonOptions,
): Promise<T | undefined> {
  const response = await (options?.fetch ?? globalThis.fetch)(input, init);
  return readJsonResponse(
    response,
    schema,
    options?.registry,
    options?.transformOptions,
  );
}

/**
 * Serializes `body` with `requestSchema`, sends it as JSON, and hydrates the
 * response with `responseSchema`. `Content-Type` and `Accept` default to JSON
 * and the method defaults to `POST`; values in `init` take precedence.
 */
export async function sendJson<TRequest, TResponse>(
  input: RequestInfo | URL,
  body: TRequest,
  schemas: SendJsonSchemas<TRequest, TResponse>,
  init?: RequestInit,
  options?: SendJsonOptions,
): Promise<TResponse | undefined> {
  const request = input instanceof Request ? input : undefined;
  const headers = new Headers(init?.headers ?? request?.headers);
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  if (!headers.has('accept')) {
    headers.set('accept', JSON_ACCEPT);
  }

  const response = await (options?.fetch ?? globalThis.fetch)(input, {
    ...init,
    method: init?.method ?? request?.method ?? 'POST',
    headers,
    body: serializeJsonBody(body, schemas.requestSchema, {
      registry: options?.requestRegistry ?? options?.registry,
      serializeOptions: options?.serializeOptions,
    }),
  });
  return readJsonResponse(
    response,
    schemas.responseSchema,
    options?.responseRegistry ?? options?.registry,
    options?.transformOptions,
  );
}

export function serializeJsonBody<T>(
  value: T,
  schema: SchemaDescriptor<T>,
  options?: SerializeJsonBodyOptions,
): string {
  const body = JSON.stringify(
    serializeJson(
      value,
      schema,
      options?.registry,
      withStrictDefault(options?.serializeOptions),
    ),
  );
  if (body === undefined) {
    throw new TypeError('Cannot serialize an undefined JSON body');
  }
  return body;
}

async function readJsonResponse<T>(
  response: Response,
  schema: SchemaDescriptor<T>,
  registry: JsonTransformerRegistry | undefined,
  transformOptions: JsonTransformerOptions | undefined,
): Promise<T | undefined> {
  if (isProblemDetailsContentType(response.headers.get('content-type'))) {
    const { body, cause } = await readProblemDetailsResponse(response);
    const error = new TypewriterFetchError(
      response.status,
      response.statusText,
      response,
    );
    if (cause !== undefined) Object.assign(error, { cause });
    throw withProblemDetails(error, response.status, body);
  }

  if (!response.ok) {
    throw new TypewriterFetchError(
      response.status,
      response.statusText,
      response,
    );
  }

  if (response.status === 204 || response.status === 205) {
    return undefined;
  }
  const text = await response.text();
  if (text.trim() === '') {
    return undefined;
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new TypewriterJsonParseError(response, text, error);
  }

  return transformJson<T>(
    json,
    schema,
    registry,
    withStrictDefault(transformOptions),
  );
}
