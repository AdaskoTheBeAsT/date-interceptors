import type {
  JsonSerializerOptions,
  JsonTransformerOptions,
  JsonTransformerRegistry,
  SchemaDescriptor,
} from '@adaskothebeast/typewriter-runtime';
import { HttpContext, HttpContextToken } from '@angular/common/http';

export type TypewriterRequestSchema<T = unknown> = SchemaDescriptor<T>;
export type TypewriterResponseSchema<T = unknown> = SchemaDescriptor<T>;
export type TypewriterSchemaRegistry = JsonTransformerRegistry;
export type TypewriterSerializeOptions = JsonSerializerOptions;
export type TypewriterTransformOptions = JsonTransformerOptions;

export const TYPEWRITER_REQUEST_SCHEMA = new HttpContextToken<
  TypewriterRequestSchema | undefined
>(() => undefined);

export const TYPEWRITER_RESPONSE_SCHEMA = new HttpContextToken<
  TypewriterResponseSchema | undefined
>(() => undefined);

/** Registry for both directions when no direction-specific registry is set. */
export const TYPEWRITER_SCHEMA_REGISTRY = new HttpContextToken<
  TypewriterSchemaRegistry | undefined
>(() => undefined);

export const TYPEWRITER_REQUEST_REGISTRY = new HttpContextToken<
  TypewriterSchemaRegistry | undefined
>(() => undefined);

export const TYPEWRITER_RESPONSE_REGISTRY = new HttpContextToken<
  TypewriterSchemaRegistry | undefined
>(() => undefined);

export const TYPEWRITER_TRANSFORM_OPTIONS = new HttpContextToken<
  TypewriterTransformOptions | undefined
>(() => undefined);

export const TYPEWRITER_SERIALIZE_OPTIONS = new HttpContextToken<
  TypewriterSerializeOptions | undefined
>(() => undefined);

export interface TypewriterRequestContextOptions {
  readonly context?: HttpContext;
  /** Registry for the request schema, stored in `TYPEWRITER_REQUEST_REGISTRY`. */
  readonly registry?: TypewriterSchemaRegistry;
  /** Serialization options. Strict unless `strict: false` is passed. */
  readonly serializeOptions?: TypewriterSerializeOptions;
}

export interface TypewriterResponseContextOptions {
  readonly context?: HttpContext;
  /** Registry for the response schema, stored in `TYPEWRITER_RESPONSE_REGISTRY`. */
  readonly registry?: TypewriterSchemaRegistry;
  /** Hydration options. Strict unless `strict: false` is passed. */
  readonly transformOptions?: TypewriterTransformOptions;
}

export function withTypewriterRequestSchema<T>(
  requestSchema: TypewriterRequestSchema<T>,
  options: TypewriterRequestContextOptions = {},
): HttpContext {
  const context = options.context ?? new HttpContext();

  context.set(
    TYPEWRITER_REQUEST_SCHEMA,
    requestSchema as TypewriterRequestSchema,
  );

  if (options.registry !== undefined) {
    context.set(TYPEWRITER_REQUEST_REGISTRY, options.registry);
  }

  if (options.serializeOptions !== undefined) {
    context.set(TYPEWRITER_SERIALIZE_OPTIONS, options.serializeOptions);
  }

  return context;
}

export function withTypewriterResponseSchema<T>(
  responseSchema: TypewriterResponseSchema<T>,
  options: TypewriterResponseContextOptions = {},
): HttpContext {
  const context = options.context ?? new HttpContext();

  context.set(
    TYPEWRITER_RESPONSE_SCHEMA,
    responseSchema as TypewriterResponseSchema,
  );

  if (options.registry !== undefined) {
    context.set(TYPEWRITER_RESPONSE_REGISTRY, options.registry);
  }

  if (options.transformOptions !== undefined) {
    context.set(TYPEWRITER_TRANSFORM_OPTIONS, options.transformOptions);
  }

  return context;
}
