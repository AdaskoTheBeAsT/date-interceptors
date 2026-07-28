import { schema as runtimeSchemaBuilders } from '@adaskothebeast/typewriter-schema';
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

import type { DateBackend, DateSchemaKind } from './date-backend';
import { temporalDateBackend } from './temporal-date-backend';

export type SchemaDescriptor<T = unknown> =
  | RuntimeSchema<T>
  | (Readonly<Record<string, unknown>> & {
      readonly kind: string;
      readonly '~type'?: T;
    });

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

export type JsonTransformerRegistry =
  | SchemaRegistry
  | RuntimeTransformerRegistry
  | ReadonlyMap<string, unknown>
  | Readonly<Record<string, unknown>>;

export interface RuntimeTransformerContext {
  readonly path: string;
  readonly schema: SchemaDescriptor;
  readonly options: unknown;
  transform(value: unknown, schema: SchemaDescriptor): unknown;
}

export interface JsonTransformerOptions {
  readonly mode?: 'strict' | 'tolerant';
  readonly strict?: boolean;
  readonly maxDepth?: number;
  readonly dateBackend?: DateBackend;
  readonly transformers?: RuntimeTransformerRegistry;
  readonly customTransformers?: RuntimeTransformerRegistry;
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
  readonly options: JsonTransformerOptions;
  readonly visitedPairs: WeakMap<object, WeakSet<object>>;
  readonly resolvedSchemas: Map<string, unknown>;
}

interface PropertyEntry {
  readonly name: string;
  readonly serializedName: string;
  readonly schema: unknown;
}

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const PRIMITIVE_KINDS = new Set([
  runtimeSchemaBuilders.unknown().kind,
  runtimeSchemaBuilders.string().kind,
  runtimeSchemaBuilders.number().kind,
  runtimeSchemaBuilders.boolean().kind,
  'any',
  'bigint',
  'never',
  'objectprimitive',
  'primitive',
  'symbol',
]);

export function transformJson<T>(
  value: unknown,
  schema: SchemaDescriptor<T>,
  registry?: JsonTransformerRegistry,
  options: JsonTransformerOptions = {},
): T {
  const state: TransformationState = {
    strict: options.strict ?? options.mode === 'strict',
    maxDepth: normalizeMaxDepth(options.maxDepth),
    registry,
    options,
    visitedPairs: new WeakMap<object, WeakSet<object>>(),
    resolvedSchemas: new Map<string, unknown>(),
  };

  return transformValue(value, schema, '$', 0, state) as T;
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
  path: string,
  depth: number,
  state: TransformationState,
): unknown {
  if (depth > state.maxDepth) {
    return failOrPreserve(
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

  if (descriptor !== undefined && isObjectLike(value)) {
    if (hasVisitedPair(value, descriptor, state.visitedPairs)) {
      return value;
    }
  }

  if (PRIMITIVE_KINDS.has(kind)) {
    return transformPrimitive(value, descriptor, kind, path, state);
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
      return transformLiteral(value, descriptor, path, state);
    case 'decimal':
    case 'decimaljs':
      return transformDecimal(value, descriptor, path, state);
    case 'uuid':
    case 'uuidbytes':
      return transformUuid(value, descriptor, path, state);
    case 'instant':
    case 'temporalinstant':
      return transformDate(value, 'instant', path, state);
    case 'plaindate':
    case 'temporalplaindate':
      return transformDate(value, 'plain-date', path, state);
    case 'plaindatetime':
    case 'temporalplaindatetime':
      return transformDate(value, 'plain-date-time', path, state);
    case 'plainmonthday':
    case 'temporalplainmonthday':
      return transformDate(value, 'plain-month-day', path, state);
    case 'plaintime':
    case 'temporalplaintime':
      return transformDate(value, 'plain-time', path, state);
    case 'plainyearmonth':
    case 'temporalplainyearmonth':
      return transformDate(value, 'plain-year-month', path, state);
    case 'zoneddatetime':
    case 'temporalzoneddatetime':
      return transformDate(value, 'zoned-date-time', path, state);
    case 'duration':
    case 'temporalduration':
      return transformDate(value, 'duration', path, state);
    case 'period':
    case 'temporalperiod':
      return transformDate(value, 'period', path, state);
    case 'temporal':
      return transformNamedTemporal(value, descriptor, path, state);
    case 'nullable':
      return value === null
        ? value
        : transformValue(value, innerSchema(descriptor), path, depth, state);
    case 'optional':
      return value === undefined
        ? value
        : transformValue(value, innerSchema(descriptor), path, depth, state);
    case 'array':
    case 'list':
      return transformArray(value, descriptor, path, depth, state);
    case 'dictionary':
    case 'record':
      return transformRecord(value, descriptor, path, depth, state);
    case 'object':
    case 'struct':
      return transformObject(value, descriptor, path, depth, state);
    case 'ref':
    case 'reference':
      return transformReference(value, descriptor, path, depth, state);
    case 'adapter':
    case 'custom':
      return transformCustom(value, descriptor, path, depth, state);
    case 'discriminatedunion':
    case 'taggedunion':
      return transformDiscriminatedUnion(value, descriptor, path, depth, state);
    default:
      return failOrPreserve('Unknown schema descriptor', path, value, state);
  }
}

function transformPrimitive(
  value: unknown,
  descriptor: UnknownRecord | undefined,
  kind: string,
  path: string,
  state: TransformationState,
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

  if (normalized === 'null') {
    return value === null
      ? value
      : failOrPreserve('Expected null', path, value, state);
  }

  if (normalized === 'undefined' || normalized === 'void') {
    return value === undefined
      ? value
      : failOrPreserve('Expected undefined', path, value, state);
  }

  return typeof value === normalized
    ? value
    : failOrPreserve(`Expected ${normalized}`, path, value, state);
}

function transformLiteral(
  value: unknown,
  descriptor: UnknownRecord | undefined,
  path: string,
  state: TransformationState,
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

function transformDecimal(
  value: unknown,
  descriptor: UnknownRecord | undefined,
  path: string,
  state: TransformationState,
): unknown {
  if (Decimal.isDecimal(value)) {
    return value;
  }

  const wireType = descriptor?.['wireType'];
  const validWireValue =
    wireType === 'number'
      ? typeof value === 'number' && Number.isFinite(value)
      : typeof value === 'string';
  if (!validWireValue) {
    return failOrPreserve(
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
    return failOrPreserve('Invalid decimal value', path, value, state, error);
  }
}

function transformUuid(
  value: unknown,
  descriptor: UnknownRecord | undefined,
  path: string,
  state: TransformationState,
): unknown {
  if (value instanceof Uint8Array && value.byteLength === 16) {
    return value;
  }

  if (typeof value !== 'string' || !validateUuid(value)) {
    return failOrPreserve('Invalid UUID value', path, value, state);
  }

  const versions = allowedUuidVersions(descriptor);
  const actualVersion = uuidVersion(value);
  if (versions !== undefined && !versions.has(actualVersion)) {
    return failOrPreserve(
      `UUID version ${actualVersion} is not allowed`,
      path,
      value,
      state,
    );
  }

  try {
    return parseUuid(value);
  } catch (error) {
    return failOrPreserve('Invalid UUID value', path, value, state, error);
  }
}

function transformDate(
  value: unknown,
  kind: DateSchemaKind,
  path: string,
  state: TransformationState,
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
    return value;
  }

  if (typeof value !== 'string') {
    return failOrPreserve(`Expected a ${kind} string`, path, value, state);
  }

  try {
    return codec.parse(value);
  } catch (error) {
    return failOrPreserve(`Invalid ${kind} value`, path, value, state, error);
  }
}

function transformNamedTemporal(
  value: unknown,
  descriptor: UnknownRecord | undefined,
  path: string,
  state: TransformationState,
): unknown {
  const temporalName = normalizeKind(
    firstString(
      descriptor?.['temporalType'],
      descriptor?.['type'],
      descriptor?.['name'],
      descriptor?.['valueType'],
    ) ?? '',
  );

  switch (temporalName) {
    case 'instant':
      return transformDate(value, 'instant', path, state);
    case 'plaindate':
      return transformDate(value, 'plain-date', path, state);
    case 'plaindatetime':
      return transformDate(value, 'plain-date-time', path, state);
    case 'plainmonthday':
      return transformDate(value, 'plain-month-day', path, state);
    case 'plaintime':
      return transformDate(value, 'plain-time', path, state);
    case 'plainyearmonth':
      return transformDate(value, 'plain-year-month', path, state);
    case 'zoneddatetime':
      return transformDate(value, 'zoned-date-time', path, state);
    case 'duration':
      return transformDate(value, 'duration', path, state);
    case 'period':
      return transformDate(value, 'period', path, state);
    default:
      return failOrPreserve('Unknown Temporal type', path, value, state);
  }
}

function transformArray(
  value: unknown,
  descriptor: UnknownRecord | undefined,
  path: string,
  depth: number,
  state: TransformationState,
): unknown {
  if (!Array.isArray(value)) {
    return failOrPreserve('Expected an array', path, value, state);
  }

  const elementSchema = firstDefined(
    descriptor?.['element'],
    descriptor?.['elementType'],
    descriptor?.['items'],
    descriptor?.['item'],
    descriptor?.['of'],
  );
  if (elementSchema === undefined) {
    return failOrPreserve(
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
      `${path}[${index}]`,
      depth + 1,
      state,
    );
  }

  return value;
}

function transformRecord(
  value: unknown,
  descriptor: UnknownRecord | undefined,
  path: string,
  depth: number,
  state: TransformationState,
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

  for (const key of Object.keys(value)) {
    if (DANGEROUS_KEYS.has(key)) {
      continue;
    }

    value[key] = transformValue(
      value[key],
      valueSchema,
      appendProperty(path, key),
      depth + 1,
      state,
    );
  }

  return value;
}

function transformObject(
  value: unknown,
  descriptor: UnknownRecord | undefined,
  path: string,
  depth: number,
  state: TransformationState,
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

  for (const property of properties) {
    if (
      DANGEROUS_KEYS.has(property.name) ||
      DANGEROUS_KEYS.has(property.serializedName) ||
      !Object.hasOwn(value, property.serializedName)
    ) {
      continue;
    }

    value[property.name] = transformValue(
      value[property.serializedName],
      property.schema,
      appendProperty(path, property.serializedName),
      depth + 1,
      state,
    );
    if (property.name !== property.serializedName) {
      delete value[property.serializedName];
    }
  }

  return value;
}

function transformReference(
  value: unknown,
  descriptor: UnknownRecord | undefined,
  path: string,
  depth: number,
  state: TransformationState,
): unknown {
  const directTarget = firstDefined(
    descriptor?.['schema'],
    descriptor?.['target'],
    descriptor?.['descriptor'],
  );
  if (directTarget !== undefined && typeof directTarget !== 'string') {
    return transformValue(value, directTarget, path, depth, state);
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
  if (referencedSchema === undefined) {
    return failOrPreserve(
      `Schema reference "${name}" was not found`,
      path,
      value,
      state,
    );
  }

  return transformValue(value, referencedSchema, path, depth, state);
}

function transformCustom(
  value: unknown,
  descriptor: UnknownRecord | undefined,
  path: string,
  depth: number,
  state: TransformationState,
): unknown {
  const inlineTransformer = firstDefined(
    descriptor?.['transform'],
    descriptor?.['adapter'],
    descriptor?.['transformer'],
  );
  const name = firstString(
    descriptor?.['name'],
    descriptor?.['key'],
    descriptor?.['id'],
    typeof inlineTransformer === 'string' ? inlineTransformer : undefined,
  );
  const transformer =
    typeof inlineTransformer === 'function' ||
    isRuntimeTransformer(inlineTransformer)
      ? inlineTransformer
      : lookupCustomTransformer(name, state);

  if (transformer === undefined) {
    return failOrPreserve(
      name === undefined
        ? 'Custom schema is missing its transformer'
        : `Custom transformer "${name}" was not found`,
      path,
      value,
      state,
    );
  }

  const context: RuntimeTransformerContext = {
    path,
    schema: descriptor as SchemaDescriptor,
    options: descriptor?.['options'],
    transform: (nestedValue: unknown, nestedSchema: unknown): unknown =>
      transformValue(nestedValue, nestedSchema, path, depth, state),
  };

  try {
    return typeof transformer === 'function'
      ? transformer(value, context)
      : transformer.transform(value, context);
  } catch (error) {
    if (error instanceof JsonTransformationError) {
      throw error;
    }

    return failOrPreserve(
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
  descriptor: UnknownRecord | undefined,
  path: string,
  depth: number,
  state: TransformationState,
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
  if (variant === undefined) {
    return failOrPreserve(
      `No discriminated union variant for "${String(discriminatorValue)}"`,
      appendProperty(path, discriminator),
      discriminatorValue,
      state,
    );
  }

  return transformValue(value, variant, path, depth, state);
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

  const type = descriptor['type'];
  return typeof type === 'string' ? normalizeKind(type) : '';
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
  if (rawProperties === undefined) {
    return undefined;
  }

  const result: PropertyEntry[] = [];
  if (Array.isArray(rawProperties)) {
    for (const rawProperty of rawProperties) {
      const property = asRecord(rawProperty);
      const name = firstString(
        property?.['name'],
        property?.['propertyName'],
        property?.['key'],
      );
      const schema = firstDefined(
        property?.['schema'],
        property?.['descriptor'],
        property?.['value'],
        property?.['valueType'],
        property?.['type'],
      );
      if (name !== undefined && schema !== undefined) {
        result.push({
          name,
          serializedName:
            firstString(
              property?.['serializedName'],
              property?.['jsonName'],
              property?.['wireName'],
            ) ?? name,
          schema,
        });
      }
    }
    return result;
  }

  const propertyRecord = asRecord(rawProperties);
  if (propertyRecord === undefined) {
    return undefined;
  }

  for (const [name, rawProperty] of Object.entries(propertyRecord)) {
    const property = asRecord(rawProperty);
    const hasPropertyMetadata =
      property !== undefined &&
      (Object.hasOwn(property, 'schema') ||
        Object.hasOwn(property, 'descriptor') ||
        Object.hasOwn(property, 'serializedName') ||
        Object.hasOwn(property, 'jsonName') ||
        Object.hasOwn(property, 'wireName'));
    const schema = hasPropertyMetadata
      ? firstDefined(
          property?.['schema'],
          property?.['descriptor'],
          property?.['valueType'],
          property?.['type'],
        )
      : rawProperty;

    if (schema !== undefined) {
      result.push({
        name,
        serializedName:
          firstString(
            property?.['serializedName'],
            property?.['jsonName'],
            property?.['wireName'],
          ) ?? name,
        schema,
      });
    }
  }

  return result;
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
    discriminatorDescriptor?.['serializedName'],
    discriminatorDescriptor?.['jsonName'],
    discriminatorDescriptor?.['name'],
    discriminatorDescriptor?.['property'],
  );
}

function variantLookup(variants: unknown, key: string | number): unknown {
  if (variants instanceof Map) {
    return variants.get(key) ?? variants.get(String(key));
  }

  if (Array.isArray(variants)) {
    for (const rawVariant of variants) {
      const variant = asRecord(rawVariant);
      const variantKey = firstDefined(
        variant?.['value'],
        variant?.['tag'],
        variant?.['discriminator'],
        variant?.['key'],
      );
      if (variantKey === key || String(variantKey) === String(key)) {
        return firstDefined(
          variant?.['schema'],
          variant?.['descriptor'],
          variant?.['type'],
        );
      }
    }
    return undefined;
  }

  const variantRecord = asRecord(variants);
  return variantRecord?.[String(key)];
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
  kind: 'schema' | 'transformer',
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
      : ['resolveTransformer', 'getTransformer', 'get'];
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
      : ['transformers', 'adapters'];
  for (const collectionName of collectionNames) {
    const collection = registryRecord[collectionName];
    const resolved = lookupCollection(collection, key);
    if (resolved !== undefined) {
      return resolved;
    }
  }

  return registryRecord[key];
}

function lookupCollection(collection: unknown, key: string): unknown {
  if (collection instanceof Map) {
    return collection.get(key);
  }
  return asRecord(collection)?.[key];
}

function lookupCustomTransformer(
  name: string | undefined,
  state: TransformationState,
): RuntimeTransformerEntry | undefined {
  if (name === undefined) {
    return undefined;
  }

  const optionRegistries = [
    state.options.transformers,
    state.options.customTransformers,
    state.options.registry,
  ];
  for (const registry of optionRegistries) {
    const transformer = lookupCollection(registry, name);
    if (typeof transformer === 'function') {
      return transformer as RuntimeTransformerFunction;
    }
    if (isRuntimeTransformer(transformer)) {
      return transformer;
    }
  }

  const transformer = registryLookup(state.registry, name, 'transformer');
  if (typeof transformer === 'function') {
    return transformer as RuntimeTransformerFunction;
  }
  return isRuntimeTransformer(transformer) ? transformer : undefined;
}

function isRuntimeTransformer(value: unknown): value is RuntimeTransformer {
  return (
    isObjectLike(value) &&
    typeof (value as { transform?: unknown }).transform === 'function'
  );
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

  const values =
    rawVersions instanceof Set
      ? [...rawVersions]
      : Array.isArray(rawVersions)
        ? rawVersions
        : [rawVersions];
  const versions = new Set<number>();
  for (const value of values) {
    const parsed =
      typeof value === 'number'
        ? value
        : Number(String(value).replace(/^v/i, ''));
    if (Number.isInteger(parsed)) {
      versions.add(parsed);
    }
  }
  return versions;
}

function hasVisitedPair(
  value: object,
  schema: object,
  visitedPairs: WeakMap<object, WeakSet<object>>,
): boolean {
  const schemas = visitedPairs.get(value);
  if (schemas?.has(schema) === true) {
    return true;
  }

  if (schemas === undefined) {
    const newSchemas = new WeakSet<object>();
    newSchemas.add(schema);
    visitedPairs.set(value, newSchemas);
  } else {
    schemas.add(schema);
  }

  return false;
}

function failOrPreserve(
  message: string,
  path: string,
  value: unknown,
  state: TransformationState,
  cause?: unknown,
): unknown {
  if (state.strict) {
    throw new JsonTransformationError(message, path, value, cause);
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
