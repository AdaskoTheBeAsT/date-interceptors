export type DecimalWireType = 'string' | 'number';

export type UuidVersion = 1 | 3 | 4 | 5 | 6 | 7 | 8;

interface SchemaOutput<T> {
  readonly '~type'?: T;
}

export interface UnknownSchema extends SchemaOutput<unknown> {
  readonly kind: 'unknown';
}

export interface StringSchema extends SchemaOutput<string> {
  readonly kind: 'string';
}

export interface NumberSchema extends SchemaOutput<number> {
  readonly kind: 'number';
}

export interface BooleanSchema extends SchemaOutput<boolean> {
  readonly kind: 'boolean';
}

export interface DecimalSchema<T = unknown> extends SchemaOutput<T> {
  readonly kind: 'decimal';
  readonly wireType: DecimalWireType;
}

export interface UuidSchema extends SchemaOutput<Uint8Array> {
  readonly kind: 'uuid';
  readonly versions?: readonly UuidVersion[];
}

export interface InstantSchema<T = unknown> extends SchemaOutput<T> {
  readonly kind: 'instant';
}

export interface PlainDateSchema<T = unknown> extends SchemaOutput<T> {
  readonly kind: 'plain-date';
}

export interface PlainTimeSchema<T = unknown> extends SchemaOutput<T> {
  readonly kind: 'plain-time';
}

export interface PlainDateTimeSchema<T = unknown> extends SchemaOutput<T> {
  readonly kind: 'plain-date-time';
}

export interface ZonedDateTimeSchema<T = unknown> extends SchemaOutput<T> {
  readonly kind: 'zoned-date-time';
}

export interface DurationSchema<T = unknown> extends SchemaOutput<T> {
  readonly kind: 'duration';
}

export interface PeriodSchema<T = unknown> extends SchemaOutput<T> {
  readonly kind: 'period';
}

export interface PlainYearMonthSchema<T = unknown> extends SchemaOutput<T> {
  readonly kind: 'plain-year-month';
}

export interface PlainMonthDaySchema<T = unknown> extends SchemaOutput<T> {
  readonly kind: 'plain-month-day';
}

export type LiteralValue = string | number | boolean | null;

export interface LiteralSchema<T extends LiteralValue = LiteralValue>
  extends SchemaOutput<T> {
  readonly kind: 'literal';
  readonly value: T;
}

export interface NullableSchema<T = unknown>
  extends SchemaOutput<T | null> {
  readonly kind: 'nullable';
  readonly schema: RuntimeSchema<T>;
}

export interface OptionalSchema<T = unknown>
  extends SchemaOutput<T | undefined> {
  readonly kind: 'optional';
  readonly schema: RuntimeSchema<T>;
}

export interface ArraySchema<T = unknown> extends SchemaOutput<T[]> {
  readonly kind: 'array';
  readonly items: RuntimeSchema<T>;
}

export interface RecordSchema<T = unknown>
  extends SchemaOutput<Record<string, T>> {
  readonly kind: 'record';
  readonly values: RuntimeSchema<T>;
}

export interface RuntimeProperty<T = unknown> {
  readonly schema: RuntimeSchema<T>;
  readonly serializedName?: string;
}

export type RuntimeSchemaMap<T extends object> = {
  readonly [TKey in keyof T]-?: RuntimeProperty<T[TKey]>;
};

export interface ObjectSchema<T extends object = object>
  extends SchemaOutput<T> {
  readonly kind: 'object';
  readonly id?: string;
  readonly properties: RuntimeSchemaMap<T>;
}

export interface ReferenceSchema<T = unknown> extends SchemaOutput<T> {
  readonly kind: 'reference';
  readonly typeName: string;
}

export interface CustomSchema<T = unknown, TOptions = unknown>
  extends SchemaOutput<T> {
  readonly kind: 'custom';
  readonly name: string;
  readonly options?: TOptions;
}

export interface DiscriminatedUnionSchema<T = unknown>
  extends SchemaOutput<T> {
  readonly kind: 'discriminated-union';
  readonly discriminator: string;
  readonly variants: Readonly<Record<string, RuntimeSchema<T>>>;
}

export type AnyRuntimeSchema =
  | UnknownSchema
  | StringSchema
  | NumberSchema
  | BooleanSchema
  | DecimalSchema
  | UuidSchema
  | InstantSchema
  | PlainDateSchema
  | PlainTimeSchema
  | PlainDateTimeSchema
  | ZonedDateTimeSchema
  | DurationSchema
  | PeriodSchema
  | PlainYearMonthSchema
  | PlainMonthDaySchema
  | LiteralSchema
  | NullableSchema
  | OptionalSchema
  | ArraySchema
  | RecordSchema
  | ObjectSchema
  | ReferenceSchema
  | CustomSchema
  | DiscriminatedUnionSchema;

export type RuntimeSchema<T = unknown> = AnyRuntimeSchema & SchemaOutput<T>;

export type RuntimeSchemaFactory<T = unknown> = () => RuntimeSchema<T>;

export type RuntimeSchemaDefinition<T = unknown> =
  | RuntimeSchema<T>
  | RuntimeSchemaFactory<T>;

export type RuntimeSchemaDefinitions = Record<
  string,
  RuntimeSchemaDefinition<unknown>
>;

type SchemaDefinitionOutput<TDefinition> =
  TDefinition extends RuntimeSchemaFactory<infer T>
    ? T
    : TDefinition extends SchemaOutput<infer T>
      ? T
      : never;

export interface TypeRegistry<
  TDefinitions extends RuntimeSchemaDefinitions = RuntimeSchemaDefinitions,
> {
  register<TName extends string, T>(
    typeName: TName,
    definition: RuntimeSchemaDefinition<T>,
  ): TypeRegistry<
    TDefinitions & Record<TName, RuntimeSchemaDefinition<T>>
  >;
  get<TName extends keyof TDefinitions & string>(
    typeName: TName,
  ): RuntimeSchema<SchemaDefinitionOutput<TDefinitions[TName]>> | undefined;
  get(typeName: string): RuntimeSchema | undefined;
  has(typeName: string): boolean;
}

export type SchemaRegistry<
  TDefinitions extends RuntimeSchemaDefinitions = RuntimeSchemaDefinitions,
> = TypeRegistry<TDefinitions>;

export function unknownSchema(): UnknownSchema {
  return { kind: 'unknown' };
}

export function stringSchema(): StringSchema {
  return { kind: 'string' };
}

export function numberSchema(): NumberSchema {
  return { kind: 'number' };
}

export function booleanSchema(): BooleanSchema {
  return { kind: 'boolean' };
}

export function decimalSchema<T = unknown>(
  wireType: DecimalWireType,
): DecimalSchema<T> {
  return { kind: 'decimal', wireType };
}

export function uuidSchema(
  versions?: readonly UuidVersion[],
): UuidSchema {
  return versions === undefined
    ? { kind: 'uuid' }
    : { kind: 'uuid', versions };
}

export function instantSchema<T = unknown>(): InstantSchema<T> {
  return { kind: 'instant' };
}

export function plainDateSchema<T = unknown>(): PlainDateSchema<T> {
  return { kind: 'plain-date' };
}

export function plainTimeSchema<T = unknown>(): PlainTimeSchema<T> {
  return { kind: 'plain-time' };
}

export function plainDateTimeSchema<T = unknown>(): PlainDateTimeSchema<T> {
  return { kind: 'plain-date-time' };
}

export function zonedDateTimeSchema<T = unknown>(): ZonedDateTimeSchema<T> {
  return { kind: 'zoned-date-time' };
}

export function durationSchema<T = unknown>(): DurationSchema<T> {
  return { kind: 'duration' };
}

export function periodSchema<T = unknown>(): PeriodSchema<T> {
  return { kind: 'period' };
}

export function plainYearMonthSchema<T = unknown>(): PlainYearMonthSchema<T> {
  return { kind: 'plain-year-month' };
}

export function plainMonthDaySchema<T = unknown>(): PlainMonthDaySchema<T> {
  return { kind: 'plain-month-day' };
}

export function literalSchema<const T extends LiteralValue>(
  value: T,
): LiteralSchema<T> {
  return { kind: 'literal', value };
}

export function nullableSchema<T>(
  valueSchema: RuntimeSchema<T>,
): NullableSchema<T> {
  return { kind: 'nullable', schema: valueSchema };
}

export function optionalSchema<T>(
  valueSchema: RuntimeSchema<T>,
): OptionalSchema<T> {
  return { kind: 'optional', schema: valueSchema };
}

export function arraySchema<T>(
  itemSchema: RuntimeSchema<T>,
): ArraySchema<T> {
  return { kind: 'array', items: itemSchema };
}

export function recordSchema<T>(
  valueSchema: RuntimeSchema<T>,
): RecordSchema<T> {
  return { kind: 'record', values: valueSchema };
}

export function property<T>(
  valueSchema: RuntimeSchema<T>,
  serializedName?: string,
): RuntimeProperty<T> {
  return serializedName === undefined
    ? { schema: valueSchema }
    : { schema: valueSchema, serializedName };
}

export function objectSchema<T extends object>(
  properties: RuntimeSchemaMap<T>,
  options?: { readonly id?: string },
): ObjectSchema<T> {
  return options?.id === undefined
    ? { kind: 'object', properties }
    : { kind: 'object', id: options.id, properties };
}

export function referenceSchema<T = unknown>(
  typeName: string,
): ReferenceSchema<T> {
  return { kind: 'reference', typeName };
}

export function customSchema<T = unknown, TOptions = unknown>(
  name: string,
  options?: TOptions,
): CustomSchema<T, TOptions> {
  return options === undefined
    ? { kind: 'custom', name }
    : { kind: 'custom', name, options };
}

export function discriminatedUnionSchema<T>(
  discriminator: string,
  variants: Readonly<Record<string, RuntimeSchema<T>>>,
): DiscriminatedUnionSchema<T> {
  return { kind: 'discriminated-union', discriminator, variants };
}

class RuntimeTypeRegistry<
  TDefinitions extends RuntimeSchemaDefinitions,
> implements TypeRegistry<TDefinitions>
{
  private readonly definitions = new Map<
    string,
    RuntimeSchemaDefinition<unknown>
  >();

  constructor(definitions: TDefinitions) {
    for (const [typeName, definition] of Object.entries(definitions)) {
      this.registerDefinition(typeName, definition);
    }
  }

  register<TName extends string, T>(
    typeName: TName,
    definition: RuntimeSchemaDefinition<T>,
  ): TypeRegistry<
    TDefinitions & Record<TName, RuntimeSchemaDefinition<T>>
  > {
    this.registerDefinition(typeName, definition);
    return this;
  }

  get<TName extends keyof TDefinitions & string>(
    typeName: TName,
  ): RuntimeSchema<SchemaDefinitionOutput<TDefinitions[TName]>> | undefined;
  get(typeName: string): RuntimeSchema | undefined;
  get(typeName: string): RuntimeSchema | undefined {
    const definition = this.definitions.get(typeName);
    if (definition === undefined) {
      return undefined;
    }

    return typeof definition === 'function' ? definition() : definition;
  }

  has(typeName: string): boolean {
    return this.definitions.has(typeName);
  }

  private registerDefinition<T>(
    typeName: string,
    definition: RuntimeSchemaDefinition<T>,
  ): void {
    if (this.definitions.has(typeName)) {
      throw new Error(`Type "${typeName}" is already registered.`);
    }

    this.definitions.set(
      typeName,
      definition as RuntimeSchemaDefinition<unknown>,
    );
  }
}

export function defineTypeRegistry<
  const TDefinitions extends RuntimeSchemaDefinitions,
>(definitions: TDefinitions): TypeRegistry<TDefinitions> {
  return new RuntimeTypeRegistry(definitions);
}

export const schema = {
  unknown: unknownSchema,
  string: stringSchema,
  number: numberSchema,
  boolean: booleanSchema,
  decimal: decimalSchema,
  uuid: uuidSchema,
  instant: instantSchema,
  plainDate: plainDateSchema,
  plainTime: plainTimeSchema,
  plainDateTime: plainDateTimeSchema,
  zonedDateTime: zonedDateTimeSchema,
  duration: durationSchema,
  period: periodSchema,
  plainYearMonth: plainYearMonthSchema,
  plainMonthDay: plainMonthDaySchema,
  literal: literalSchema,
  nullable: nullableSchema,
  optional: optionalSchema,
  array: arraySchema,
  record: recordSchema,
  property,
  object: objectSchema,
  reference: referenceSchema,
  custom: customSchema,
  discriminatedUnion: discriminatedUnionSchema,
} as const;
