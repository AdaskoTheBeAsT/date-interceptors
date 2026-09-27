import type {
  RuntimeSchema,
  SchemaRegistry,
} from '@adaskothebeast/typewriter-schema';
import Decimal from 'decimal.js';
import {
  parse as parseUuid,
  version as uuidVersion,
  validate as validateUuid,
} from 'uuid';

import { normalizeMaxDepth, resolveStrict } from './conversion-options';
import type { StrictnessOptions } from './conversion-options';
import type { DateBackend, DateSchemaKind } from './date-backend';
import {
  DANGEROUS_KEYS,
  isObjectLike,
  isRecordValue,
  lookupCustomCodec,
  normalizeSchema,
  resolveLazySchema,
  resolveNamedSchema,
} from './schema-descriptor';
import type { NormalizedSchema } from './schema-descriptor';
import { childPath, formatPath } from './schema-path';
import type { SchemaPath } from './schema-path';
import { SchemaRecursionGuard } from './schema-recursion';
import { temporalDateBackend } from './temporal-date-backend';
import type { RuntimeSerializerEntry } from './typewriter-serializer';

export type SchemaDescriptor<T = unknown> =
  | RuntimeSchema<T>
  | (Readonly<Record<string, unknown>> & {
      readonly kind: string;
      readonly '~type'?: T;
    });

/** A lazily created schema, for example a recursive registry entry. */
export type SchemaDescriptorFactory<T = unknown> = () => SchemaDescriptor<T>;

export type RuntimeTransformerFunction = (
  value: unknown,
  context: RuntimeTransformerContext,
) => unknown;

export interface RuntimeTransformer {
  transform: RuntimeTransformerFunction;
}

export type RuntimeTransformerEntry =
  RuntimeTransformer | RuntimeTransformerFunction;

export type RuntimeTransformerRegistry =
  | ReadonlyMap<string, RuntimeTransformerEntry>
  | Readonly<Record<string, RuntimeTransformerEntry>>;

/** A value stored under a name in a Map or plain-object registry. */
export type JsonRegistryEntry =
  | SchemaDescriptor
  | SchemaDescriptorFactory
  | RuntimeTransformerEntry
  | RuntimeSerializerEntry;

export type JsonRegistryCollection =
  | ReadonlyMap<string, JsonRegistryEntry>
  | Readonly<Record<string, JsonRegistryEntry>>;

/**
 * A registry object that resolves names through methods or named collections.
 * Bare functions are only treated as custom codecs when they come from the
 * codec-specific members (`transformers`, `serializers`, `adapters`,
 * `resolveTransformer`, `getTransformer`, `resolveSerializer`,
 * `getSerializer`).
 */
export interface JsonRegistryResolver {
  resolve?(typeName: string): unknown;
  resolveSchema?(typeName: string): unknown;
  getSchema?(typeName: string): unknown;
  get?(name: string): unknown;
  resolveTransformer?(name: string): unknown;
  getTransformer?(name: string): unknown;
  resolveSerializer?(name: string): unknown;
  getSerializer?(name: string): unknown;
  readonly schemas?: JsonRegistryCollection;
  readonly references?: JsonRegistryCollection;
  readonly types?: JsonRegistryCollection;
  readonly transformers?: RuntimeTransformerRegistry;
  readonly serializers?:
    | ReadonlyMap<string, RuntimeSerializerEntry>
    | Readonly<Record<string, RuntimeSerializerEntry>>;
  readonly adapters?: JsonRegistryCollection;
}

export type JsonTransformerRegistry =
  SchemaRegistry | JsonRegistryCollection | JsonRegistryResolver;

export interface RuntimeTransformerContext {
  /** JSON path of the value being transformed, for example `$.items[0]`. */
  readonly path: string;
  readonly schema: SchemaDescriptor;
  readonly options: unknown;
  /**
   * Transforms a nested value one level deeper. Pass `segment` (a property
   * name or array index) when the nested value lives below the current path.
   */
  transform(
    value: unknown,
    schema: SchemaDescriptor,
    segment?: string | number,
  ): unknown;
}

export interface JsonTransformerOptions extends StrictnessOptions {
  readonly maxDepth?: number;
  readonly dateBackend?: DateBackend;
  /** Custom transformers looked up by the `name` of a custom schema. */
  readonly transformers?: RuntimeTransformerRegistry;
  /** @deprecated Use `transformers`. */
  readonly customTransformers?: RuntimeTransformerRegistry;
  /**
   * @deprecated Use `transformers`. This option only holds custom
   * transformers and is unrelated to the positional schema registry argument.
   */
  readonly registry?: RuntimeTransformerRegistry;
}

export class JsonTransformationError extends Error {
  readonly path: string;
  readonly value: unknown;

  constructor(message: string, path: string, value: unknown, cause?: unknown) {
    super(`${message} at ${path}`, cause === undefined ? undefined : { cause });
    this.name = 'JsonTransformationError';
    this.path = path;
    this.value = value;
  }
}

type UnknownRecord = Record<string, unknown>;

interface TransformationState {
  readonly strict: boolean;
  readonly maxDepth: number;
  readonly registry: unknown;
  readonly dateBackend: DateBackend;
  readonly optionTransformers: readonly unknown[];
  readonly transformedPairs: WeakMap<object, WeakMap<object, unknown>>;
  readonly recursion: SchemaRecursionGuard;
  readonly resolvedSchemas: Map<string, unknown>;
}

export function transformJson<T>(
  value: unknown,
  schema: SchemaDescriptor<T>,
  registry?: JsonTransformerRegistry,
  options: JsonTransformerOptions = {},
): T {
  // Keep the deprecated option names available to existing callers.
  const legacyOptions = options as {
    readonly customTransformers?: RuntimeTransformerRegistry;
    readonly registry?: RuntimeTransformerRegistry;
  };
  const state: TransformationState = {
    strict: resolveStrict(options),
    maxDepth: normalizeMaxDepth(options.maxDepth),
    registry,
    dateBackend: options.dateBackend ?? temporalDateBackend,
    optionTransformers: [
      options.transformers,
      legacyOptions.customTransformers,
      legacyOptions.registry,
    ],
    transformedPairs: new WeakMap<object, WeakMap<object, unknown>>(),
    recursion: new SchemaRecursionGuard(),
    resolvedSchemas: new Map<string, unknown>(),
  };

  return transformValue(value, schema, undefined, 0, state) as T;
}

export function createJsonTransformer<T>(
  schema: SchemaDescriptor<T>,
  registry?: JsonTransformerRegistry,
  options?: JsonTransformerOptions,
): (value: unknown) => T {
  return (value: unknown): T =>
    transformJson<T>(value, schema, registry, options);
}

function transformValue(
  value: unknown,
  unresolvedSchema: unknown,
  path: SchemaPath,
  depth: number,
  state: TransformationState,
): unknown {
  if (depth > state.maxDepth) {
    return fail(
      `Maximum transformation depth of ${state.maxDepth} exceeded`,
      path,
      value,
      state,
    );
  }

  let schema: unknown;
  try {
    schema = resolveLazySchema(unresolvedSchema);
  } catch (error) {
    return fail('Unable to resolve schema', path, value, state, error);
  }

  const normalized = normalizeSchema(schema);
  if (!state.recursion.enter(schema, value, depth)) {
    return fail('Circular schema reference', path, value, state);
  }

  try {
    let pairs: WeakMap<object, unknown> | undefined;
    const descriptor = isObjectLike(schema) ? schema : undefined;
    if (descriptor !== undefined && isObjectLike(value)) {
      pairs = state.transformedPairs.get(value);
      if (pairs?.has(descriptor)) return pairs.get(descriptor);
      if (pairs === undefined) {
        pairs = new WeakMap<object, unknown>();
        state.transformedPairs.set(value, pairs);
      }
      // Containers are mutated in place; expose them while visiting data cycles.
      pairs.set(descriptor, value);
    }
    const result = transformNormalized(
      value,
      normalized,
      schema,
      path,
      depth,
      state,
    );
    if (descriptor !== undefined) pairs?.set(descriptor, result);
    return result;
  } finally {
    state.recursion.leave(schema, value, depth);
  }
}

function transformNormalized(
  value: unknown,
  normalized: NormalizedSchema,
  schema: unknown,
  path: SchemaPath,
  depth: number,
  state: TransformationState,
): unknown {
  switch (normalized.type) {
    case 'any':
      return value;
    case 'typeof':
      return typeof value === normalized.expected
        ? value
        : fail(`Expected ${normalized.expected}`, path, value, state);
    case 'null':
      return value === null ? value : fail('Expected null', path, value, state);
    case 'undefined':
      return value === undefined
        ? value
        : fail('Expected undefined', path, value, state);
    case 'literal':
      return transformLiteral(value, normalized, path, state);
    case 'decimal':
      return transformDecimal(value, normalized.wireType, path, state);
    case 'uuid':
      return transformUuid(value, normalized.versions, path, state);
    case 'date':
      return normalized.dateKind === undefined
        ? fail('Unknown Temporal type', path, value, state)
        : transformDate(value, normalized.dateKind, path, state);
    case 'nullable':
      return value === null
        ? value
        : transformValue(value, normalized.inner, path, depth, state);
    case 'optional':
      return value === undefined
        ? value
        : transformValue(value, normalized.inner, path, depth, state);
    case 'array':
      return transformArray(value, normalized.items, path, depth, state);
    case 'record':
      return transformRecord(value, normalized.values, path, depth, state);
    case 'object':
      return transformObject(value, normalized, path, depth, state);
    case 'reference':
      return transformReference(value, normalized, path, depth, state);
    case 'custom':
      return transformCustom(value, normalized, schema, path, depth, state);
    case 'union':
      return transformDiscriminatedUnion(value, normalized, path, depth, state);
    case 'invalid':
      return fail('Unknown schema descriptor', path, value, state);
  }
}

function transformLiteral(
  value: unknown,
  normalized: Extract<NormalizedSchema, { type: 'literal' }>,
  path: SchemaPath,
  state: TransformationState,
): unknown {
  if (!normalized.hasValue) {
    return fail('Literal schema is missing a value', path, value, state);
  }
  return Object.is(value, normalized.value)
    ? value
    : fail('Value does not match the literal schema', path, value, state);
}

function transformDecimal(
  value: unknown,
  wireType: 'number' | 'string',
  path: SchemaPath,
  state: TransformationState,
): unknown {
  if (Decimal.isDecimal(value)) {
    return value;
  }

  const validWireValue =
    wireType === 'number'
      ? typeof value === 'number' && Number.isFinite(value)
      : typeof value === 'string';
  if (!validWireValue) {
    return fail(
      wireType === 'number'
        ? 'Expected a finite decimal number'
        : 'Expected a decimal string',
      path,
      value,
      state,
    );
  }

  try {
    return new Decimal(value as string | number);
  } catch (error) {
    return fail('Invalid decimal value', path, value, state, error);
  }
}

function transformUuid(
  value: unknown,
  versions: ReadonlySet<number> | undefined,
  path: SchemaPath,
  state: TransformationState,
): unknown {
  if (value instanceof Uint8Array && value.byteLength === 16) {
    return value;
  }

  if (typeof value !== 'string' || !validateUuid(value)) {
    return fail('Invalid UUID value', path, value, state);
  }

  const actualVersion = uuidVersion(value);
  if (versions !== undefined && !versions.has(actualVersion)) {
    return fail(
      `UUID version ${actualVersion} is not allowed`,
      path,
      value,
      state,
    );
  }

  return parseUuid(value);
}

function transformDate(
  value: unknown,
  kind: DateSchemaKind,
  path: SchemaPath,
  state: TransformationState,
): unknown {
  const backend = state.dateBackend;
  const codec = backend.codecs[kind];
  if (codec === undefined) {
    return fail(
      `Date backend "${backend.name}" does not support ${kind}`,
      path,
      value,
      state,
    );
  }

  if (codec.is(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return fail(`Expected a ${kind} string`, path, value, state);
  }

  try {
    return codec.parse(value);
  } catch (error) {
    return fail(`Invalid ${kind} value`, path, value, state, error);
  }
}

function transformArray(
  value: unknown,
  elementSchema: unknown,
  path: SchemaPath,
  depth: number,
  state: TransformationState,
): unknown {
  if (!Array.isArray(value)) {
    return fail('Expected an array', path, value, state);
  }

  if (elementSchema === undefined) {
    return fail(
      'Array schema is missing its element schema',
      path,
      value,
      state,
    );
  }

  for (let index = 0; index < value.length; index += 1) {
    value[index] = transformValue(
      value[index],
      elementSchema,
      childPath(path, index),
      depth + 1,
      state,
    );
  }

  return value;
}

function transformRecord(
  value: unknown,
  valueSchema: unknown,
  path: SchemaPath,
  depth: number,
  state: TransformationState,
): unknown {
  if (!isRecordValue(value)) {
    return fail('Expected an object record', path, value, state);
  }

  if (valueSchema === undefined) {
    return fail(
      'Record schema is missing its value schema',
      path,
      value,
      state,
    );
  }

  for (const key of Object.keys(value)) {
    if (DANGEROUS_KEYS.has(key)) {
      continue;
    }

    value[key] = transformValue(
      value[key],
      valueSchema,
      childPath(path, key),
      depth + 1,
      state,
    );
  }

  return value;
}

function transformObject(
  value: unknown,
  normalized: Extract<NormalizedSchema, { type: 'object' }>,
  path: SchemaPath,
  depth: number,
  state: TransformationState,
): unknown {
  if (!isRecordValue(value)) {
    return fail('Expected an object', path, value, state);
  }

  const properties = normalized.properties;
  if (properties === undefined) {
    return fail('Object schema is missing its properties', path, value, state);
  }

  const updates: [string, unknown][] = [];
  const removals: string[] = [];
  for (const property of properties) {
    if (!Object.hasOwn(value, property.serializedName)) {
      if (state.strict) {
        transformValue(
          undefined,
          property.schema,
          childPath(path, property.serializedName),
          depth + 1,
          state,
        );
      }
      continue;
    }

    updates.push([
      property.name,
      transformValue(
        value[property.serializedName],
        property.schema,
        childPath(path, property.serializedName),
        depth + 1,
        state,
      ),
    ]);
    if (property.name !== property.serializedName) {
      removals.push(property.serializedName);
    }
  }

  for (const name of removals) {
    delete value[name];
  }
  for (const [name, transformed] of updates) {
    value[name] = transformed;
  }

  return value;
}

function transformReference(
  value: unknown,
  normalized: Extract<NormalizedSchema, { type: 'reference' }>,
  path: SchemaPath,
  depth: number,
  state: TransformationState,
): unknown {
  if (normalized.target !== undefined) {
    return transformValue(value, normalized.target, path, depth, state);
  }

  const name = normalized.name;
  if (name === undefined) {
    return fail('Reference schema is missing its name', path, value, state);
  }

  const referencedSchema = resolveNamedSchema(
    state.resolvedSchemas,
    state.registry,
    name,
  );
  if (referencedSchema === undefined) {
    return fail(`Schema reference "${name}" was not found`, path, value, state);
  }

  return transformValue(value, referencedSchema, path, depth, state);
}

function transformCustom(
  value: unknown,
  normalized: Extract<NormalizedSchema, { type: 'custom' }>,
  schema: unknown,
  path: SchemaPath,
  depth: number,
  state: TransformationState,
): unknown {
  const name = normalized.name;
  const transformer = (normalized.transformer ??
    (name === undefined
      ? undefined
      : lookupCustomCodec(
          name,
          state.optionTransformers,
          state.registry,
          'transform',
        ))) as RuntimeTransformerEntry | undefined;

  if (transformer === undefined) {
    return fail(
      name === undefined
        ? 'Custom schema is missing its transformer'
        : `Custom transformer "${name}" was not found`,
      path,
      value,
      state,
    );
  }

  const context: RuntimeTransformerContext = {
    get path(): string {
      return formatPath(path);
    },
    schema: schema as SchemaDescriptor,
    options: normalized.options,
    transform: (
      nestedValue: unknown,
      nestedSchema: SchemaDescriptor,
      segment?: string | number,
    ): unknown =>
      transformValue(
        nestedValue,
        nestedSchema,
        segment === undefined ? path : childPath(path, segment),
        depth + 1,
        state,
      ),
  };

  try {
    return typeof transformer === 'function'
      ? transformer(value, context)
      : transformer.transform(value, context);
  } catch (error) {
    if (error instanceof JsonTransformationError) {
      throw error;
    }

    return fail(
      name === undefined
        ? 'Custom transformer failed'
        : `Custom transformer "${name}" failed`,
      path,
      value,
      state,
      error,
    );
  }
}

function transformDiscriminatedUnion(
  value: unknown,
  normalized: Extract<NormalizedSchema, { type: 'union' }>,
  path: SchemaPath,
  depth: number,
  state: TransformationState,
): unknown {
  if (!isRecordValue(value)) {
    return fail(
      'Expected an object for a discriminated union',
      path,
      value,
      state,
    );
  }

  const discriminator = normalized.wireDiscriminator;
  if (discriminator === undefined || !Object.hasOwn(value, discriminator)) {
    return fail(
      'Discriminated union value is missing its discriminator',
      path,
      value,
      state,
    );
  }

  const discriminatorValue = (value as UnknownRecord)[discriminator];
  if (
    typeof discriminatorValue !== 'string' &&
    typeof discriminatorValue !== 'number'
  ) {
    return fail(
      'Discriminator must be a string or number',
      childPath(path, discriminator),
      discriminatorValue,
      state,
      undefined,
      value,
    );
  }

  const variant = normalized.variant(discriminatorValue);
  if (variant === undefined) {
    return fail(
      `No discriminated union variant for "${String(discriminatorValue)}"`,
      childPath(path, discriminator),
      discriminatorValue,
      state,
      undefined,
      value,
    );
  }

  return transformValue(value, variant, path, depth, state);
}

function fail(
  message: string,
  path: SchemaPath,
  value: unknown,
  state: TransformationState,
  cause?: unknown,
  preserved: unknown = value,
): unknown {
  if (state.strict) {
    throw new JsonTransformationError(message, formatPath(path), value, cause);
  }
  return preserved;
}
