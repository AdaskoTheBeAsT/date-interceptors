import { defineTypeRegistry, schema } from '@adaskothebeast/typewriter-schema';
import Decimal from 'decimal.js';

import {
  JsonSerializationError,
  JsonTransformationError,
  defineDateBackend,
  serializeJson,
  temporalDateBackend,
  transformJson,
} from '../index';
import type { JsonTransformerRegistry, SchemaDescriptor } from '../index';

const dateCases = [
  ['instant', '2024-02-29T12:34:56.123456789Z'],
  ['plain-date', '2024-02-29'],
  ['plain-time', '12:34:56.123456789'],
  ['plain-date-time', '2024-02-29T12:34:56.123456789'],
  ['zoned-date-time', '2024-02-29T12:34:56+01:00[Europe/Warsaw]'],
  ['duration', 'P1DT2H'],
  ['period', 'P1Y2M'],
  ['plain-year-month', '2024-02'],
  ['plain-month-day', '02-29'],
] as const;

describe('public date schema contracts', () => {
  it.each(dateCases)(
    'round-trips %s through direct and named descriptors',
    (kind, wire) => {
      const backend = defineDateBackend(temporalDateBackend);
      expect(backend).toBe(temporalDateBackend);
      for (const descriptor of [
        { kind },
        { kind: 'temporal', temporalType: kind },
      ]) {
        const value = transformJson(wire, descriptor, undefined, {
          strict: true,
        });
        expect(backend.codecs[kind].is(value)).toBe(true);
        expect(
          transformJson(value, descriptor, undefined, { strict: true }),
        ).toBe(value);
        const encoded = serializeJson(value, descriptor, undefined, {
          strict: true,
        });
        expect(encoded).toBe(backend.codecs[kind].serialize(value as never));
        expect(
          serializeJson(wire, descriptor, undefined, { strict: true }),
        ).toBe(wire);
      }
    },
  );

  it.each(dateCases)(
    'rejects invalid %s values with path-aware errors',
    (kind) => {
      for (const value of ['invalid', 42]) {
        expect(() =>
          transformJson(value, { kind }, undefined, { strict: true }),
        ).toThrow(JsonTransformationError);
        expect(() =>
          serializeJson(value, { kind }, undefined, { strict: true }),
        ).toThrow(JsonSerializationError);
        expect(transformJson(value, { kind })).toBe(value);
        expect(serializeJson(value, { kind })).toBe(value);
      }
    },
  );

  it('preserves codec serialization failures as causes', () => {
    const cause = new Error('backend failed');
    const backend = defineDateBackend({
      name: 'failing',
      codecs: {
        instant: {
          is: (value: unknown): value is Date => value instanceof Date,
          parse: () => {
            throw cause;
          },
          serialize: () => {
            throw cause;
          },
        },
      },
    });
    expect(() =>
      serializeJson(new Date(), schema.instant(), undefined, {
        strict: true,
        dateBackend: backend,
      }),
    ).toThrow(expect.objectContaining({ cause }));
    expect(() =>
      serializeJson('2024-01-01', schema.plainDate(), undefined, {
        strict: true,
        dateBackend: backend,
      }),
    ).toThrow('does not support plain-date');
  });
});

const invalidCases: [unknown, SchemaDescriptor][] = [
  ['x', { kind: 'null' }],
  ['x', { kind: 'undefined' }],
  ['x', { kind: 'void' }],
  [42, { kind: 'string' }],
  ['x', { kind: 'number' }],
  ['x', { kind: 'boolean' }],
  ['x', { kind: 'literal' }],
  ['x', { kind: 'literal', value: 'y' }],
  [[], { kind: 'array' }],
  ['x', { kind: 'array', items: schema.string() }],
  [{}, { kind: 'record' }],
  [[], { kind: 'record', values: schema.string() }],
  [{}, { kind: 'object' }],
  [[], { kind: 'object', properties: {} }],
  ['x', { kind: 'reference' }],
  ['x', { kind: 'reference', typeName: 'missing' }],
  ['x', { kind: 'custom' }],
  ['x', { kind: 'custom', name: 'missing' }],
  ['x', { kind: 'unrecognized' }],
  ['x', { kind: 'temporal', temporalType: 'unknown' }],
  ['not-a-number', { kind: 'decimal' }],
  [false, { kind: 'decimal' }],
  [Infinity, { kind: 'decimal', wireType: 'number' }],
  ['x', { kind: 'uuid' }],
  [new Uint8Array(15), { kind: 'uuid' }],
  ['x', { kind: 'discriminated-union', discriminator: 'tag', variants: {} }],
  [{}, { kind: 'discriminated-union', discriminator: 'tag', variants: {} }],
  [
    { tag: true },
    { kind: 'discriminated-union', discriminator: 'tag', variants: {} },
  ],
  [
    { tag: 'missing' },
    { kind: 'discriminated-union', discriminator: 'tag', variants: {} },
  ],
];

describe.each([
  ['transform', transformJson, JsonTransformationError],
  ['serialize', serializeJson, JsonSerializationError],
] as const)(
  '%s validation and compatibility',
  (_operation, convert, ErrorType) => {
    it.each(invalidCases)(
      'rejects invalid value %p for %p in strict mode',
      (value, descriptor) => {
        expect(() =>
          convert(value, descriptor, undefined, { strict: true }),
        ).toThrow(ErrorType);
        if (_operation === 'serialize' && value instanceof Uint8Array) {
          // Binary values are never preserved on the wire.
          expect(() => convert(value, descriptor)).toThrow(ErrorType);
        } else {
          expect(convert(value, descriptor)).toBe(value);
        }
      },
    );

    it.each([
      [null, { kind: 'null' }],
      [undefined, { kind: 'void' }],
      [undefined, { kind: 'optional', inner: schema.string() }],
      [null, { kind: 'nullable', of: schema.string() }],
      [true, { kind: 'primitive', primitive: 'boolean' }],
      ['x', { kind: 'any' }],
      ['x', { kind: 'unknown' }],
      [1n, { kind: 'bigint' }],
    ] as const)('preserves valid primitive %p', (value, descriptor) => {
      expect(convert(value, descriptor, undefined, { strict: true })).toBe(
        value,
      );
    });

    it.each([
      'resolve',
      'resolveSchema',
      'getSchema',
      'get',
      'schemas',
      'references',
      'types',
      'direct',
      'map',
    ])('resolves a schema through %s registries', (shape) => {
      const string = schema.string();
      const registry = (
        shape === 'map'
          ? new Map([['Text', string]])
          : shape === 'direct'
            ? { Text: string }
            : ['schemas', 'references', 'types'].includes(shape)
              ? { [shape]: { Text: string } }
              : {
                  [shape]: (name: string) =>
                    name === 'Text' ? string : undefined,
                }
      ) as JsonTransformerRegistry;
      expect(
        convert('value', schema.reference('Text'), registry, { strict: true }),
      ).toBe('value');
    });

    it('supports direct references, lazy descriptors, and nested error paths', () => {
      const lazy = (() => schema.string()) as unknown as SchemaDescriptor;
      expect(convert('value', lazy, undefined, { strict: true })).toBe('value');
      expect(
        convert('value', { kind: 'ref', target: schema.string() }, undefined, {
          strict: true,
        }),
      ).toBe('value');
      const badFactory = (() => {
        throw new Error('bad factory');
      }) as unknown as SchemaDescriptor;
      expect(() =>
        convert('value', badFactory, undefined, { strict: true }),
      ).toThrow('Unable to resolve schema');
      expect(convert('value', badFactory)).toBe('value');
      expect(() =>
        convert<unknown>(
          { 'odd.key': 42 },
          schema.object({
            'odd.key': schema.property(schema.string()),
          }),
          undefined,
          { strict: true },
        ),
      ).toThrow('$["odd.key"]');
    });
  },
);

describe('custom codecs and descriptor compatibility', () => {
  it.each(['transformers', 'customTransformers', 'registry'] as const)(
    'uses transformer objects from %s options',
    (key) => {
      expect(
        transformJson('text', schema.custom('upper'), undefined, {
          [key]: new Map([
            [
              'upper',
              { transform: (value: unknown) => String(value).toUpperCase() },
            ],
          ]),
        }),
      ).toBe('TEXT');
    },
  );

  it.each(['serializers', 'customSerializers', 'registry'] as const)(
    'uses serializer objects from %s options',
    (key) => {
      expect(
        serializeJson('TEXT', schema.custom('lower'), undefined, {
          [key]: new Map([
            [
              'lower',
              { serialize: (value: unknown) => String(value).toLowerCase() },
            ],
          ]),
        }),
      ).toBe('text');
    },
  );

  it('supports inline custom serializers and nested serialization', () => {
    const descriptor = {
      kind: 'custom',
      serialize: (
        value: unknown,
        context: {
          serialize(value: unknown, schema: SchemaDescriptor): unknown;
        },
      ) => context.serialize(value, schema.string()),
    };
    expect(
      serializeJson('value', descriptor, undefined, { strict: true }),
    ).toBe('value');
    expect(() =>
      serializeJson(42, descriptor, undefined, { strict: true }),
    ).toThrow(JsonSerializationError);
    const cause = new Error('custom failure');
    const broken = {
      kind: 'custom',
      serialize: () => {
        throw cause;
      },
    };
    expect(() =>
      serializeJson('value', broken, undefined, { strict: true }),
    ).toThrow(expect.objectContaining({ cause }));
    expect(serializeJson('value', broken)).toBe('value');
  });

  it.each(['resolveTransformer', 'getTransformer', 'transformers', 'adapters'])(
    'uses custom transformer functions from %s registry members',
    (name) => {
      const transform = () => 'converted';
      const registry = (
        name.endsWith('s')
          ? { [name]: { custom: transform } }
          : { [name]: () => transform }
      ) as JsonTransformerRegistry;
      expect(transformJson('value', schema.custom('custom'), registry)).toBe(
        'converted',
      );
    },
  );

  it.each(['resolveSerializer', 'getSerializer', 'serializers', 'adapters'])(
    'uses custom serializer functions from %s registry members',
    (name) => {
      const serialize = () => 'wire';
      const registry = (
        name.endsWith('s')
          ? { [name]: { custom: serialize } }
          : { [name]: () => serialize }
      ) as JsonTransformerRegistry;
      expect(serializeJson('value', schema.custom('custom'), registry)).toBe(
        'wire',
      );
    },
  );

  it.each(['get', 'direct', 'map'])(
    'uses codec objects from shared %s registry entries',
    (shape) => {
      const codec = { transform: () => 'converted', serialize: () => 'wire' };
      const registry: JsonTransformerRegistry =
        shape === 'map'
          ? new Map([['custom', codec]])
          : shape === 'direct'
            ? { custom: codec }
            : {
                get: (name: string) => (name === 'custom' ? codec : undefined),
              };
      expect(
        transformJson('value', schema.custom('custom'), registry, {
          strict: true,
        }),
      ).toBe('converted');
      expect(
        serializeJson('value', schema.custom('custom'), registry, {
          strict: true,
        }),
      ).toBe('wire');
    },
  );

  it.each(['direct', 'map', 'get'])(
    'does not call lazy schema factories from shared %s entries as codecs',
    (shape) => {
      const factory = jest.fn(() => schema.string());
      const registry: JsonTransformerRegistry =
        shape === 'map'
          ? new Map([['Money', factory]])
          : shape === 'direct'
            ? { Money: factory }
            : { get: () => factory };
      for (const convert of [transformJson, serializeJson]) {
        expect(() =>
          convert('value', schema.custom('Money'), registry, { strict: true }),
        ).toThrow('"Money" was not found');
      }
      expect(factory).not.toHaveBeenCalled();
      expect(
        transformJson('value', schema.reference('Money'), registry, {
          strict: true,
        }),
      ).toBe('value');
    },
  );

  it('keeps schema and codec lookups apart in one registry', () => {
    const registry: JsonTransformerRegistry = {
      Money: schema.object({
        amount: schema.property(schema.decimal('string')),
      }),
      transformers: { Money: () => 'converted' },
      serializers: { Money: () => 'wire' },
    } as JsonTransformerRegistry;
    expect(transformJson('value', schema.custom('Money'), registry)).toBe(
      'converted',
    );
    expect(serializeJson('value', schema.custom('Money'), registry)).toBe(
      'wire',
    );
    const model = transformJson<{ amount: Decimal }>(
      { amount: '1.5' },
      schema.reference('Money'),
      registry,
      { strict: true },
    );
    expect(model.amount).toBeInstanceOf(Decimal);
    const codecOnly: JsonTransformerRegistry = {
      Codec: { transform: () => 'x', serialize: () => 'y' },
    };
    expect(() =>
      transformJson('value', schema.reference('Codec'), codecOnly, {
        strict: true,
      }),
    ).toThrow('Schema reference "Codec" was not found');
  });

  it.each(['toString', 'valueOf', 'constructor', 'hasOwnProperty'])(
    'never resolves inherited %s members from registries',
    (name) => {
      for (const registry of [{}, { schemas: {} }, { transformers: {} }]) {
        expect(() =>
          transformJson('value', schema.reference(name), registry, {
            strict: true,
          }),
        ).toThrow(`Schema reference "${name}" was not found`);
        expect(() =>
          transformJson('value', schema.custom(name), registry, {
            strict: true,
            transformers: {},
          }),
        ).toThrow(`Custom transformer "${name}" was not found`);
        expect(() =>
          serializeJson('value', schema.custom(name), registry, {
            strict: true,
            serializers: {},
          }),
        ).toThrow(`Custom serializer "${name}" was not found`);
      }
    },
  );

  it.each(['has', 'register', 'get', 'definitions'])(
    'does not resolve TypeRegistry members such as %s as schemas',
    (name) => {
      const registry = defineTypeRegistry({ Text: schema.string() });
      expect(() =>
        transformJson('value', schema.reference(name), registry, {
          strict: true,
        }),
      ).toThrow(`Schema reference "${name}" was not found`);
      expect(() =>
        serializeJson('value', schema.reference(name), registry, {
          strict: true,
        }),
      ).toThrow(`Schema reference "${name}" was not found`);
      expect(() =>
        transformJson('value', schema.custom(name), registry, {
          strict: true,
        }),
      ).toThrow(`Custom transformer "${name}" was not found`);
    },
  );

  it('ignores inherited union variant names', () => {
    const union = schema.discriminatedUnion('tag', {
      known: schema.object({ tag: schema.property(schema.string()) }),
    });
    for (const convert of [transformJson, serializeJson]) {
      expect(() =>
        convert({ tag: 'toString' }, union, undefined, { strict: true }),
      ).toThrow('No discriminated union variant for "toString"');
    }
  });

  it.each([transformJson, serializeJson])(
    'handles lazy cycles, depth limits, and numeric UUID restrictions',
    (convert) => {
      const lazy: () => unknown = () => lazy;
      expect(() =>
        convert('value', lazy as unknown as SchemaDescriptor, undefined, {
          strict: true,
        }),
      ).toThrow('Unable to resolve schema');
      const nested = schema.array(schema.array(schema.string()));
      expect(() =>
        convert([['value']], nested, undefined, { maxDepth: 0, strict: true }),
      ).toThrow('Maximum');
      expect(convert([['value']], nested, undefined, { maxDepth: 0 })).toEqual([
        ['value'],
      ]);
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(
        convert(uuid, { kind: 'uuid', version: 'v4' }, undefined, {
          strict: true,
        }),
      ).toBeDefined();
      expect(() =>
        convert(
          uuid,
          { kind: 'uuid', allowedVersions: ['invalid', 7] },
          undefined,
          { strict: true },
        ),
      ).toThrow('UUID version 4 is not allowed');
      const descriptor = { type: 'string' } as unknown as SchemaDescriptor;
      expect(convert('value', descriptor, undefined, { strict: true })).toBe(
        'value',
      );
      expect(
        convert(
          {},
          { kind: 'object', properties: { ignored: { schema: undefined } } },
        ),
      ).toEqual({});
      expect(() =>
        convert({}, { kind: 'object', properties: 42 }, undefined, {
          strict: true,
        }),
      ).toThrow();
      expect(
        String(
          convert('12.5', { kind: 'decimal' }, undefined, { strict: true }),
        ),
      ).toBe('12.5');
      expect(
        String(
          convert(12.5, { kind: 'decimal', wireType: 'number' }, undefined, {
            strict: true,
          }),
        ),
      ).toBe('12.5');
    },
  );

  it('supports generated property arrays and union variant arrays during hydration', () => {
    const descriptor = {
      kind: 'object',
      fields: [
        {
          name: 'amount',
          serializedName: 'total',
          schema: schema.decimal('string'),
        },
        { key: 'label', type: schema.string() },
        {},
      ],
    };
    const model = transformJson(
      { total: '12.5', label: 'value' },
      descriptor,
      undefined,
      { strict: true },
    );
    expect(model).toEqual({ amount: new Decimal('12.5'), label: 'value' });
    const union = {
      kind: 'discriminated-union',
      discriminator: { property: 'tag' },
      variants: [
        { value: 'other', schema: schema.unknown() },
        { value: 'invoice', schema: descriptor },
      ],
    };
    expect(
      transformJson(
        { tag: 'invoice', total: '12.5', label: 'value' },
        union,
        undefined,
        { strict: true },
      ),
    ).toEqual({ tag: 'invoice', amount: new Decimal('12.5'), label: 'value' });
    expect(() =>
      transformJson({ tag: 'missing' }, union, undefined, { strict: true }),
    ).toThrow('No discriminated union variant');
  });

  it('serializes shared records and numeric discriminator maps', () => {
    const record = schema.record(schema.string());
    const shared = { label: 'value' };
    const result = serializeJson(
      [shared, shared],
      schema.array(record),
    ) as unknown[];
    expect(result[0]).toBe(result[1]);
    const union = {
      kind: 'discriminated-union',
      discriminator: { name: 'tag' },
      variants: new Map([
        ['7', schema.object({ tag: schema.property(schema.literal(7)) })],
      ]),
    };
    expect(
      serializeJson({ tag: 7 }, union, undefined, { strict: true }),
    ).toEqual({ tag: 7 });
  });
});

describe('generated round trips', () => {
  const descriptor = schema.object({
    id: schema.property(schema.number()),
    amount: schema.property(schema.decimal<Decimal>('string')),
    title: schema.property(schema.optional(schema.string()), 'display_title'),
    tags: schema.property(schema.array(schema.nullable(schema.string()))),
    flags: schema.property(schema.record(schema.boolean())),
  });
  it.each(Array.from({ length: 32 }, (_, seed) => seed))(
    'preserves the wire contract for case %s',
    (seed) => {
      const wire = {
        id: seed,
        amount: `${seed + 1}.1234567890123456789`,
        ...(seed % 2 ? { display_title: `title-${seed}` } : {}),
        tags: Array.from({ length: seed % 5 }, (_, index) =>
          index % 2 ? null : `tag-${index}`,
        ),
        flags: { enabled: seed % 3 === 0, archived: seed % 4 === 0 },
      };
      const hydrated = transformJson(
        structuredClone(wire),
        descriptor,
        undefined,
        { strict: true },
      );
      expect(hydrated.amount).toBeInstanceOf(Decimal);
      expect(
        serializeJson(hydrated, descriptor, undefined, { strict: true }),
      ).toEqual(wire);
      expect(hydrated.amount.toString()).toBe(wire.amount);
    },
  );
});
