import Decimal from 'decimal.js';
import {
  stringify as stringifyUuid,
  version as uuidVersion,
  validate as validateUuid,
} from 'uuid';

import { normalizeMaxDepth, resolveStrict } from './conversion-options';
import type { StrictnessOptions } from './conversion-options';
import type { DateBackend, DateSchemaKind } from './date-backend';
import {
  DANGEROUS_KEYS,
  isRecordValue,
  lookupCustomCodec,
  normalizeSchema,
  resolveLazySchema,
  resolveNamedSchema,
} from './schema-descriptor';
import type { NormalizedSchema, PropertyEntry } from './schema-descriptor';
import { childPath, formatPath } from './schema-path';
import type { SchemaPath } from './schema-path';
import { SchemaRecursionGuard } from './schema-recursion';
import { temporalDateBackend } from './temporal-date-backend';
import type {
  JsonTransformerRegistry,
  SchemaDescriptor,
} from './typewriter-runtime';

export type RuntimeSerializerFunction = (
  value: unknown,
  context: RuntimeSerializerContext,
) => unknown;

export interface RuntimeSerializer {
  serialize: RuntimeSerializerFunction;
}

export type RuntimeSerializerEntry =
  RuntimeSerializer | RuntimeSerializerFunction;

export type RuntimeSerializerRegistry =
  | ReadonlyMap<string, RuntimeSerializerEntry>
  | Readonly<Record<string, RuntimeSerializerEntry>>;

export interface RuntimeSerializerContext {
  /** JSON path of the value being serialized, for example `$.items[0]`. */
  readonly path: string;
  readonly schema: SchemaDescriptor;
  readonly options: unknown;
  /**
   * Serializes a nested value one level deeper. Pass `segment` (a property
   * name or array index) when the nested value lives below the current path.
   */
  serialize(
    value: unknown,
    schema: SchemaDescriptor,
    segment?: string | number,
  ): unknown;
}

export interface JsonSerializerOptions extends StrictnessOptions {
  readonly maxDepth?: number;
  readonly dateBackend?: DateBackend;
  /** Custom serializers looked up by the `name` of a custom schema. */
  readonly serializers?: RuntimeSerializerRegistry;
  /** @deprecated Use `serializers`. */
  readonly customSerializers?: RuntimeSerializerRegistry;
  /**
   * @deprecated Use `serializers`. This option only holds custom serializers
   * and is unrelated to the positional schema registry argument.
   */
  readonly registry?: RuntimeSerializerRegistry;
}

export class JsonSerializationError extends Error {
  readonly path: string;
  readonly value: unknown;

  constructor(message: string, path: string, value: unknown, cause?: unknown) {
    super(`${message} at ${path}`, cause === undefined ? undefined : { cause });
    this.name = 'JsonSerializationError';
    this.path = path;
    this.value = value;
  }
}

type UnknownRecord = Record<string, unknown>;

interface SerializationState {
  readonly strict: boolean;
  readonly maxDepth: number;
  readonly registry: JsonTransformerRegistry | undefined;
  readonly dateBackend: DateBackend;
  readonly optionSerializers: readonly unknown[];
  readonly serializedPairs: WeakMap<object, WeakMap<object, unknown>>;
  readonly resolvedSchemas: Map<string, unknown>;
  readonly recursion: SchemaRecursionGuard;
}

export function serializeJson<T>(
  value: T,
  schema: SchemaDescriptor<T>,
  registry?: JsonTransformerRegistry,
  options: JsonSerializerOptions = {},
): unknown {
  // Keep the deprecated option names available to existing callers.
  const legacyOptions = options as {
    readonly customSerializers?: RuntimeSerializerRegistry;
    readonly registry?: RuntimeSerializerRegistry;
  };
  const state: SerializationState = {
    strict: resolveStrict(options),
    maxDepth: normalizeMaxDepth(options.maxDepth),
    registry,
    dateBackend: options.dateBackend ?? temporalDateBackend,
    optionSerializers: [
      options.serializers,
      legacyOptions.customSerializers,
      legacyOptions.registry,
    ],
    serializedPairs: new WeakMap<object, WeakMap<object, unknown>>(),
    resolvedSchemas: new Map<string, unknown>(),
    recursion: new SchemaRecursionGuard(),
  };

  return serializeValue(value, schema, undefined, 0, state);
}

export function createJsonSerializer<T>(
  schema: SchemaDescriptor<T>,
  registry?: JsonTransformerRegistry,
  options?: JsonSerializerOptions,
): (value: T) => unknown {
  return (value: T): unknown => serializeJson(value, schema, registry, options);
}

function serializeValue(
  value: unknown,
  unresolvedSchema: unknown,
  path: SchemaPath,
  depth: number,
  state: SerializationState,
): unknown {
  if (depth > state.maxDepth) {
    return fail(
      `Maximum serialization depth of ${state.maxDepth} exceeded`,
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
    return serializeNormalized(value, normalized, schema, path, depth, state);
  } finally {
    state.recursion.leave(schema, value, depth);
  }
}

function serializeNormalized(
  value: unknown,
  normalized: NormalizedSchema,
  schema: unknown,
  path: SchemaPath,
  depth: number,
  state: SerializationState,
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
      return serializeLiteral(value, normalized, path, state);
    case 'decimal':
      return serializeDecimal(value, normalized.wireType, path, state);
    case 'uuid':
      return serializeUuid(value, normalized.versions, path, state);
    case 'date':
      return normalized.dateKind === undefined
        ? fail('Unknown Temporal type', path, value, state)
        : serializeDate(value, normalized.dateKind, path, state);
    case 'nullable':
      return value === null
        ? value
        : serializeValue(value, normalized.inner, path, depth, state);
    case 'optional':
      return value === undefined
        ? value
        : serializeValue(value, normalized.inner, path, depth, state);
    case 'array':
      return serializeArray(
        value,
        normalized.items,
        schema,
        path,
        depth,
        state,
      );
    case 'record':
      return serializeRecord(
        value,
        normalized.values,
        schema,
        path,
        depth,
        state,
      );
    case 'object':
      return serializeObject(value, normalized, schema, path, depth, state);
    case 'reference':
      return serializeReference(value, normalized, path, depth, state);
    case 'custom':
      return serializeCustom(value, normalized, schema, path, depth, state);
    case 'union':
      return serializeDiscriminatedUnion(value, normalized, path, depth, state);
    case 'invalid':
      return fail('Unknown schema descriptor', path, value, state);
  }
}

function serializeLiteral(
  value: unknown,
  normalized: Extract<NormalizedSchema, { type: 'literal' }>,
  path: SchemaPath,
  state: SerializationState,
): unknown {
  if (!normalized.hasValue) {
    return fail('Literal schema is missing a value', path, value, state);
  }
  return Object.is(value, normalized.value)
    ? value
    : fail('Value does not match the literal schema', path, value, state);
}

function serializeDecimal(
  value: unknown,
  wireType: 'number' | 'string',
  path: SchemaPath,
  state: SerializationState,
): unknown {
  if (Decimal.isDecimal(value)) {
    return wireType === 'number' ? value.toNumber() : value.toString();
  }

  if (
    wireType === 'number' &&
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (wireType === 'string' && typeof value === 'string') {
    try {
      return new Decimal(value).toString();
    } catch (error) {
      return fail('Invalid decimal value', path, value, state, error);
    }
  }

  return fail(
    wireType === 'number'
      ? 'Expected a Decimal or finite decimal number'
      : 'Expected a Decimal or decimal string',
    path,
    value,
    state,
  );
}

function serializeUuid(
  value: unknown,
  versions: ReadonlySet<number> | undefined,
  path: SchemaPath,
  state: SerializationState,
): unknown {
  let serialized: string | undefined;
  if (value instanceof Uint8Array) {
    try {
      serialized = stringifyUuid(value);
    } catch (error) {
      return fail('Invalid UUID value', path, value, state, error);
    }
  } else if (typeof value === 'string' && validateUuid(value)) {
    serialized = value;
  }

  if (serialized === undefined) {
    return fail('Invalid UUID value', path, value, state);
  }

  const actualVersion = uuidVersion(serialized);
  return versions === undefined || versions.has(actualVersion)
    ? serialized
    : fail(
        `UUID version ${actualVersion} is not allowed`,
        path,
        value,
        state,
        undefined,
        serialized,
      );
}

function serializeDate(
  value: unknown,
  kind: DateSchemaKind,
  path: SchemaPath,
  state: SerializationState,
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
    try {
      return codec.serialize(value);
    } catch (error) {
      return fail(`Invalid ${kind} value`, path, value, state, error);
    }
  }

  if (typeof value === 'string') {
    try {
      codec.parse(value);
      return value;
    } catch (error) {
      return fail(`Invalid ${kind} value`, path, value, state, error);
    }
  }

  return fail(`Expected a ${kind} value`, path, value, state);
}

function serializeArray(
  value: unknown,
  itemSchema: unknown,
  schema: unknown,
  path: SchemaPath,
  depth: number,
  state: SerializationState,
): unknown {
  if (!Array.isArray(value)) {
    return fail('Expected an array', path, value, state);
  }

  if (itemSchema === undefined) {
    return fail(
      'Array schema is missing its element schema',
      path,
      value,
      state,
    );
  }

  const cached = getSerializedPair(value, schema, state);
  if (cached !== undefined) {
    return cached;
  }

  const result: unknown[] = [];
  setSerializedPair(value, schema, result, state);
  for (let index = 0; index < value.length; index += 1) {
    result.push(
      serializeValue(
        value[index],
        itemSchema,
        childPath(path, index),
        depth + 1,
        state,
      ),
    );
  }
  return result;
}

function serializeRecord(
  value: unknown,
  valueSchema: unknown,
  schema: unknown,
  path: SchemaPath,
  depth: number,
  state: SerializationState,
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

  const cached = getSerializedPair(value, schema, state);
  if (cached !== undefined) {
    return cached;
  }

  const result: UnknownRecord = {};
  setSerializedPair(value, schema, result, state);
  for (const [key, item] of Object.entries(value)) {
    if (!DANGEROUS_KEYS.has(key)) {
      result[key] = serializeValue(
        item,
        valueSchema,
        childPath(path, key),
        depth + 1,
        state,
      );
    }
  }
  return result;
}

function serializeObject(
  value: unknown,
  normalized: Extract<NormalizedSchema, { type: 'object' }>,
  schema: unknown,
  path: SchemaPath,
  depth: number,
  state: SerializationState,
): unknown {
  if (!isRecordValue(value)) {
    return fail('Expected an object', path, value, state);
  }

  const properties = normalized.properties;
  if (properties === undefined) {
    return fail('Object schema is missing its properties', path, value, state);
  }

  const cached = getSerializedPair(value, schema, state);
  if (cached !== undefined) {
    return cached;
  }

  const result: UnknownRecord = {};
  setSerializedPair(value, schema, result, state);
  for (const [key, item] of Object.entries(value)) {
    if (!DANGEROUS_KEYS.has(key)) {
      result[key] = item;
    }
  }

  const { updates, removals } = serializePropertyUpdates(
    value,
    properties,
    normalized.modelNames,
    path,
    depth,
    state,
  );

  for (const name of removals) {
    delete result[name];
  }
  for (const [name, serialized] of updates) {
    result[name] = serialized;
  }

  return result;
}

function serializePropertyUpdates(
  value: UnknownRecord,
  properties: readonly PropertyEntry[],
  modelNames: ReadonlySet<string>,
  path: SchemaPath,
  depth: number,
  state: SerializationState,
): { updates: [string, unknown][]; removals: string[] } {
  const updates: [string, unknown][] = [];
  const removals: string[] = [];
  for (const property of properties) {
    const sourceName = sourcePropertyName(
      value,
      property,
      modelNames,
      state.strict,
    );
    if (sourceName === undefined) {
      if (state.strict) {
        serializeValue(
          undefined,
          property.schema,
          childPath(path, property.name),
          depth + 1,
          state,
        );
      }
      continue;
    }

    updates.push([
      property.serializedName,
      serializeValue(
        value[sourceName],
        property.schema,
        childPath(path, property.name),
        depth + 1,
        state,
      ),
    ]);
    if (property.name !== property.serializedName) {
      removals.push(property.name);
    }
  }
  return { updates, removals };
}

function sourcePropertyName(
  value: UnknownRecord,
  property: PropertyEntry,
  modelNames: ReadonlySet<string>,
  strict: boolean,
): string | undefined {
  if (Object.hasOwn(value, property.name)) return property.name;
  if (
    !strict &&
    !modelNames.has(property.serializedName) &&
    Object.hasOwn(value, property.serializedName)
  ) {
    return property.serializedName;
  }
  return undefined;
}

function serializeReference(
  value: unknown,
  normalized: Extract<NormalizedSchema, { type: 'reference' }>,
  path: SchemaPath,
  depth: number,
  state: SerializationState,
): unknown {
  if (normalized.target !== undefined) {
    return serializeValue(value, normalized.target, path, depth, state);
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
  return referencedSchema === undefined
    ? fail(`Schema reference "${name}" was not found`, path, value, state)
    : serializeValue(value, referencedSchema, path, depth, state);
}

function serializeCustom(
  value: unknown,
  normalized: Extract<NormalizedSchema, { type: 'custom' }>,
  schema: unknown,
  path: SchemaPath,
  depth: number,
  state: SerializationState,
): unknown {
  const name = normalized.name;
  const serializer = (normalized.serializer ??
    (name === undefined
      ? undefined
      : lookupCustomCodec(
          name,
          state.optionSerializers,
          state.registry,
          'serialize',
        ))) as RuntimeSerializerEntry | undefined;

  if (serializer === undefined) {
    return fail(
      name === undefined
        ? 'Custom schema is missing its serializer'
        : `Custom serializer "${name}" was not found`,
      path,
      value,
      state,
    );
  }

  const context: RuntimeSerializerContext = {
    get path(): string {
      return formatPath(path);
    },
    schema: schema as SchemaDescriptor,
    options: normalized.options,
    serialize: (
      nestedValue: unknown,
      nestedSchema: SchemaDescriptor,
      segment?: string | number,
    ): unknown =>
      serializeValue(
        nestedValue,
        nestedSchema,
        segment === undefined ? path : childPath(path, segment),
        depth + 1,
        state,
      ),
  };

  try {
    return typeof serializer === 'function'
      ? serializer(value, context)
      : serializer.serialize(value, context);
  } catch (error) {
    if (error instanceof JsonSerializationError) {
      throw error;
    }
    return fail(
      name === undefined
        ? 'Custom serializer failed'
        : `Custom serializer "${name}" failed`,
      path,
      value,
      state,
      error,
    );
  }
}

function serializeDiscriminatedUnion(
  value: unknown,
  normalized: Extract<NormalizedSchema, { type: 'union' }>,
  path: SchemaPath,
  depth: number,
  state: SerializationState,
): unknown {
  if (!isRecordValue(value)) {
    return fail(
      'Expected an object for a discriminated union',
      path,
      value,
      state,
    );
  }

  const discriminator = normalized.modelDiscriminator;
  if (discriminator === undefined || !Object.hasOwn(value, discriminator)) {
    return fail(
      'Discriminated union value is missing its discriminator',
      path,
      value,
      state,
    );
  }

  const discriminatorValue = value[discriminator];
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
  return variant === undefined
    ? fail(
        `No discriminated union variant for "${String(discriminatorValue)}"`,
        childPath(path, discriminator),
        discriminatorValue,
        state,
        undefined,
        value,
      )
    : serializeValue(value, variant, path, depth, state);
}

// Container schemas always come from descriptor objects: string shorthands
// have no element, value, or property schemas and fail before caching.
function getSerializedPair(
  value: object,
  schema: unknown,
  state: SerializationState,
): unknown {
  return state.serializedPairs.get(value)?.get(schema as object);
}

function setSerializedPair(
  value: object,
  schema: unknown,
  result: unknown,
  state: SerializationState,
): void {
  let schemas = state.serializedPairs.get(value);
  if (schemas === undefined) {
    schemas = new WeakMap<object, unknown>();
    state.serializedPairs.set(value, schemas);
  }
  schemas.set(schema as object, result);
}

function fail(
  message: string,
  path: SchemaPath,
  value: unknown,
  state: SerializationState,
  cause?: unknown,
  preserved: unknown = value,
): unknown {
  // Binary views would be emitted as {"0":...} by JSON.stringify, so they are
  // never preserved, even in tolerant mode.
  if (state.strict || ArrayBuffer.isView(preserved)) {
    throw new JsonSerializationError(message, formatPath(path), value, cause);
  }
  return preserved;
}
