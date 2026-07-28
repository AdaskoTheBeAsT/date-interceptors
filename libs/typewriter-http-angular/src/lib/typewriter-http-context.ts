import { HttpContext, HttpContextToken } from '@angular/common/http';
import type {
  JsonSerializerOptions,
  JsonTransformerOptions,
  JsonTransformerRegistry,
} from '@adaskothebeast/typewriter-runtime';
import type { RuntimeSchema } from '@adaskothebeast/typewriter-schema';

export type TypewriterRequestSchema<T = unknown> = RuntimeSchema<T>;
export type TypewriterResponseSchema<T = unknown> = RuntimeSchema<T>;
export type TypewriterSchemaRegistry = JsonTransformerRegistry;
export type TypewriterSerializeOptions = JsonSerializerOptions;
export type TypewriterTransformOptions = JsonTransformerOptions;

export const TYPEWRITER_REQUEST_SCHEMA =
  new HttpContextToken<TypewriterRequestSchema | undefined>(() => undefined);

export const TYPEWRITER_RESPONSE_SCHEMA =
  new HttpContextToken<TypewriterResponseSchema | undefined>(() => undefined);

export const TYPEWRITER_SCHEMA_REGISTRY =
  new HttpContextToken<TypewriterSchemaRegistry | undefined>(() => undefined);

export const TYPEWRITER_TRANSFORM_OPTIONS =
  new HttpContextToken<TypewriterTransformOptions | undefined>(() => undefined);

export const TYPEWRITER_SERIALIZE_OPTIONS =
  new HttpContextToken<TypewriterSerializeOptions | undefined>(() => undefined);

export interface TypewriterRequestContextOptions {
  readonly context?: HttpContext;
  readonly registry?: TypewriterSchemaRegistry;
  readonly serializeOptions?: TypewriterSerializeOptions;
}

export interface TypewriterResponseContextOptions {
  readonly context?: HttpContext;
  readonly registry?: TypewriterSchemaRegistry;
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
    context.set(TYPEWRITER_SCHEMA_REGISTRY, options.registry);
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
    context.set(TYPEWRITER_SCHEMA_REGISTRY, options.registry);
  }

  if (options.transformOptions !== undefined) {
    context.set(TYPEWRITER_TRANSFORM_OPTIONS, options.transformOptions);
  }

  return context;
}
