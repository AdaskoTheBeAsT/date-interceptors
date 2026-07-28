import type {
  JsonTransformerRegistry,
  SchemaDescriptor,
} from './typewriter-runtime';
import Decimal from 'decimal.js';
import {
  stringify as stringifyUuid,
  validate as validateUuid,
  version as uuidVersion,
} from 'uuid';

import type { DateBackend, DateSchemaKind } from './date-backend';
import { temporalDateBackend } from './temporal-date-backend';

export type RuntimeSerializerFunction = (
  value: unknown,
  context: RuntimeSerializerContext,
) => unknown;

export interface RuntimeSerializer {
  serialize: RuntimeSerializerFunction;
}

export type RuntimeSerializerEntry =
  | RuntimeSerializer
  | RuntimeSerializerFunction;

export type RuntimeSerializerRegistry =
  | ReadonlyMap<string, RuntimeSerializerEntry>
  | Readonly<Record<string, RuntimeSerializerEntry>>;

export interface RuntimeSerializerContext {
  readonly path: string;
  readonly schema: SchemaDescriptor;
  readonly options: unknown;
  serialize(value: unknown, schema: SchemaDescriptor): unknown;
}

export interface JsonSerializerOptions {
  readonly mode?: 'strict' | 'tolerant';
  readonly strict?: boolean;
  readonly maxDepth?: number;
  readonly dateBackend?: DateBackend;
  readonly serializers?: RuntimeSerializerRegistry;
  readonly customSerializers?: RuntimeSerializerRegistry;
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
  readonly options: JsonSerializerOptions;
  readonly serializedPairs: WeakMap<object, WeakMap<object, unknown>>;
  readonly resolvedSchemas: Map<string, unknown>;
}

interface PropertyEntry {
  readonly name: string;
  readonly serializedName: string;
  readonly schema: unknown;
}

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const PASSTHROUGH_KINDS = new Set([
  'any',
  'bigint',
  'boolean',
  'never',
  'number',
  'objectprimitive',
  'primitive',
  'string',
  'symbol',
  'unknown',
]);

export function serializeJson<T>(
  value: T,
  schema: SchemaDescriptor<T>,
  registry?: JsonTransformerRegistry,
  options: JsonSerializerOptions = {},
): unknown {
  const state: SerializationState = {
    strict: options.strict ?? options.mode === 'strict',
    maxDepth: normalizeMaxDepth(options.maxDepth),
    registry,
    options,
    serializedPairs: new WeakMap<object, WeakMap<object, unknown>>(),
    resolvedSchemas: new Map<string, unknown>(),
  };

  return serializeValue(value, schema, '$', 0, state);
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
  path: string,
  depth: number,
  state: SerializationState,
): unknown {
  if (depth > state.maxDepth) {
    return failOrPreserve(
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
    return failOrPreserve(
      'Unable to resolve schema',
      path,
      value,
      state,
      error,
    );
  }

  const descriptor = asRecord(schema);
  const kind =
    descriptor === undefined
      ? normalizeKind(typeof schema === 'string' ? schema : '')
      : descriptorKind(descriptor);

  if (PASSTHROUGH_KINDS.has(kind)) {
    return serializePrimitive(value, descriptor, kind, path, state);
  }

  switch (kind) {
    case 'null':
      return value === null
        ? value
        : failOrPreserve('Expected null', path, value, state);
    case 'undefined':
    case 'void':
      return value === undefined
        ? value
        : failOrPreserve('Expected undefined', path, value, state);
    case 'literal':
      return serializeLiteral(value, descriptor, path, state);
    case 'decimal':
    case 'decimaljs':
      return serializeDecimal(value, descriptor, path, state);
    case 'uuid':
    case 'uuidbytes':
      return serializeUuid(value, descriptor, path, state);
    case 'instant':
    case 'temporalinstant':
      return serializeDate(value, 'instant', path, state);
    case 'plaindate':
    case 'temporalplaindate':
      return serializeDate(value, 'plain-date', path, state);
    case 'plaindatetime':
    case 'temporalplaindatetime':
      return serializeDate(value, 'plain-date-time', path, state);
    case 'plainmonthday':
    case 'temporalplainmonthday':
      return serializeDate(value, 'plain-month-day', path, state);
    case 'plaintime':
    case 'temporalplaintime':
      return serializeDate(value, 'plain-time', path, state);
    case 'plainyearmonth':
    case 'temporalplainyearmonth':
      return serializeDate(value, 'plain-year-month', path, state);
    case 'zoneddatetime':
    case 'temporalzoneddatetime':
      return serializeDate(value, 'zoned-date-time', path, state);
    case 'duration':
    case 'temporalduration':
      return serializeDate(value, 'duration', path, state);
    case 'period':
    case 'temporalperiod':
      return serializeDate(value, 'period', path, state);
    case 'temporal':
      return serializeNamedDate(value, descriptor, path, state);
    case 'nullable':
      return value === null
        ? value
        : serializeValue(value, innerSchema(descriptor), path, depth, state);
    case 'optional':
      return value === undefined
        ? value
        : serializeValue(value, innerSchema(descriptor), path, depth, state);
    case 'array':
    case 'list':
      return serializeArray(value, descriptor, path, depth, state);
    case 'dictionary':
    case 'record':
      return serializeRecord(value, descriptor, path, depth, state);
    case 'object':
    case 'struct':
      return serializeObject(value, descriptor, path, depth, state);
    case 'ref':
    case 'reference':
      return serializeReference(value, descriptor, path, depth, state);
    case 'adapter':
    case 'custom':
      return serializeCustom(value, descriptor, path, depth, state);
    case 'discriminatedunion':
    case 'taggedunion':
      return serializeDiscriminatedUnion(
        value,
        descriptor,
        path,
        depth,
        state,
      );
    default:
      return failOrPreserve('Unknown schema descriptor', path, value, state);
  }
}

function serializePrimitive(
  value: unknown,
  descriptor: UnknownRecord | undefined,
  kind: string,
  path: string,
  state: SerializationState,
): unknown {
  if (descriptor === undefined) {
    return value;
  }

  const primitiveName =
    firstString(
      descriptor['primitive'],
      descriptor['name'],
      descriptor['valueType'],
    ) ?? kind;
  const normalized = normalizeKind(primitiveName);
  if (
    normalized === 'any' ||
    normalized === 'unknown' ||
    normalized === 'object'
  ) {
    return value;
  }

  return typeof value === normalized
    ? value
    : failOrPreserve(`Expected ${normalized}`, path, value, state);
}

function serializeLiteral(
  value: unknown,
  descriptor: UnknownRecord | undefined,
  path: string,
  state: SerializationState,
): unknown {
  if (descriptor === undefined || !Object.hasOwn(descriptor, 'value')) {
    return failOrPreserve(
      'Literal schema is missing a value',
      path,
      value,
      state,
    );
  }

  return Object.is(value, descriptor['value'])
    ? value
    : failOrPreserve(
        'Value does not match the literal schema',
        path,
        value,
        state,
      );
}

function serializeDecimal(
  value: unknown,
  descriptor: UnknownRecord | undefined,
  path: string,
  state: SerializationState,
): unknown {
  const wireType = descriptor?.['wireType'];
  if (Decimal.isDecimal(value)) {
    return wireType === 'number' ? value.toNumber() : value.toString();
  }

  if (wireType === 'number' && typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (wireType !== 'number' && typeof value === 'string') {
    try {
      return new Decimal(value).toString();
    } catch (error) {
      return failOrPreserve(
        'Invalid decimal value',
        path,
        value,
        state,
        error,
      );
    }
  }

  return failOrPreserve(
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
  descriptor: UnknownRecord | undefined,
  path: string,
  state: SerializationState,
): unknown {
  let serialized: string;
  try {
    serialized =
      value instanceof Uint8Array && value.byteLength === 16
        ? stringifyUuid(value)
        : typeof value === 'string' && validateUuid(value)
          ? value
          : '';
  } catch (error) {
    return failOrPreserve('Invalid UUID value', path, value, state, error);
  }

  if (serialized === '') {
    return failOrPreserve('Invalid UUID value', path, value, state);
  }

  const versions = allowedUuidVersions(descriptor);
  const actualVersion = uuidVersion(serialized);
  return versions === undefined || versions.has(actualVersion)
    ? serialized
    : failOrPreserve(
        `UUID version ${actualVersion} is not allowed`,
        path,
        value,
        state,
      );
}

function serializeDate(
  value: unknown,
  kind: DateSchemaKind,
  path: string,
  state: SerializationState,
): unknown {
  const backend = state.options.dateBackend ?? temporalDateBackend;
  const codec = backend.codecs[kind];
  if (codec === undefined) {
    return failOrPreserve(
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
      return failOrPreserve(
        `Invalid ${kind} value`,
        path,
        value,
        state,
        error,
      );
    }
  }

  if (typeof value === 'string') {
    try {
      codec.parse(value);
      return value;
    } catch (error) {
      return failOrPreserve(
        `Invalid ${kind} value`,
        path,
        value,
        state,
        error,
      );
    }
  }

  return failOrPreserve(`Expected a ${kind} value`, path, value, state);
}

function serializeNamedDate(
  value: unknown,
  descriptor: UnknownRecord | undefined,
  path: string,
  state: SerializationState,
): unknown {
  const dateName = normalizeKind(
    firstString(
      descriptor?.['temporalType'],
      descriptor?.['type'],
      descriptor?.['name'],
      descriptor?.['valueType'],
    ) ?? '',
  );

  const kind = namedDateKind(dateName);
  return kind === undefined
    ? failOrPreserve('Unknown date type', path, value, state)
    : serializeDate(value, kind, path, state);
}

function namedDateKind(value: string): DateSchemaKind | undefined {
  switch (value) {
    case 'instant':
      return 'instant';
    case 'plaindate':
      return 'plain-date';
    case 'plaintime':
      return 'plain-time';
    case 'plaindatetime':
      return 'plain-date-time';
    case 'zoneddatetime':
      return 'zoned-date-time';
    case 'duration':
      return 'duration';
    case 'period':
      return 'period';
    case 'plainyearmonth':
      return 'plain-year-month';
    case 'plainmonthday':
      return 'plain-month-day';
    default:
      return undefined;
  }
}

function serializeArray(
  value: unknown,
  descriptor: UnknownRecord | undefined,
  path: string,
  depth: number,
  state: SerializationState,
): unknown {
  if (!Array.isArray(value)) {
    return failOrPreserve('Expected an array', path, value, state);
  }

  const itemSchema = firstDefined(
    descriptor?.['element'],
    descriptor?.['elementType'],
    descriptor?.['items'],
    descriptor?.['item'],
    descriptor?.['of'],
  );
  if (itemSchema === undefined) {
    return failOrPreserve(
      'Array schema is missing its element schema',
      path,
      value,
      state,
    );
  }

  const cached = getSerializedPair(value, descriptor, state);
  if (cached !== undefined) {
    return cached;
  }

  const result: unknown[] = [];
  setSerializedPair(value, descriptor, result, state);
  for (let index = 0; index < value.length; index += 1) {
    result.push(
      serializeValue(
        value[index],
        itemSchema,
        `${path}[${index}]`,
        depth + 1,
        state,
      ),
    );
  }
  return result;
}

function serializeRecord(
  value: unknown,
  descriptor: UnknownRecord | undefined,
  path: string,
  depth: number,
  state: SerializationState,
): unknown {
  if (!isRecordValue(value)) {
    return failOrPreserve('Expected an object record', path, value, state);
  }

  const valueSchema = firstDefined(
    descriptor?.['value'],
    descriptor?.['valueType'],
    descriptor?.['values'],
    descriptor?.['element'],
    descriptor?.['of'],
  );
  if (valueSchema === undefined) {
    return failOrPreserve(
      'Record schema is missing its value schema',
      path,
      value,
      state,
    );
  }

  const cached = getSerializedPair(value, descriptor, state);
  if (cached !== undefined) {
    return cached;
  }

  const result: UnknownRecord = {};
  setSerializedPair(value, descriptor, result, state);
  for (const [key, item] of Object.entries(value)) {
    if (!DANGEROUS_KEYS.has(key)) {
      result[key] = serializeValue(
        item,
        valueSchema,
        appendProperty(path, key),
        depth + 1,
        state,
      );
    }
  }
  return result;
}

function serializeObject(
  value: unknown,
  descriptor: UnknownRecord | undefined,
  path: string,
  depth: number,
  state: SerializationState,
): unknown {
  if (!isRecordValue(value)) {
    return failOrPreserve('Expected an object', path, value, state);
  }

  const properties = objectProperties(descriptor);
  if (properties === undefined) {
    return failOrPreserve(
      'Object schema is missing its properties',
      path,
      value,
      state,
    );
  }

  const cached = getSerializedPair(value, descriptor, state);
  if (cached !== undefined) {
    return cached;
  }

  const result: UnknownRecord = {};
  setSerializedPair(value, descriptor, result, state);
  for (const [key, item] of Object.entries(value)) {
    if (!DANGEROUS_KEYS.has(key)) {
      result[key] = item;
    }
  }

  for (const property of properties) {
    if (
      DANGEROUS_KEYS.has(property.name) ||
      DANGEROUS_KEYS.has(property.serializedName)
    ) {
      continue;
    }

    const sourceName = Object.hasOwn(value, property.name)
      ? property.name
      : Object.hasOwn(value, property.serializedName)
        ? property.serializedName
        : undefined;
    if (sourceName === undefined) {
      continue;
    }

    result[property.serializedName] = serializeValue(
      value[sourceName],
      property.schema,
      appendProperty(path, property.name),
      depth + 1,
      state,
    );
    if (property.name !== property.serializedName) {
      delete result[property.name];
    }
  }

  return result;
}

function serializeReference(
  value: unknown,
  descriptor: UnknownRecord | undefined,
  path: string,
  depth: number,
  state: SerializationState,
): unknown {
  const directTarget = firstDefined(
    descriptor?.['schema'],
    descriptor?.['target'],
    descriptor?.['descriptor'],
  );
  if (directTarget !== undefined && typeof directTarget !== 'string') {
    return serializeValue(value, directTarget, path, depth, state);
  }

  const name = firstString(
    descriptor?.['name'],
    descriptor?.['typeName'],
    descriptor?.['ref'],
    descriptor?.['key'],
    descriptor?.['id'],
    directTarget,
  );
  if (name === undefined) {
    return failOrPreserve(
      'Reference schema is missing its name',
      path,
      value,
      state,
    );
  }

  let referencedSchema = state.resolvedSchemas.get(name);
  if (referencedSchema === undefined) {
    referencedSchema = registryLookup(state.registry, name, 'schema');
    if (referencedSchema !== undefined) {
      state.resolvedSchemas.set(name, referencedSchema);
    }
  }

  return referencedSchema === undefined
    ? failOrPreserve(
        `Schema reference "${name}" was not found`,
        path,
        value,
        state,
      )
    : serializeValue(value, referencedSchema, path, depth, state);
}

function serializeCustom(
  value: unknown,
  descriptor: UnknownRecord | undefined,
  path: string,
  depth: number,
  state: SerializationState,
): unknown {
  const inlineSerializer = firstDefined(
    descriptor?.['serialize'],
    descriptor?.['serializer'],
  );
  const name = firstString(
    descriptor?.['name'],
    descriptor?.['key'],
    descriptor?.['id'],
  );
  const serializer =
    typeof inlineSerializer === 'function' ||
    isRuntimeSerializer(inlineSerializer)
      ? inlineSerializer
      : lookupCustomSerializer(name, state);

  if (serializer === undefined) {
    return failOrPreserve(
      name === undefined
        ? 'Custom schema is missing its serializer'
        : `Custom serializer "${name}" was not found`,
      path,
      value,
      state,
    );
  }

  const context: RuntimeSerializerContext = {
    path,
    schema: descriptor as SchemaDescriptor,
    options: descriptor?.['options'],
    serialize: (nestedValue: unknown, nestedSchema: SchemaDescriptor) =>
      serializeValue(nestedValue, nestedSchema, path, depth, state),
  };

  try {
    return typeof serializer === 'function'
      ? serializer(value, context)
      : serializer.serialize(value, context);
  } catch (error) {
    if (error instanceof JsonSerializationError) {
      throw error;
    }
    return failOrPreserve(
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
  descriptor: UnknownRecord | undefined,
  path: string,
  depth: number,
  state: SerializationState,
): unknown {
  if (!isRecordValue(value)) {
    return failOrPreserve(
      'Expected an object for a discriminated union',
      path,
      value,
      state,
    );
  }

  const discriminator = discriminatorName(descriptor);
  if (
    discriminator === undefined ||
    DANGEROUS_KEYS.has(discriminator) ||
    !Object.hasOwn(value, discriminator)
  ) {
    return failOrPreserve(
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
    return failOrPreserve(
      'Discriminator must be a string or number',
      appendProperty(path, discriminator),
      discriminatorValue,
      state,
    );
  }

  const variants = firstDefined(
    descriptor?.['variants'],
    descriptor?.['mapping'],
    descriptor?.['members'],
    descriptor?.['options'],
  );
  const variant = variantLookup(variants, discriminatorValue);
  return variant === undefined
    ? failOrPreserve(
        `No discriminated union variant for "${String(discriminatorValue)}"`,
        appendProperty(path, discriminator),
        discriminatorValue,
        state,
      )
    : serializeValue(value, variant, path, depth, state);
}

function descriptorKind(descriptor: UnknownRecord): string {
  const explicitKind = firstString(
    descriptor['kind'],
    descriptor['typeName'],
    descriptor['descriptorType'],
  );
  if (explicitKind !== undefined) {
    return normalizeKind(explicitKind);
  }
  return typeof descriptor['type'] === 'string'
    ? normalizeKind(descriptor['type'])
    : '';
}

function innerSchema(descriptor: UnknownRecord | undefined): unknown {
  return firstDefined(
    descriptor?.['inner'],
    descriptor?.['schema'],
    descriptor?.['value'],
    descriptor?.['of'],
    descriptor?.['wrapped'],
  );
}

function objectProperties(
  descriptor: UnknownRecord | undefined,
): readonly PropertyEntry[] | undefined {
  const rawProperties = firstDefined(
    descriptor?.['properties'],
    descriptor?.['fields'],
    descriptor?.['shape'],
  );
  const propertyRecord = asRecord(rawProperties);
  if (propertyRecord === undefined) {
    return undefined;
  }

  return Object.entries(propertyRecord).flatMap(([name, rawProperty]) => {
    const property = asRecord(rawProperty);
    const hasMetadata =
      property !== undefined &&
      (Object.hasOwn(property, 'schema') ||
        Object.hasOwn(property, 'descriptor') ||
        Object.hasOwn(property, 'serializedName') ||
        Object.hasOwn(property, 'jsonName') ||
        Object.hasOwn(property, 'wireName'));
    const propertySchema = hasMetadata
      ? firstDefined(
          property?.['schema'],
          property?.['descriptor'],
          property?.['valueType'],
          property?.['type'],
        )
      : rawProperty;
    return propertySchema === undefined
      ? []
      : [
          {
            name,
            serializedName:
              firstString(
                property?.['serializedName'],
                property?.['jsonName'],
                property?.['wireName'],
              ) ?? name,
            schema: propertySchema,
          },
        ];
  });
}

function discriminatorName(
  descriptor: UnknownRecord | undefined,
): string | undefined {
  const discriminator = firstDefined(
    descriptor?.['discriminator'],
    descriptor?.['tag'],
    descriptor?.['discriminatorProperty'],
  );
  if (typeof discriminator === 'string') {
    return discriminator;
  }
  const discriminatorDescriptor = asRecord(discriminator);
  return firstString(
    discriminatorDescriptor?.['name'],
    discriminatorDescriptor?.['property'],
    discriminatorDescriptor?.['serializedName'],
    discriminatorDescriptor?.['jsonName'],
  );
}

function variantLookup(variants: unknown, key: string | number): unknown {
  if (variants instanceof Map) {
    return variants.get(key) ?? variants.get(String(key));
  }
  return asRecord(variants)?.[String(key)];
}

function resolveLazySchema(schema: unknown): unknown {
  let result = schema;
  const seen = new Set<unknown>();
  while (typeof result === 'function') {
    if (seen.has(result)) {
      throw new Error('Circular lazy schema');
    }
    seen.add(result);
    result = (result as () => unknown)();
  }
  return result;
}

function registryLookup(
  registry: unknown,
  key: string,
  kind: 'schema' | 'serializer',
): unknown {
  if (registry instanceof Map) {
    return registry.get(key);
  }

  const registryRecord = asRecord(registry);
  if (registryRecord === undefined) {
    return undefined;
  }

  const methodNames =
    kind === 'schema'
      ? ['resolve', 'resolveSchema', 'getSchema', 'get']
      : ['resolveSerializer', 'getSerializer', 'get'];
  for (const methodName of methodNames) {
    const method = registryRecord[methodName];
    if (typeof method === 'function') {
      const resolved = method.call(registry, key);
      if (resolved !== undefined) {
        return resolved;
      }
    }
  }

  const collectionNames =
    kind === 'schema'
      ? ['schemas', 'references', 'types']
      : ['serializers', 'adapters'];
  for (const collectionName of collectionNames) {
    const resolved = lookupCollection(registryRecord[collectionName], key);
    if (resolved !== undefined) {
      return resolved;
    }
  }
  return registryRecord[key];
}

function lookupCustomSerializer(
  name: string | undefined,
  state: SerializationState,
): RuntimeSerializerEntry | undefined {
  if (name === undefined) {
    return undefined;
  }

  for (const registry of [
    state.options.serializers,
    state.options.customSerializers,
    state.options.registry,
  ]) {
    const serializer = lookupCollection(registry, name);
    if (isRuntimeSerializerFunction(serializer) || isRuntimeSerializer(serializer)) {
      return serializer;
    }
  }

  const serializer = registryLookup(state.registry, name, 'serializer');
  return isRuntimeSerializerFunction(serializer) || isRuntimeSerializer(serializer)
    ? serializer
    : undefined;
}

function lookupCollection(collection: unknown, key: string): unknown {
  return collection instanceof Map
    ? collection.get(key)
    : asRecord(collection)?.[key];
}

function isRuntimeSerializer(value: unknown): value is RuntimeSerializer {
  return (
    isObjectLike(value) &&
    typeof (value as { serialize?: unknown }).serialize === 'function'
  );
}

function isRuntimeSerializerFunction(
  value: unknown,
): value is RuntimeSerializerFunction {
  return typeof value === 'function';
}

function allowedUuidVersions(
  descriptor: UnknownRecord | undefined,
): ReadonlySet<number> | undefined {
  const rawVersions = firstDefined(
    descriptor?.['versions'],
    descriptor?.['allowedVersions'],
    descriptor?.['version'],
  );
  if (rawVersions === undefined) {
    return undefined;
  }

  const values = Array.isArray(rawVersions) ? rawVersions : [rawVersions];
  return new Set(
    values
      .map((value) =>
        typeof value === 'number'
          ? value
          : Number(String(value).replace(/^v/i, '')),
      )
      .filter(Number.isInteger),
  );
}

function getSerializedPair(
  value: object,
  schema: object | undefined,
  state: SerializationState,
): unknown {
  return schema === undefined
    ? undefined
    : state.serializedPairs.get(value)?.get(schema);
}

function setSerializedPair(
  value: object,
  schema: object | undefined,
  result: unknown,
  state: SerializationState,
): void {
  if (schema === undefined) {
    return;
  }
  let schemas = state.serializedPairs.get(value);
  if (schemas === undefined) {
    schemas = new WeakMap<object, unknown>();
    state.serializedPairs.set(value, schemas);
  }
  schemas.set(schema, result);
}

function failOrPreserve(
  message: string,
  path: string,
  value: unknown,
  state: SerializationState,
  cause?: unknown,
): unknown {
  if (state.strict) {
    throw new JsonSerializationError(message, path, value, cause);
  }
  return value;
}

function normalizeMaxDepth(value: number | undefined): number {
  return value === undefined || !Number.isInteger(value) || value < 0
    ? 100
    : value;
}

function normalizeKind(value: string): string {
  return value.replace(/[^a-z0-9]/giu, '').toLowerCase();
}

function asRecord(value: unknown): UnknownRecord | undefined {
  return isObjectLike(value) ? (value as UnknownRecord) : undefined;
}

function isObjectLike(value: unknown): value is object {
  return (
    (typeof value === 'object' && value !== null) || typeof value === 'function'
  );
}

function isRecordValue(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstDefined(...values: readonly unknown[]): unknown {
  return values.find((value) => value !== undefined);
}

function firstString(...values: readonly unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === 'string');
}

function appendProperty(path: string, key: string): string {
  return /^[A-Za-z_$][\w$]*$/u.test(key)
    ? `${path}.${key}`
    : `${path}[${JSON.stringify(key)}]`;
}
