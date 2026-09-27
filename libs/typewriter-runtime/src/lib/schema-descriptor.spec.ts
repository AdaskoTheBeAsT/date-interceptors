import { schema } from '@adaskothebeast/typewriter-schema';
import { Temporal } from '@js-temporal/polyfill';
import Decimal from 'decimal.js';
import { parse as parseUuid, v4 as uuidV4, v7 as uuidV7 } from 'uuid';

import {
  JsonSerializationError,
  JsonTransformationError,
  serializeJson,
  temporalDateBackend,
  transformJson,
  withStrictDefault,
} from '../index';
import type {
  JsonTransformerOptions,
  JsonTransformerRegistry,
  RuntimeSerializerContext,
  RuntimeTransformerContext,
  SchemaDescriptor,
} from '../index';

const uuid4 = '550e8400-e29b-41d4-a716-446655440000';
const decimalString = { kind: 'decimal', wireType: 'string' };

function describeValue(value: unknown): unknown {
  if (Decimal.isDecimal(value)) {
    return `Decimal(${value.toString()})`;
  }
  if (value instanceof Uint8Array) {
    return `Bytes(${Array.from(value).join(',')})`;
  }
  if (Array.isArray(value)) {
    return value.map(describeValue);
  }
  if (typeof value === 'object' && value !== null) {
    const tag = (value as { [Symbol.toStringTag]?: unknown })[
      Symbol.toStringTag
    ];
    if (typeof tag === 'string' && tag.startsWith('Temporal.')) {
      return `${tag}(${String(value)})`;
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, describeValue(item)]),
    );
  }
  return value;
}

const registry = {
  schemas: {
    Money: schema.object({
      amount: schema.property(schema.decimal('string')),
    }),
  },
  serializers: {
    upper: (value: unknown) => String(value).toLowerCase(),
  },
  transformers: {
    upper: (value: unknown) => String(value).toUpperCase(),
  },
} satisfies JsonTransformerRegistry;

const roundTripCases: [string, SchemaDescriptor | string, unknown][] = [
  ['string kind', { kind: 'string' }, 'text'],
  ['string shorthand', 'string', 'text'],
  ['legacy type field', { type: 'number' } as never, 42],
  ['boolean', { kind: 'boolean' }, true],
  ['unknown', { kind: 'unknown' }, { any: ['thing'] }],
  ['any', { kind: 'any' }, 'value'],
  ['named primitive', { kind: 'primitive', name: 'boolean' }, false],
  ['primitive property', { kind: 'primitive', primitive: 'string' }, 'x'],
  ['null primitive name', { kind: 'primitive', name: 'null' }, null],
  ['null kind', { kind: 'null' }, null],
  ['literal', { kind: 'literal', value: 'ready' }, 'ready'],
  ['decimal string', decimalString, '12345678901234567890.123456789'],
  ['decimal number', { kind: 'decimal', wireType: 'number' }, 12.5],
  ['decimal.js alias', { kind: 'decimal.js' }, '1.25'],
  ['uuid', { kind: 'uuid' }, uuid4],
  ['uuid version array', { kind: 'uuid', versions: [4] }, uuid4],
  ['uuid version set', { kind: 'uuid', versions: new Set([4]) }, uuid4],
  ['uuid version string', { kind: 'uuid', version: 'v4' }, uuid4],
  ['uuid-bytes alias', { kind: 'uuid-bytes', allowedVersions: [4] }, uuid4],
  ['instant', { kind: 'instant' }, '2024-01-02T03:04:05.123456789Z'],
  ['temporal-prefixed kind', { kind: 'temporal-plain-date' }, '2024-01-02'],
  [
    'named temporal type',
    { kind: 'temporal', temporalType: 'plainTime' },
    '03:04:05',
  ],
  ['temporal type field', { kind: 'temporal', type: 'duration' }, 'PT1H'],
  ['period', { kind: 'period' }, 'P1Y2M'],
  ['nullable null', { kind: 'nullable', schema: decimalString }, null],
  ['nullable inner', { kind: 'nullable', inner: decimalString }, '1.5'],
  ['nullable of', { kind: 'nullable', of: decimalString }, '1.5'],
  ['nullable wrapped', { kind: 'nullable', wrapped: decimalString }, '1.5'],
  ['optional value', { kind: 'optional', value: decimalString }, '1.5'],
  ['array items', { kind: 'array', items: decimalString }, ['1', '2']],
  ['array element', { kind: 'array', element: { kind: 'uuid' } }, [uuid4]],
  ['array elementType', { kind: 'array', elementType: 'number' }, [1, 2]],
  ['list item', { kind: 'list', item: decimalString }, ['3']],
  ['array of', { kind: 'array', of: decimalString }, ['4']],
  ['record values', { kind: 'record', values: decimalString }, { a: '1' }],
  ['record value', { kind: 'record', value: decimalString }, { b: '2' }],
  [
    'dictionary valueType',
    { kind: 'dictionary', valueType: decimalString },
    { c: '3' },
  ],
  ['record element', { kind: 'record', element: decimalString }, { d: '4' }],
  ['record of', { kind: 'record', of: decimalString }, { e: '5' }],
  [
    'object properties with metadata',
    {
      kind: 'object',
      properties: {
        amount: { schema: decimalString, serializedName: 'total' },
        label: { descriptor: { kind: 'string' }, jsonName: 'text' },
        code: { type: { kind: 'string' }, wireName: 'code_value' },
        raw: decimalString,
      },
    },
    { total: '1.5', text: 'a', code_value: 'b', raw: '2.5', extra: true },
  ],
  [
    'object field array',
    {
      kind: 'object',
      fields: [
        { name: 'amount', serializedName: 'total', schema: decimalString },
        { propertyName: 'label', jsonName: 'text', descriptor: 'string' },
        { key: 'id', wireName: 'identifier', value: { kind: 'uuid' } },
        { name: 'count', valueType: 'number' },
        { name: 'flag', type: 'boolean' },
      ],
    },
    { total: '1.5', text: 'a', identifier: uuid4, count: 2, flag: true },
  ],
  [
    'struct shape',
    { kind: 'struct', shape: { amount: decimalString } },
    { amount: '9' },
  ],
  [
    'reference typeName',
    { kind: 'reference', typeName: 'Money' },
    { amount: '1' },
  ],
  ['reference name', { kind: 'ref', name: 'Money' }, { amount: '1' }],
  ['reference ref', { kind: 'ref', ref: 'Money' }, { amount: '1' }],
  ['reference key', { kind: 'ref', key: 'Money' }, { amount: '1' }],
  ['reference target name', { kind: 'ref', target: 'Money' }, { amount: '1' }],
  ['reference target', { kind: 'ref', target: decimalString }, '1.5'],
  ['reference schema', { kind: 'ref', schema: decimalString }, '1.5'],
  ['reference descriptor', { kind: 'ref', descriptor: decimalString }, '1.5'],
  ['custom by name', { kind: 'custom', name: 'upper' }, 'text'],
  ['custom adapter name', { kind: 'custom', adapter: 'upper' }, 'text'],
  ['custom key', { kind: 'adapter', key: 'upper' }, 'text'],
  [
    'custom inline functions',
    {
      kind: 'custom',
      transform: (value: unknown) => Number(value),
      serialize: (value: unknown) => String(value),
    },
    '42',
  ],
  [
    'custom inline codec objects',
    {
      kind: 'custom',
      transformer: { transform: (value: unknown) => Number(value) },
      serializer: { serialize: (value: unknown) => String(value) },
    },
    '7',
  ],
  [
    'custom adapter codec',
    {
      kind: 'custom',
      adapter: {
        transform: (value: unknown) => new Decimal(value as string),
        serialize: (value: unknown) => (value as Decimal).toFixed(),
      },
    },
    '8.5',
  ],
  [
    'union variant record',
    {
      kind: 'discriminated-union',
      discriminator: 'type',
      variants: {
        money: {
          kind: 'object',
          properties: { type: 'string', amount: decimalString },
        },
      },
    },
    { type: 'money', amount: '1.5' },
  ],
  [
    'union variant map',
    {
      kind: 'tagged-union',
      tag: 'type',
      mapping: new Map([
        [7, { kind: 'object', properties: { at: { kind: 'instant' } } }],
      ]),
    },
    { type: 7, at: '2024-01-02T03:04:05Z' },
  ],
  [
    'union variant array',
    {
      kind: 'discriminated-union',
      discriminatorProperty: 'type',
      members: [
        { value: 'first', schema: { kind: 'unknown' } },
        {
          tag: 'second',
          descriptor: {
            kind: 'object',
            properties: { amount: decimalString },
          },
        },
        {
          discriminator: 'third',
          type: { kind: 'object', properties: { id: { kind: 'uuid' } } },
        },
        { key: 4, schema: { kind: 'object', properties: {} } },
      ],
    },
    { type: 'third', id: uuid4 },
  ],
  [
    'union renamed discriminator',
    {
      kind: 'discriminated-union',
      discriminator: { name: 'kind', serializedName: '$type' },
      variants: [
        {
          value: 'money',
          schema: {
            kind: 'object',
            properties: {
              kind: { schema: 'string', serializedName: '$type' },
              amount: { schema: decimalString },
            },
          },
        },
      ],
    },
    { $type: 'money', amount: '2.5' },
  ],
  [
    'union discriminator jsonName',
    {
      kind: 'discriminated-union',
      discriminator: { property: 'kind', jsonName: 'k' },
      variants: {
        a: {
          kind: 'object',
          properties: { kind: { schema: 'string', jsonName: 'k' } },
        },
      },
    },
    { k: 'a' },
  ],
];

describe('descriptor round trips', () => {
  it.each(roundTripCases)(
    'round-trips %s from wire to model and back',
    (_label, descriptor, wire) => {
      const options = { strict: true } as const;
      const model = transformJson(
        structuredClone(wire),
        descriptor as SchemaDescriptor,
        registry,
        options,
      );
      expect(
        serializeJson(model, descriptor as SchemaDescriptor, registry, options),
      ).toEqual(wire);
    },
  );

  it.each(roundTripCases)(
    'round-trips %s from model to wire and back',
    (_label, descriptor, wire) => {
      const options = { strict: true } as const;
      const model = transformJson(
        structuredClone(wire),
        descriptor as SchemaDescriptor,
        registry,
        options,
      );
      const snapshot = describeValue(model);
      const serialized = serializeJson(
        model,
        descriptor as SchemaDescriptor,
        registry,
        options,
      );
      const hydrated = transformJson(
        serialized,
        descriptor as SchemaDescriptor,
        registry,
        options,
      );
      expect(describeValue(hydrated)).toEqual(snapshot);
      expect(describeValue(model)).toEqual(snapshot);
    },
  );

  it('hydrates rich values for representative shapes', () => {
    const model = transformJson<{
      amount: Decimal;
      label: string;
      id: Uint8Array;
    }>(
      { total: '1.5', text: 'a', identifier: uuid4, count: 2, flag: true },
      roundTripCases.find(
        ([label]) => label === 'object field array',
      )?.[1] as never,
      undefined,
      { strict: true },
    );
    expect(model.amount).toBeInstanceOf(Decimal);
    expect(model.id).toEqual(parseUuid(uuid4));
    expect(model).not.toHaveProperty('total');
  });

  it.each([
    [{ kind: 'void' }, undefined],
    [{ kind: 'primitive', name: 'void' }, undefined],
    [{ kind: 'primitive', name: 'undefined' }, undefined],
    [{ kind: 'primitive' }, 'anything'],
    [{ kind: 'object-primitive' }, 1],
  ])('accepts %p for %p in both directions', (descriptor, value) => {
    for (const convert of [transformJson, serializeJson]) {
      expect(convert(value, descriptor, undefined, { strict: true })).toBe(
        value,
      );
    }
  });

  it.each([
    [{ kind: 'primitive', name: 'null' }, 'x', 'Expected null'],
    [{ kind: 'primitive', name: 'void' }, 'x', 'Expected undefined'],
    [{ kind: 'never' }, 'x', 'Expected never'],
    [{ kind: 'array', items: 'string' }, [42], 'Expected string at $[0]'],
    [{ kind: 'temporal', type: 'unknown' }, 'x', 'Unknown Temporal type'],
    [42, 'x', 'Unknown schema descriptor'],
  ])('rejects mismatches for %p', (descriptor, value, message) => {
    expect(() =>
      transformJson(value, descriptor as never, undefined, { strict: true }),
    ).toThrow(message);
    expect(() =>
      serializeJson(value, descriptor as never, undefined, { strict: true }),
    ).toThrow(message);
  });
});

describe('custom codec context', () => {
  it('reports nested paths and descends one level per nested call', () => {
    const paths: string[] = [];
    const transformer = (
      value: unknown,
      context: RuntimeTransformerContext,
    ): unknown => {
      paths.push(context.path);
      return {
        amount: context.transform(
          (value as { amount: unknown }).amount,
          decimalString,
          'amount',
        ),
      };
    };
    const descriptor = schema.object({
      items: schema.property(schema.array(schema.custom('wrap'))),
    });
    let error: unknown;
    try {
      transformJson({ items: [{ amount: 'bad' }] }, descriptor, undefined, {
        strict: true,
        transformers: { wrap: transformer },
      });
    } catch (caught) {
      error = caught;
    }
    expect(paths).toEqual(['$.items[0]']);
    expect(error).toBeInstanceOf(JsonTransformationError);
    expect((error as JsonTransformationError).path).toBe('$.items[0].amount');

    const serializerPaths: string[] = [];
    expect(() =>
      serializeJson({ items: [{ amount: 'bad' }] }, descriptor, undefined, {
        strict: true,
        serializers: {
          wrap: (value: unknown, context: RuntimeSerializerContext) => {
            serializerPaths.push(context.path);
            return context.serialize(
              (value as { amount: unknown }).amount,
              decimalString,
              'amount',
            );
          },
        },
      }),
    ).toThrow(
      expect.objectContaining({
        name: 'JsonSerializationError',
        path: '$.items[0].amount',
      }),
    );
    expect(serializerPaths).toEqual(['$.items[0]']);
  });

  it('keeps the current path when no segment is supplied', () => {
    expect(() =>
      transformJson('bad', schema.custom('same'), undefined, {
        strict: true,
        transformers: {
          same: (value, context) => context.transform(value, decimalString),
        },
      }),
    ).toThrow(/^Invalid decimal value at \$$/u);
  });

  it('applies maxDepth to recursive custom codecs', () => {
    const recursive = schema.custom('recursive');
    expect(() =>
      transformJson('value', recursive, undefined, {
        strict: true,
        maxDepth: 5,
        transformers: {
          recursive: (value, context) =>
            context.transform(String(value), recursive, 'next'),
        },
      }),
    ).toThrow('Maximum transformation depth of 5 exceeded');
    expect(() =>
      serializeJson('value', recursive, undefined, {
        strict: true,
        maxDepth: 5,
        serializers: {
          recursive: (value, context) =>
            context.serialize(String(value), recursive, 'next'),
        },
      }),
    ).toThrow('Maximum serialization depth of 5 exceeded');
  });

  it('does not report data cycles through custom codecs as schema cycles', () => {
    const node = schema.custom('node');
    const value: { next?: unknown } = {};
    value.next = value;
    let error: unknown;
    try {
      serializeJson(value, node, undefined, {
        strict: true,
        maxDepth: 10,
        serializers: {
          node: (input, context) => ({
            next: context.serialize(
              (input as { next: unknown }).next,
              node,
              'next',
            ),
          }),
        },
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(JsonSerializationError);
    expect((error as Error).message).toContain('Maximum serialization depth');
    expect((error as Error).message).not.toContain('Circular schema');
  });
});

describe('descriptor caching', () => {
  it('normalizes a descriptor once for many values', () => {
    let reads = 0;
    const items = {
      get kind(): string {
        reads += 1;
        return 'string';
      },
    };
    const descriptor = { kind: 'array', items } as SchemaDescriptor;
    transformJson(['a', 'b', 'c'], descriptor, undefined, { strict: true });
    serializeJson(['a', 'b', 'c'], descriptor, undefined, { strict: true });
    expect(reads).toBe(1);
  });

  it('calls lazy schema factories once', () => {
    const factory = jest.fn(() => schema.decimal('string'));
    const descriptor = {
      kind: 'array',
      items: factory,
    } as unknown as SchemaDescriptor;
    transformJson(['1', '2', '3'], descriptor);
    transformJson(['4'], descriptor);
    expect(factory).toHaveBeenCalledTimes(1);
  });
});

describe('binary serialization safety', () => {
  it('never preserves binary values in tolerant mode', () => {
    expect(() => serializeJson(new Uint8Array(15), { kind: 'uuid' })).toThrow(
      JsonSerializationError,
    );
    expect(() => serializeJson(new Uint8Array(16), { kind: 'string' })).toThrow(
      'Expected string at $',
    );
  });

  it('encodes a disallowed UUID version instead of preserving bytes', () => {
    const value = uuidV7();
    expect(
      serializeJson(parseUuid(value), { kind: 'uuid', versions: [4] }),
    ).toBe(value);
    expect(() =>
      serializeJson(
        parseUuid(value),
        { kind: 'uuid', versions: [4] },
        undefined,
        { strict: true },
      ),
    ).toThrow('UUID version 7 is not allowed');
  });

  it('serializes valid UUID bytes and strings', () => {
    const value = uuidV4();
    expect(serializeJson(parseUuid(value), { kind: 'uuid' })).toBe(value);
    expect(serializeJson(value, { kind: 'uuid' })).toBe(value);
  });
});

describe('Temporal brand checks', () => {
  it('recognizes Temporal values from another polyfill copy', async () => {
    let foreign: typeof Temporal | undefined;
    await jest.isolateModulesAsync(async () => {
      foreign = (await import('@js-temporal/polyfill')).Temporal;
    });
    if (foreign === undefined) throw new Error('Polyfill was not loaded');
    const instant = foreign.Instant.from('2024-01-02T03:04:05Z');
    expect(instant).not.toBeInstanceOf(Temporal.Instant);
    expect(temporalDateBackend.codecs.instant.is(instant)).toBe(true);
    expect(serializeJson(instant, { kind: 'instant' })).toBe(
      '2024-01-02T03:04:05Z',
    );
    expect(transformJson(instant, { kind: 'instant' })).toBe(instant);
    expect(
      temporalDateBackend.codecs.period.is(foreign.Duration.from('P1D')),
    ).toBe(true);
  });

  it('recognizes branded native-style values and rejects other brands', () => {
    const native = {
      [Symbol.toStringTag]: 'Temporal.PlainDate',
      toString: () => '2024-01-02',
    };
    expect(temporalDateBackend.codecs['plain-date'].is(native)).toBe(true);
    expect(temporalDateBackend.codecs.instant.is(native)).toBe(false);
    expect(temporalDateBackend.codecs.instant.is(null)).toBe(false);
    expect(
      temporalDateBackend.codecs['plain-date'].is({
        [Symbol.toStringTag]: 'Temporal.PlainDate',
        toString: 'not callable',
      }),
    ).toBe(false);
    expect(serializeJson(native, { kind: 'plain-date' })).toBe('2024-01-02');
  });
});

describe('already hydrated and shared values', () => {
  it('keeps hydrated decimals and UUID bytes during transformation', () => {
    const amount = new Decimal('1.5');
    const id = parseUuid(uuid4);
    expect(
      transformJson(amount, decimalString, undefined, { strict: true }),
    ).toBe(amount);
    expect(
      transformJson(id, { kind: 'uuid' }, undefined, { strict: true }),
    ).toBe(id);
  });

  it('skips dangerous record keys in both directions', () => {
    const wire = JSON.parse('{"a":"1","__proto__":"2"}') as Record<
      string,
      unknown
    >;
    const descriptor = { kind: 'record', values: decimalString };
    const model = transformJson<Record<string, unknown>>(wire, descriptor);
    expect(model['a']).toBeInstanceOf(Decimal);
    expect(Object.getOwnPropertyDescriptor(model, '__proto__')?.value).toBe(
      '2',
    );
    expect(serializeJson(model, descriptor)).toEqual({ a: '1' });
  });

  it('reuses serialized arrays shared within one graph', () => {
    const shared = ['x'];
    const result = serializeJson(
      [shared, shared],
      schema.array(schema.array(schema.string())),
    ) as unknown[];
    expect(result[0]).toBe(result[1]);
    expect(result[0]).not.toBe(shared);
  });
});

describe('withStrictDefault', () => {
  it('defaults to strict unless strictness is chosen', () => {
    expect(withStrictDefault(undefined)).toEqual({ strict: true });
    expect(withStrictDefault<JsonTransformerOptions>({ maxDepth: 3 })).toEqual({
      maxDepth: 3,
      strict: true,
    });
    const tolerant = { strict: false };
    expect(withStrictDefault(tolerant)).toBe(tolerant);
    const legacy = { mode: 'tolerant' } as const;
    expect(withStrictDefault(legacy)).toBe(legacy);
    expect(withStrictDefault(undefined, false)).toEqual({ strict: false });
  });

  it('honors the deprecated mode option', () => {
    expect(() =>
      transformJson('x', { kind: 'number' }, undefined, { mode: 'strict' }),
    ).toThrow(JsonTransformationError);
    expect(
      transformJson('x', { kind: 'number' }, undefined, {
        mode: 'strict',
        strict: false,
      }),
    ).toBe('x');
  });
});
