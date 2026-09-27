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
import { AxiosError, AxiosHeaders } from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

import {
  checkProblemDetailsResponse,
  rejectProblemDetails,
} from './problem-details';

export type TypewriterSchema<T = unknown> = SchemaDescriptor<T>;

/**
 * Per-request Typewriter settings, stored under `config.typewriter`. The names
 * match the Fetch and Angular adapters.
 */
export interface TypewriterAxiosConfig {
  /** Serializes `config.data` before the request is sent. */
  readonly requestSchema?: TypewriterSchema;
  /** Hydrates `response.data`. */
  readonly responseSchema?: TypewriterSchema;
  /** Registry used in both directions unless a direction-specific one is set. */
  readonly registry?: JsonTransformerRegistry;
  readonly requestRegistry?: JsonTransformerRegistry;
  readonly responseRegistry?: JsonTransformerRegistry;
  /** Serialization options. Strict unless `strict: false` is passed. */
  readonly serializeOptions?: JsonSerializerOptions;
  /** Hydration options. Strict unless `strict: false` is passed. */
  readonly transformOptions?: JsonTransformerOptions;
}

declare module 'axios' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  interface AxiosRequestConfig<D = any> {
    typewriter?: TypewriterAxiosConfig;
    /** @deprecated Use `typewriter.responseSchema`. */
    responseSchema?: TypewriterSchema;
    /** @deprecated Use `typewriter.responseRegistry` or `typewriter.registry`. */
    responseSchemaRegistry?: JsonTransformerRegistry;
    /** @deprecated Use `typewriter.transformOptions`. */
    responseTransformOptions?: JsonTransformerOptions;
    /** @deprecated Use `typewriter.requestSchema`. */
    requestSchema?: TypewriterSchema;
    /** @deprecated Use `typewriter.requestRegistry` or `typewriter.registry`. */
    requestSchemaRegistry?: JsonTransformerRegistry;
    /** @deprecated Use `typewriter.serializeOptions`. */
    requestSerializeOptions?: JsonSerializerOptions;
  }
}

export interface TypewriterAxiosSchemas<T = unknown, D = unknown> {
  readonly requestSchema?: SchemaDescriptor<D>;
  readonly responseSchema?: SchemaDescriptor<T>;
}

const JSON_CONTENT_TYPE = /[/+]json\s*(?:;|$)/iu;

function requestSettings(config: AxiosRequestConfig) {
  const settings = config.typewriter;
  return {
    schema: settings?.requestSchema ?? config.requestSchema,
    registry:
      settings?.requestRegistry ??
      settings?.registry ??
      config.requestSchemaRegistry,
    options: withStrictDefault(
      settings?.serializeOptions ?? config.requestSerializeOptions,
    ),
  };
}

function responseSettings(config: AxiosRequestConfig) {
  const settings = config.typewriter;
  return {
    schema: settings?.responseSchema ?? config.responseSchema,
    registry:
      settings?.responseRegistry ??
      settings?.registry ??
      config.responseSchemaRegistry,
    options: withStrictDefault(
      settings?.transformOptions ?? config.responseTransformOptions,
    ),
  };
}

export function installTypewriterAxiosRequestInterceptor(
  instance: AxiosInstance,
): number {
  return instance.interceptors.request.use((config) => {
    const { schema, registry, options } = requestSettings(config);
    if (schema !== undefined && config.data !== undefined) {
      config.data = serializeJson(config.data, schema, registry, options);
    }

    return config;
  });
}

export function ejectTypewriterAxiosRequestInterceptor(
  instance: AxiosInstance,
  id: number,
): void {
  instance.interceptors.request.eject(id);
}

export function installTypewriterAxiosInterceptor(
  instance: AxiosInstance,
): number {
  return instance.interceptors.response.use((response) => {
    checkProblemDetailsResponse(response);
    const { schema, registry, options } = responseSettings(response.config);

    if (schema !== undefined && hasJsonBody(response)) {
      response.data = transformJson(response.data, schema, registry, options);
    }

    return response;
  }, rejectProblemDetails);
}

export function ejectTypewriterAxiosInterceptor(
  instance: AxiosInstance,
  id: number,
): void {
  instance.interceptors.response.eject(id);
}

/**
 * Sends a request with explicit request and/or response schemas. Install both
 * Typewriter interceptors on the instance for the schemas to take effect.
 */
export function requestWithSchemas<T, D = unknown>(
  instance: AxiosInstance,
  schemas: TypewriterAxiosSchemas<T, D>,
  config: AxiosRequestConfig<D>,
): Promise<AxiosResponse<T, D>> {
  return instance.request<T, AxiosResponse<T, D>, D>({
    ...config,
    typewriter: {
      ...config.typewriter,
      requestSchema: schemas.requestSchema ?? config.typewriter?.requestSchema,
      responseSchema:
        schemas.responseSchema ?? config.typewriter?.responseSchema,
    },
  });
}

/** Sends a request whose response is hydrated with `responseSchema`. */
export function requestWithResponseSchema<T, D = unknown>(
  instance: AxiosInstance,
  responseSchema: SchemaDescriptor<T>,
  config: AxiosRequestConfig<D>,
): Promise<AxiosResponse<T, D>> {
  return requestWithSchemas<T, D>(instance, { responseSchema }, config);
}

/**
 * @deprecated Use `requestWithResponseSchema` (identical behavior) or
 * `requestWithSchemas` to also serialize the request body.
 */
export function requestWithSchema<T, D = unknown>(
  instance: AxiosInstance,
  schema: SchemaDescriptor<T>,
  config: AxiosRequestConfig<D>,
): Promise<AxiosResponse<T, D>> {
  return requestWithResponseSchema<T, D>(instance, schema, config);
}

function hasJsonBody(response: AxiosResponse): boolean {
  if (response.status === 204 || response.status === 205) {
    return false;
  }

  const responseType = response.config.responseType;
  if (responseType !== undefined && responseType !== 'json') {
    return false;
  }

  const data: unknown = response.data;
  if (data === undefined || data === null || isBinaryBody(data)) {
    return false;
  }
  if (typeof data !== 'string') {
    return true;
  }
  if (data.trim() === '') {
    return false;
  }

  // Axios leaves unparsable text as a string, which cannot be told apart from a
  // JSON string root without the content type.
  const contentType = String(
    AxiosHeaders.from(
      response.headers as Parameters<typeof AxiosHeaders.from>[0],
    ).get('content-type') ?? '',
  );
  if (contentType !== '' && !JSON_CONTENT_TYPE.test(contentType)) {
    throw new AxiosError(
      `Typewriter response schema expects JSON, but the response is "${contentType}" text`,
      AxiosError.ERR_BAD_RESPONSE,
      response.config,
      response.request,
      response,
    );
  }
  return true;
}

function isBinaryBody(data: unknown): boolean {
  return (
    data instanceof ArrayBuffer ||
    ArrayBuffer.isView(data) ||
    (typeof Blob === 'function' && data instanceof Blob)
  );
}
