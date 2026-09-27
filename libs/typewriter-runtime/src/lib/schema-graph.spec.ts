import { schema } from '@adaskothebeast/typewriter-schema';

import { JsonTransformationError, transformJson } from './typewriter-runtime';
import { JsonSerializationError, serializeJson } from './typewriter-serializer';

describe('shared transformation results', () => {
  it('reuses replacement objects for shared inputs', () => {
    const shared = { raw: 'value' };
    const replace = jest.fn((value: unknown) => ({ hydrated: value }));
    const result = transformJson(
      [shared, shared],
      schema.array(schema.custom<{ hydrated: unknown }>('replace')),
      undefined,
      { strict: true, transformers: { replace } },
    );
    expect(result[0]).toEqual({ hydrated: shared });
    expect(result[1]).toBe(result[0]);
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('caches undefined replacements and keeps different schemas independent', () => {
    const shared = {};
    const remove = jest.fn(() => undefined);
    const descriptor = schema.array(schema.custom('remove'));
    expect(
      transformJson([shared, shared], descriptor, undefined, {
        transformers: { remove },
      }),
    ).toEqual([undefined, undefined]);
    expect(remove).toHaveBeenCalledTimes(1);

    const result = transformJson(
      { a: shared, b: shared },
      schema.object({
        a: schema.property(schema.custom('first')),
        b: schema.property(schema.custom('second')),
      }),
      undefined,
      { transformers: { first: () => 'A', second: () => 'B' } },
    );
    expect(result).toEqual({ a: 'A', b: 'B' });
  });
});

describe.each([
  ['transform', transformJson, JsonTransformationError],
  ['serialize', serializeJson, JsonSerializationError],
] as const)('%s schema recursion', (_name, convert, ErrorType) => {
  it.each(['scalar', null, {}])(
    'rejects reference-only cycles for %p',
    (value) => {
      const reference = schema.reference('A');
      const registry = { A: schema.reference('B'), B: reference };
      expect(() =>
        convert(value, reference, registry, {
          strict: true,
          maxDepth: 2,
        }),
      ).toThrow(ErrorType);
      expect(() =>
        convert(value, reference, registry, {
          strict: true,
          maxDepth: 2,
        }),
      ).toThrow('Circular schema reference at $');
      expect(convert(value, reference, registry)).toBe(value);
    },
  );

  it('reports the nested path and detects wrapper cycles', () => {
    const reference = schema.reference('Loop');
    const registry = { Loop: schema.optional(reference) };
    expect(() =>
      convert(
        { nested: 'value' },
        schema.object({
          nested: schema.property(reference),
        }),
        registry,
        { strict: true },
      ),
    ).toThrow('Circular schema reference at $.nested');
  });

  it('preserves cyclic data through valid recursive schemas', () => {
    const reference = schema.reference('Node');
    const registry = {
      Node: schema.object({
        label: schema.property(schema.string()),
        next: schema.property(reference),
      }),
    };
    const value: { label: string; next?: unknown } = { label: 'node' };
    value.next = value;
    const result = convert(value, reference, registry, {
      strict: true,
    }) as typeof value;
    expect(result.label).toBe('node');
    expect(result.next).toBe(result);
  });

  it('does not confuse repeated primitive values with schema cycles', () => {
    const reference = schema.reference<string>('Text');
    expect(
      convert(
        ['same', 'same'],
        schema.array(reference),
        {
          Text: schema.string(),
        },
        { strict: true },
      ),
    ).toEqual(['same', 'same']);
  });
});
