import {
  defineTypeRegistry,
  schema as runtimeSchema,
} from '@adaskothebeast/typewriter-schema';
import { Temporal } from '@js-temporal/polyfill';
import Decimal from 'decimal.js';
import { parse as parseUuid, v4 as uuidV4, v7 as uuidV7 } from 'uuid';

import type { DateBackend } from './date-backend';
import { temporalDateBackend } from './temporal-date-backend';
import {
  JsonTransformationError,
  createJsonTransformer,
  transformJson,
} from './typewriter-runtime';

const primitive = (name: string): { kind: string; name: string } => ({
  kind: 'primitive',
  name,
});
const object = (
  properties: Record<string, unknown>,
): { kind: string; properties: Record<string, unknown> } => ({
  kind: 'object',
  properties: Object.fromEntries(
    Object.entries(properties).map(([name, schema]) => [name, { schema }]),
  ),
});

describe('typewriter runtime', () => {
  describe('scalar descriptors', () => {
    it('passes primitive values through and returns primitive roots', () => {
      expect(transformJson<string>('hello', primitive('string'))).toBe('hello');
      expect(transformJson<number>(42, { kind: 'number' })).toBe(42);
      expect(transformJson<boolean>(true, primitive('boolean'))).toBe(true);
      expect(
        transformJson<unknown>({ any: 'value' }, { kind: 'unknown' }),
      ).toEqual({ any: 'value' });
      expect(() =>
        transformJson('42', { kind: 'number' }, undefined, {
          strict: true,
        }),
      ).toThrow('Expected number at $');
    });

    it('supports literals and preserves mismatches in tolerant mode', () => {
      const schema = { kind: 'literal', value: 'ready' };

      expect(transformJson('ready', schema)).toBe('ready');
      expect(transformJson('waiting', schema)).toBe('waiting');
    });

    it('creates decimals without losing precision', () => {
      const value = '12345678901234567890.12345678901234567890123456789';

      const result = transformJson<Decimal>(value, {
        kind: 'decimal',
        wireType: 'string',
      });

      expect(Decimal.isDecimal(result)).toBe(true);
      expect(result.toFixed()).toBe(value);
    });

    it('honors number decimal wire types', () => {
      const schema = { kind: 'decimal', wireType: 'number' };

      expect(transformJson<Decimal>(12.125, schema).toString()).toBe('12.125');
      expect(transformJson('12.125', schema)).toBe('12.125');
    });

    it('parses UUID values into 16-byte arrays', () => {
      const value = uuidV4();

      const result = transformJson<Uint8Array>(value, { kind: 'uuid' });

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result).toHaveLength(16);
      expect(result).toEqual(parseUuid(value));
    });

    it('enforces optional UUID versions', () => {
      const versionFour = uuidV4();
      const versionSeven = uuidV7();
      const schema = { kind: 'uuid', versions: [4] };

      expect(transformJson(versionFour, schema)).toEqual(
        parseUuid(versionFour),
      );
      expect(transformJson(versionSeven, schema)).toBe(versionSeven);
      expect(() =>
        transformJson(versionSeven, schema, undefined, { mode: 'strict' }),
      ).toThrow(JsonTransformationError);
    });

    it.each([
      ['instant', '2024-01-02T03:04:05.123456789Z', Temporal.Instant],
      ['plain-date', '2024-01-02', Temporal.PlainDate],
      [
        'plain-date-time',
        '2024-01-02T03:04:05.123456789',
        Temporal.PlainDateTime,
      ],
      ['plain-month-day', '--01-02', Temporal.PlainMonthDay],
      ['plain-time', '03:04:05.123456789', Temporal.PlainTime],
      ['plain-year-month', '2024-01', Temporal.PlainYearMonth],
      [
        'zoned-date-time',
        '2024-01-02T03:04:05+01:00[Europe/Warsaw]',
        Temporal.ZonedDateTime,
      ],
      ['duration', 'P1Y2M3DT4H5M6.7S', Temporal.Duration],
      ['period', 'P1Y2M3D', Temporal.Duration],
    ])('parses Temporal %s values', (type, value, expectedType) => {
      const result = transformJson(value, { kind: type });

      expect(result).toBeInstanceOf(expectedType);
    });
  });

  describe('container descriptors', () => {
    it('handles nullable, optional, array, and record descriptors in place', () => {
      const value: {
        nullable: null;
        optional?: string;
        values: string[];
        totals: Record<string, string>;
      } = {
        nullable: null,
        optional: undefined,
        values: ['1.25', '2.5'],
        totals: { first: '3.75', second: '4.125' },
      };
      const schema = object({
        nullable: { kind: 'nullable', schema: { kind: 'decimal' } },
        optional: { kind: 'optional', schema: { kind: 'decimal' } },
        values: { kind: 'array', items: { kind: 'decimal' } },
        totals: { kind: 'record', values: { kind: 'decimal' } },
      });

      const result = transformJson<typeof value>(value, schema);

      expect(result).toBe(value);
      expect(result.nullable).toBeNull();
      expect(result.optional).toBeUndefined();
      expect(result.values.map(String)).toEqual(['1.25', '2.5']);
      expect(Object.values(result.totals).map(String)).toEqual([
        '3.75',
        '4.125',
      ]);
      expect(result.values[0]).toBeInstanceOf(Decimal);
      expect(result.totals['first']).toBeInstanceOf(Decimal);
    });

    it('uses serialized property names and leaves unknown properties unchanged', () => {
      const createdAt = '2024-01-02T03:04:05Z';
      const value = {
        created_at: createdAt,
        untouched: '123.45',
      };
      const schema = {
        kind: 'object',
        properties: {
          createdAt: {
            serializedName: 'created_at',
            schema: { kind: 'instant' },
          },
        },
      };

      const result = transformJson<
        { createdAt: Temporal.Instant; untouched: string }
      >(value, schema);

      expect(result).toBe(value);
      expect(result.createdAt).toBeInstanceOf(Temporal.Instant);
      expect(result).not.toHaveProperty('created_at');
      expect(result.untouched).toBe('123.45');
    });

    it('returns transformed array roots while retaining the container', () => {
      const value = ['1.1', '2.2'];
      const transform = createJsonTransformer<Decimal[]>({
        kind: 'array',
        items: { kind: 'decimal' },
      });

      const result = transform(value);

      expect(result).toBe(value);
      expect(result.every(Decimal.isDecimal)).toBe(true);
    });
  });

  describe('references and recursive values', () => {
    it('resolves references from object registries', () => {
      const value = { amount: '123.45' };
      const registry = {
        Money: object({ amount: { kind: 'decimal' } }),
      };

      transformJson(value, { kind: 'reference', typeName: 'Money' }, registry);

      expect(value.amount).toBeInstanceOf(Decimal);
    });

    it('integrates with schema builders and lazy TypeRegistry entries', () => {
      interface Money {
        amount: Decimal;
      }

      const registry = defineTypeRegistry({
        Money: () =>
          runtimeSchema.object<Money>({
            amount: runtimeSchema.property(
              runtimeSchema.decimal<Decimal>('string'),
            ),
          }),
      });
      const value = { amount: '123.456' };

      const result = transformJson<Money>(
        value,
        runtimeSchema.reference<Money>('Money'),
        registry,
      );

      expect(result).toBe(value);
      expect(result.amount).toBeInstanceOf(Decimal);
      expect(result.amount.toString()).toBe('123.456');
    });

    it('handles circular schemas and data using object-schema pairs', () => {
      const nodeSchema = object({
        amount: { kind: 'decimal' },
        next: {
          kind: 'nullable',
          schema: { kind: 'reference', typeName: 'Node' },
        },
      });
      const registry = new Map([['Node', nodeSchema]]);
      const value: { amount: unknown; next?: unknown } = { amount: '1.5' };
      value.next = value;

      expect(() =>
        transformJson(value, { kind: 'reference', typeName: 'Node' }, registry),
      ).not.toThrow();
      expect(value.amount).toBeInstanceOf(Decimal);
      expect(value.next).toBe(value);
    });

    it('preserves missing references in tolerant mode and rejects them in strict mode', () => {
      const value = { amount: '1.5' };
      const schema = { kind: 'reference', typeName: 'Missing' };

      expect(transformJson(value, schema)).toBe(value);
      expect(() =>
        transformJson(value, schema, undefined, { strict: true }),
      ).toThrow('Schema reference "Missing" was not found at $');
    });
  });

  describe('polymorphism and customization', () => {
    it('selects string and numeric discriminated union variants', () => {
      const stringValue = { kind: 'money', amount: '42.125' };
      const numericValue = {
        type: 7,
        at: '2024-01-02T03:04:05Z',
      };
      const stringSchema = {
        kind: 'discriminated-union',
        discriminator: 'kind',
        variants: {
          money: object({
            kind: { kind: 'literal', value: 'money' },
            amount: { kind: 'decimal' },
          }),
        },
      };
      const numericSchema = {
        kind: 'discriminated-union',
        discriminator: 'type',
        variants: new Map([
          [
            7,
            object({
              type: { kind: 'literal', value: 7 },
              at: { kind: 'temporal', type: 'instant' },
            }),
          ],
        ]),
      };

      transformJson(stringValue, stringSchema);
      transformJson(numericValue, numericSchema);

      expect(stringValue.amount).toBeInstanceOf(Decimal);
      expect(numericValue.at).toBeInstanceOf(Temporal.Instant);
    });

    it('uses custom transformer functions from options', () => {
      const value = 'abc';

      const result = transformJson<string>(
        value,
        { kind: 'custom', name: 'uppercase' },
        undefined,
        {
          transformers: new Map([
            ['uppercase', (input: unknown) => String(input).toUpperCase()],
          ]),
        },
      );

      expect(result).toBe('ABC');
    });

    it('provides custom schema options to transformers', () => {
      const result = transformJson<string>(
        'value',
        runtimeSchema.custom<string, { suffix: string }>('suffix', {
          suffix: '!',
        }),
        undefined,
        {
          transformers: {
            suffix: (value, context) =>
              `${String(value)}${(context.options as { suffix: string }).suffix}`,
          },
        },
      );

      expect(result).toBe('value!');
    });

    it('uses RuntimeTransformer objects from the schema registry', () => {
      const registry = {
        transformers: {
          nested: {
            transform: (
              value: unknown,
              context: { transform(value: unknown, schema: unknown): unknown },
            ) => context.transform(value, { kind: 'decimal' }),
          },
        },
      };

      const result = transformJson<Decimal>(
        '12.125',
        { kind: 'adapter', name: 'nested' },
        registry,
      );

      expect(result).toBeInstanceOf(Decimal);
      expect(result.toString()).toBe('12.125');
    });
  });

  describe('failure and safety behavior', () => {
    it.each([
      ['decimal', { kind: 'decimal' }],
      ['not-a-uuid', { kind: 'uuid' }],
      ['not-a-date', { kind: 'temporal', type: 'plainDate' }],
      [123, { kind: 'array', element: 'string' }],
      [[], object({ value: 'string' })],
      ['wrong', { kind: 'literal', value: 'right' }],
    ])('preserves invalid tolerant value %p', (value, schema) => {
      expect(transformJson(value, schema)).toBe(value);
    });

    it('throws strict errors with the failing property path', () => {
      const value = {
        orders: [{ total: 'not-a-decimal' }],
      };
      const schema = object({
        orders: {
          kind: 'array',
          items: object({ total: { kind: 'decimal' } }),
        },
      });

      let error: unknown;
      try {
        transformJson(value, schema, undefined, { mode: 'strict' });
      } catch (caught) {
        error = caught;
      }

      expect(error).toBeInstanceOf(JsonTransformationError);
      expect((error as JsonTransformationError).path).toBe('$.orders[0].total');
    });

    it('does not traverse dangerous keys', () => {
      const value = JSON.parse(
        '{"safe":"1.5","__proto__":"2.5","constructor":"3.5","prototype":"4.5"}',
      ) as Record<string, unknown>;
      const schema = object(
        Object.fromEntries([
          ['safe', { kind: 'decimal' }],
          ['__proto__', { kind: 'decimal' }],
          ['constructor', { kind: 'decimal' }],
          ['prototype', { kind: 'decimal' }],
        ]),
      );

      transformJson(value, schema);

      expect(value['safe']).toBeInstanceOf(Decimal);
      expect(value['__proto__']).toBe('2.5');
      expect(value['constructor']).toBe('3.5');
      expect(value['prototype']).toBe('4.5');
    });

    it('applies the configured depth limit in tolerant and strict modes', () => {
      const nodeSchema = object({
        amount: { kind: 'decimal' },
        child: {
          kind: 'nullable',
          schema: { kind: 'reference', typeName: 'Node' },
        },
      });
      const registry = { Node: nodeSchema };
      const value = {
        amount: '1',
        child: {
          amount: '2',
          child: {
            amount: '3',
            child: null,
          },
        },
      };

      transformJson(value, nodeSchema, registry, { maxDepth: 1 });

      expect(value.amount).toBeInstanceOf(Decimal);
      expect(value.child.amount).toBe('2');
      expect(() =>
        transformJson(
          {
            amount: '1',
            child: { amount: '2', child: null },
          },
          nodeSchema,
          registry,
          { maxDepth: 1, mode: 'strict' },
        ),
      ).toThrow('Maximum transformation depth of 1 exceeded at $.child.amount');
    });

    it('uses a default maximum depth of 100', () => {
      const nodeSchema = object({
        amount: { kind: 'decimal' },
        child: {
          kind: 'nullable',
          schema: { kind: 'reference', typeName: 'Node' },
        },
      });
      const registry = { Node: nodeSchema };
      const value: {
        amount: unknown;
        child: { amount: unknown; child: unknown } | null;
      } = { amount: '0', child: null };
      let current = value;

      for (let index = 1; index <= 101; index += 1) {
        const child = { amount: String(index), child: null };
        current.child = child;
        current = child;
      }

      transformJson(value, nodeSchema, registry);

      expect(value.amount).toBeInstanceOf(Decimal);
      expect(current.amount).toBe('101');
    });

    it('preserves values when custom transformers throw in tolerant mode', () => {
      const value = 'original';
      const options = {
        transformers: {
          failing: () => {
            throw new Error('failure');
          },
        },
      };

      expect(
        transformJson(
          value,
          { kind: 'custom', name: 'failing' },
          undefined,
          options,
        ),
      ).toBe(value);
      expect(() =>
        transformJson(value, { kind: 'custom', name: 'failing' }, undefined, {
          ...options,
          strict: true,
        }),
      ).toThrow('Custom transformer "failing" failed at $');
    });
  });

  describe('date backend selection', () => {
    it('uses the built-in Temporal backend by default', () => {
      const result = transformJson('2024-01-02T03:04:05Z', {
        kind: 'instant',
      });

      expect(result).toBeInstanceOf(Temporal.Instant);
    });

    it('exposes the built-in temporalDateBackend constant', () => {
      expect(temporalDateBackend.name).toBe('temporal');
      expect(temporalDateBackend.codecs.instant).toBeDefined();
      expect(temporalDateBackend.codecs['plain-date']).toBeDefined();
    });

    it('uses a custom date backend when provided', () => {
      const customBackend: DateBackend = {
        name: 'custom',
        codecs: {
          instant: {
            is(value: unknown): value is string {
              return typeof value === 'string' && value.startsWith('T:');
            },
            parse(value: string) {
              return `T:${value}`;
            },
            serialize(value: string) {
              return value.slice(2);
            },
          },
        },
      };

      const result = transformJson<string>(
        '2024-01-02T03:04:05Z',
        { kind: 'instant' },
        undefined,
        { dateBackend: customBackend },
      );

      expect(result).toBe('T:2024-01-02T03:04:05Z');
    });

    it('preserves values for unsupported kinds in tolerant mode', () => {
      const partialBackend: DateBackend = {
        name: 'partial',
        codecs: {
          instant: temporalDateBackend.codecs.instant,
        },
      };
      const value = '2024-01-02';

      const result = transformJson(value, { kind: 'plain-date' }, undefined, {
        dateBackend: partialBackend,
      });

      expect(result).toBe(value);
    });

    it('throws for unsupported kinds in strict mode', () => {
      const partialBackend: DateBackend = {
        name: 'partial',
        codecs: {
          instant: temporalDateBackend.codecs.instant,
        },
      };

      expect(() =>
        transformJson(
          '2024-01-02',
          { kind: 'plain-date' },
          undefined,
          { dateBackend: partialBackend, strict: true },
        ),
      ).toThrow('does not support plain-date');
    });
  });
});
