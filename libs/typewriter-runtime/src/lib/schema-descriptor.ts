import type { DateSchemaKind } from './date-backend';

type UnknownRecord = Record<string, unknown>;

export interface PropertyEntry {
  readonly name: string;
  readonly serializedName: string;
  readonly schema: unknown;
}

export type VariantLookup = (key: string | number) => unknown;

export type NormalizedSchema =
  | { readonly type: 'any' }
  | { readonly type: 'typeof'; readonly expected: string }
  | { readonly type: 'null' }
  | { readonly type: 'undefined' }
  | {
      readonly type: 'literal';
      readonly hasValue: boolean;
      readonly value: unknown;
    }
  | { readonly type: 'decimal'; readonly wireType: 'number' | 'string' }
  | {
      readonly type: 'uuid';
      readonly versions: ReadonlySet<number> | undefined;
    }
  | { readonly type: 'date'; readonly dateKind: DateSchemaKind | undefined }
  | { readonly type: 'nullable'; readonly inner: unknown }
  | { readonly type: 'optional'; readonly inner: unknown }
  | { readonly type: 'array'; readonly items: unknown }
  | { readonly type: 'record'; readonly values: unknown }
  | {
      readonly type: 'object';
      readonly properties: readonly PropertyEntry[] | undefined;
      readonly modelNames: ReadonlySet<string>;
    }
  | {
      readonly type: 'reference';
      readonly target: unknown;
      readonly name: string | undefined;
    }
  | {
      readonly type: 'custom';
      readonly name: string | undefined;
      readonly transformer: unknown;
      readonly serializer: unknown;
      readonly options: unknown;
    }
  | {
      readonly type: 'union';
      readonly wireDiscriminator: string | undefined;
      readonly modelDiscriminator: string | undefined;
      readonly variant: VariantLookup;
    }
  | { readonly type: 'invalid' };

export const DANGEROUS_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

const ANY_PRIMITIVES = new Set([
  'any',
  'unknown',
  'object',
  'objectprimitive',
  'primitive',
]);

const DATE_KINDS: Readonly<Record<string, DateSchemaKind>> = {
  instant: 'instant',
  plaindate: 'plain-date',
  plaintime: 'plain-time',
  plaindatetime: 'plain-date-time',
  zoneddatetime: 'zoned-date-time',
  duration: 'duration',
  period: 'period',
  plainyearmonth: 'plain-year-month',
  plainmonthday: 'plain-month-day',
};

const INVALID: NormalizedSchema = { type: 'invalid' };
const normalizedDescriptors = new WeakMap<object, NormalizedSchema>();
const resolvedFactories = new WeakMap<object, unknown>();

/**
 * Normalizes a resolved schema once. Descriptors are treated as immutable after
 * their first use; the normalized form is cached by descriptor identity.
 */
export function normalizeSchema(schema: unknown): NormalizedSchema {
  if (typeof schema === 'string') {
    return normalizeDescriptor({ kind: schema });
  }

  if (!isObjectLike(schema)) {
    return INVALID;
  }

  let normalized = normalizedDescriptors.get(schema);
  if (normalized === undefined) {
    normalized = normalizeDescriptor(schema as UnknownRecord);
    normalizedDescriptors.set(schema, normalized);
  }
  return normalized;
}

/** Resolves lazy schema factories; each factory is called at most once. */
export function resolveLazySchema(schema: unknown): unknown {
  if (typeof schema !== 'function') {
    return schema;
  }

  const cached = resolvedFactories.get(schema);
  if (cached !== undefined) {
    return cached;
  }

  let result: unknown = schema;
  const seen = new Set<unknown>();
  while (typeof result === 'function') {
    if (seen.has(result)) {
      throw new Error('Circular lazy schema');
    }
    seen.add(result);
    result = (result as () => unknown)();
  }

  if (result !== undefined) {
    resolvedFactories.set(schema, result);
  }
  return result;
}

function normalizeDescriptor(descriptor: UnknownRecord): NormalizedSchema {
  const kind = descriptorKind(descriptor);
  switch (kind) {
    case 'primitive':
    case 'objectprimitive':
      return normalizePrimitive(
        firstString(
          descriptor['primitive'],
          descriptor['name'],
          descriptor['valueType'],
        ) ?? kind,
      );
    case 'any':
    case 'unknown':
    case 'bigint':
    case 'boolean':
    case 'never':
    case 'number':
    case 'string':
    case 'symbol':
    case 'null':
    case 'undefined':
    case 'void':
      return normalizePrimitive(kind);
    case 'literal':
      return {
        type: 'literal',
        hasValue: Object.hasOwn(descriptor, 'value'),
        value: descriptor['value'],
      };
    case 'decimal':
    case 'decimaljs':
      return {
        type: 'decimal',
        wireType: descriptor['wireType'] === 'number' ? 'number' : 'string',
      };
    case 'uuid':
    case 'uuidbytes':
      return { type: 'uuid', versions: uuidVersions(descriptor) };
    case 'temporal':
      return {
        type: 'date',
        dateKind: dateKind(
          firstString(
            descriptor['temporalType'],
            descriptor['type'],
            descriptor['name'],
            descriptor['valueType'],
          ) ?? '',
        ),
      };
    case 'nullable':
    case 'optional':
      return {
        type: kind,
        inner: firstDefined(
          descriptor['inner'],
          descriptor['schema'],
          descriptor['value'],
          descriptor['of'],
          descriptor['wrapped'],
        ),
      };
    case 'array':
    case 'list':
      return {
        type: 'array',
        items: firstDefined(
          descriptor['element'],
          descriptor['elementType'],
          descriptor['items'],
          descriptor['item'],
          descriptor['of'],
        ),
      };
    case 'dictionary':
    case 'record':
      return {
        type: 'record',
        values: firstDefined(
          descriptor['value'],
          descriptor['valueType'],
          descriptor['values'],
          descriptor['element'],
          descriptor['of'],
        ),
      };
    case 'object':
    case 'struct':
      return normalizeObject(descriptor);
    case 'ref':
    case 'reference':
      return normalizeReference(descriptor);
    case 'adapter':
    case 'custom':
      return normalizeCustom(descriptor);
    case 'discriminatedunion':
    case 'taggedunion':
      return normalizeUnion(descriptor);
    default: {
      const directDateKind = dateKind(kind.replace(/^temporal/u, ''));
      return directDateKind === undefined
        ? INVALID
        : { type: 'date', dateKind: directDateKind };
    }
  }
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

function normalizePrimitive(name: string): NormalizedSchema {
  const normalized = normalizeKind(name);
  if (ANY_PRIMITIVES.has(normalized)) {
    return { type: 'any' };
  }
  if (normalized === 'null') {
    return { type: 'null' };
  }
  if (normalized === 'undefined' || normalized === 'void') {
    return { type: 'undefined' };
  }
  return { type: 'typeof', expected: normalized };
}

function dateKind(name: string): DateSchemaKind | undefined {
  const normalized = normalizeKind(name);
  return Object.hasOwn(DATE_KINDS, normalized)
    ? DATE_KINDS[normalized]
    : undefined;
}

function normalizeObject(descriptor: UnknownRecord): NormalizedSchema {
  const properties = objectProperties(descriptor);
  return {
    type: 'object',
    properties,
    modelNames: new Set(properties?.map((property) => property.name)),
  };
}

function objectProperties(
  descriptor: UnknownRecord,
): readonly PropertyEntry[] | undefined {
  const rawProperties = firstDefined(
    descriptor['properties'],
    descriptor['fields'],
    descriptor['shape'],
  );

  if (Array.isArray(rawProperties)) {
    return arrayProperties(rawProperties);
  }

  const propertyRecord = asRecord(rawProperties);
  if (propertyRecord === undefined) {
    return undefined;
  }

  const result: PropertyEntry[] = [];
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
          property['schema'],
          property['descriptor'],
          property['valueType'],
          property['type'],
        )
      : rawProperty;
    if (schema !== undefined) {
      pushProperty(
        result,
        name,
        (hasPropertyMetadata ? serializedName(property) : undefined) ?? name,
        schema,
      );
    }
  }
  return result;
}

function arrayProperties(rawProperties: readonly unknown[]): PropertyEntry[] {
  const result: PropertyEntry[] = [];
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
      pushProperty(result, name, serializedName(property) ?? name, schema);
    }
  }
  return result;
}

function pushProperty(
  result: PropertyEntry[],
  name: string,
  wireName: string,
  schema: unknown,
): void {
  if (!DANGEROUS_KEYS.has(name) && !DANGEROUS_KEYS.has(wireName)) {
    result.push({ name, serializedName: wireName, schema });
  }
}

function serializedName(
  property: UnknownRecord | undefined,
): string | undefined {
  return firstString(
    property?.['serializedName'],
    property?.['jsonName'],
    property?.['wireName'],
  );
}

function normalizeReference(descriptor: UnknownRecord): NormalizedSchema {
  const directTarget = firstDefined(
    descriptor['schema'],
    descriptor['target'],
    descriptor['descriptor'],
  );
  return {
    type: 'reference',
    target:
      directTarget !== undefined && typeof directTarget !== 'string'
        ? directTarget
        : undefined,
    name: firstString(
      descriptor['name'],
      descriptor['typeName'],
      descriptor['ref'],
      descriptor['key'],
      descriptor['id'],
      directTarget,
    ),
  };
}

function normalizeCustom(descriptor: UnknownRecord): NormalizedSchema {
  const transform = descriptor['transform'];
  const transformer = descriptor['transformer'];
  const serialize = descriptor['serialize'];
  const serializer = descriptor['serializer'];
  const adapter = descriptor['adapter'];
  return {
    type: 'custom',
    name: firstString(
      descriptor['name'],
      descriptor['key'],
      descriptor['id'],
      adapter,
      transformer,
      serializer,
    ),
    transformer: [transform, transformer, adapter].find(
      (entry) => typeof entry === 'function' || hasMethod(entry, 'transform'),
    ),
    serializer:
      [serialize, serializer].find(
        (entry) => typeof entry === 'function' || hasMethod(entry, 'serialize'),
      ) ?? (hasMethod(adapter, 'serialize') ? adapter : undefined),
    options: descriptor['options'],
  };
}

function normalizeUnion(descriptor: UnknownRecord): NormalizedSchema {
  const discriminator = firstDefined(
    descriptor['discriminator'],
    descriptor['tag'],
    descriptor['discriminatorProperty'],
  );
  const discriminatorRecord = asRecord(discriminator);
  const wireDiscriminator =
    typeof discriminator === 'string'
      ? discriminator
      : firstString(
          discriminatorRecord?.['serializedName'],
          discriminatorRecord?.['jsonName'],
          discriminatorRecord?.['name'],
          discriminatorRecord?.['property'],
        );
  const modelDiscriminator =
    typeof discriminator === 'string'
      ? discriminator
      : firstString(
          discriminatorRecord?.['name'],
          discriminatorRecord?.['property'],
          discriminatorRecord?.['serializedName'],
          discriminatorRecord?.['jsonName'],
        );

  return {
    type: 'union',
    wireDiscriminator: safeKey(wireDiscriminator),
    modelDiscriminator: safeKey(modelDiscriminator),
    variant: variantLookup(
      firstDefined(
        descriptor['variants'],
        descriptor['mapping'],
        descriptor['members'],
        descriptor['options'],
      ),
    ),
  };
}

function safeKey(key: string | undefined): string | undefined {
  return key === undefined || DANGEROUS_KEYS.has(key) ? undefined : key;
}

function variantLookup(variants: unknown): VariantLookup {
  if (variants instanceof Map) {
    return (key) =>
      variants.get(key) ??
      variants.get(typeof key === 'number' ? key.toString() : key);
  }

  const lookup = new Map<string, unknown>();
  if (Array.isArray(variants)) {
    addArrayVariants(lookup, variants);
  } else {
    const variantRecord = asRecord(variants);
    if (variantRecord !== undefined) {
      for (const [key, schema] of Object.entries(variantRecord)) {
        lookup.set(key, schema);
      }
    }
  }
  return (key) => lookup.get(typeof key === 'number' ? key.toString() : key);
}

function addArrayVariants(
  lookup: Map<string, unknown>,
  variants: readonly unknown[],
): void {
  for (const rawVariant of variants) {
    const variant = asRecord(rawVariant);
    const key = firstDefined(
      variant?.['value'],
      variant?.['tag'],
      variant?.['discriminator'],
      variant?.['key'],
    );
    const schema = firstDefined(
      variant?.['schema'],
      variant?.['descriptor'],
      variant?.['type'],
    );
    if (typeof key === 'string' || typeof key === 'number') {
      const name = typeof key === 'number' ? key.toString() : key;
      if (!lookup.has(name)) lookup.set(name, schema);
    }
  }
}

function uuidVersions(
  descriptor: UnknownRecord,
): ReadonlySet<number> | undefined {
  const rawVersions = firstDefined(
    descriptor['versions'],
    descriptor['allowedVersions'],
    descriptor['version'],
  );
  if (rawVersions === undefined) {
    return undefined;
  }

  const values = versionValues(rawVersions);
  const versions = new Set<number>();
  for (const value of values) {
    const parsed =
      typeof value === 'number'
        ? value
        : Number(String(value).replace(/^v/iu, ''));
    if (Number.isInteger(parsed)) {
      versions.add(parsed);
    }
  }
  return versions;
}

function versionValues(rawVersions: unknown): readonly unknown[] {
  if (rawVersions instanceof Set) {
    return [...rawVersions];
  }
  if (Array.isArray(rawVersions)) {
    return rawVersions;
  }
  return [rawVersions];
}

/** Own-property lookup that never returns inherited members. */
export function ownEntry(collection: unknown, key: string): unknown {
  if (collection instanceof Map) {
    return collection.get(key);
  }
  return isObjectLike(collection) && Object.hasOwn(collection, key)
    ? (collection as UnknownRecord)[key]
    : undefined;
}

export type CodecDirection = 'transform' | 'serialize';

const SCHEMA_METHODS = ['resolve', 'resolveSchema', 'getSchema', 'get'];
const SCHEMA_COLLECTIONS = ['schemas', 'references', 'types'];
const CODEC_METHODS: Readonly<Record<CodecDirection, readonly string[]>> = {
  transform: ['resolveTransformer', 'getTransformer'],
  serialize: ['resolveSerializer', 'getSerializer'],
};
const CODEC_COLLECTIONS: Readonly<Record<CodecDirection, readonly string[]>> = {
  transform: ['transformers', 'adapters'],
  serialize: ['serializers', 'adapters'],
};

/** Looks up a schema by name in a positional registry. Codec entries are skipped. */
export function lookupRegistrySchema(registry: unknown, key: string): unknown {
  if (registry instanceof Map) {
    return schemaEntry(registry.get(key));
  }

  const registryRecord = asRecord(registry);
  if (registryRecord === undefined) {
    return undefined;
  }

  for (const methodName of SCHEMA_METHODS) {
    const resolved = schemaEntry(callMethod(registryRecord, methodName, key));
    if (resolved !== undefined) {
      return resolved;
    }
  }

  for (const collectionName of SCHEMA_COLLECTIONS) {
    const resolved = schemaEntry(ownEntry(registryRecord[collectionName], key));
    if (resolved !== undefined) {
      return resolved;
    }
  }

  return isPlainObject(registryRecord)
    ? schemaEntry(ownEntry(registryRecord, key))
    : undefined;
}

/**
 * Looks up a custom codec by name in a positional registry. Explicit codec
 * methods and collections may hold bare functions. Shared sources (Maps,
 * generic `get`, and direct keys) share their key space with schemas, where a
 * bare function is a lazy schema factory, so only codec objects are accepted.
 */
export function lookupRegistryCodec(
  registry: unknown,
  key: string,
  direction: CodecDirection,
): unknown {
  if (registry instanceof Map) {
    return codecObject(registry.get(key), direction);
  }

  const registryRecord = asRecord(registry);
  if (registryRecord === undefined) {
    return undefined;
  }

  for (const methodName of CODEC_METHODS[direction]) {
    const resolved = codecEntry(
      callMethod(registryRecord, methodName, key),
      direction,
    );
    if (resolved !== undefined) {
      return resolved;
    }
  }

  for (const collectionName of CODEC_COLLECTIONS[direction]) {
    const resolved = codecEntry(
      ownEntry(registryRecord[collectionName], key),
      direction,
    );
    if (resolved !== undefined) {
      return resolved;
    }
  }

  const generic = codecObject(
    callMethod(registryRecord, 'get', key),
    direction,
  );
  if (generic !== undefined) {
    return generic;
  }

  return isPlainObject(registryRecord)
    ? codecObject(ownEntry(registryRecord, key), direction)
    : undefined;
}

/**
 * Resolves a custom codec from option registries first, then from the
 * positional registry.
 */
export function lookupCustomCodec(
  name: string,
  optionRegistries: readonly unknown[],
  registry: unknown,
  direction: CodecDirection,
): unknown {
  for (const optionRegistry of optionRegistries) {
    const entry = codecEntry(ownEntry(optionRegistry, name), direction);
    if (entry !== undefined) {
      return entry;
    }
  }
  return lookupRegistryCodec(registry, name, direction);
}

/** Resolves a named schema, memoizing hits for the current conversion. */
export function resolveNamedSchema(
  cache: Map<string, unknown>,
  registry: unknown,
  name: string,
): unknown {
  let schema = cache.get(name);
  if (schema === undefined) {
    schema = lookupRegistrySchema(registry, name);
    if (schema !== undefined) {
      cache.set(name, schema);
    }
  }
  return schema;
}

/** Accepts a function or a codec object for the given direction. */
function codecEntry(entry: unknown, direction: CodecDirection): unknown {
  return typeof entry === 'function' ? entry : codecObject(entry, direction);
}

function codecObject(entry: unknown, direction: CodecDirection): unknown {
  return typeof entry === 'object' && hasMethod(entry, direction)
    ? entry
    : undefined;
}

function schemaEntry(entry: unknown): unknown {
  if (
    typeof entry === 'object' &&
    entry !== null &&
    typeof (entry as UnknownRecord)['kind'] !== 'string' &&
    (hasMethod(entry, 'transform') || hasMethod(entry, 'serialize'))
  ) {
    return undefined;
  }
  return entry;
}

function callMethod(
  target: UnknownRecord,
  methodName: string,
  key: string,
): unknown {
  const method = target[methodName];
  return typeof method === 'function' ? method.call(target, key) : undefined;
}

function hasMethod(value: unknown, methodName: string): boolean {
  return (
    isObjectLike(value) &&
    typeof (value as UnknownRecord)[methodName] === 'function'
  );
}

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

export function normalizeKind(value: string): string {
  return value.replace(/[^a-z0-9]/giu, '').toLowerCase();
}

export function asRecord(value: unknown): UnknownRecord | undefined {
  return isObjectLike(value) ? (value as UnknownRecord) : undefined;
}

export function isObjectLike(value: unknown): value is object {
  return (
    (typeof value === 'object' && value !== null) || typeof value === 'function'
  );
}

export function isRecordValue(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstDefined(...values: readonly unknown[]): unknown {
  return values.find((value) => value !== undefined);
}

function firstString(...values: readonly unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === 'string');
}
