import { schema } from '@adaskothebeast/typewriter-schema';

import { transformJson } from './typewriter-runtime';
import { serializeJson } from './typewriter-serializer';

describe('object schema contract', () => {
  it('does not reuse another model field as a missing property wire alias', () => {
    const optionalSwap = schema.object({
      a: schema.property(schema.string(), 'b'),
      b: schema.property(schema.optional(schema.string()), 'a'),
    });
    expect(serializeJson<unknown>({ a: 'A' }, optionalSwap)).toEqual({
      b: 'A',
    });
    expect(
      serializeJson<unknown>({ a: 'A' }, optionalSwap, undefined, {
        strict: true,
      }),
    ).toEqual({ b: 'A' });
    const requiredSwap = schema.object({
      a: schema.property(schema.string(), 'b'),
      b: schema.property(schema.string(), 'a'),
    });
    expect(() =>
      serializeJson<unknown>({ a: 'A' }, requiredSwap, undefined, {
        strict: true,
      }),
    ).toThrow('$.b');
  });

  const renamed = schema.object({
    a: schema.property(schema.string(), 'b'),
    b: schema.property(schema.string(), 'c'),
    c: schema.property(schema.string(), 'a'),
  });

  it('round trips overlapping wire names without losing values', () => {
    const wire = { a: 'A', b: 'B', c: 'C', extra: true };
    const model = transformJson(structuredClone(wire), renamed, undefined, {
      strict: true,
    });
    expect(model).toEqual({ a: 'B', b: 'C', c: 'A', extra: true });
    expect(
      serializeJson<unknown>(model, renamed, undefined, { strict: true }),
    ).toEqual(wire);
    expect(model).toEqual({ a: 'B', b: 'C', c: 'A', extra: true });
  });

  it.each([transformJson, serializeJson])(
    'rejects missing required properties in strict mode',
    (convert) => {
      const descriptor = schema.object({
        nested: schema.property(
          schema.object({
            name: schema.property(schema.string()),
          }),
        ),
      });
      expect(() =>
        convert<unknown>({ nested: {} }, descriptor, undefined, {
          strict: true,
        }),
      ).toThrow('$.nested.name');
      expect(convert<unknown>({ nested: {} }, descriptor)).toEqual({
        nested: {},
      });
    },
  );

  it.each([transformJson, serializeJson])(
    'allows absent optional properties but requires nullable ones',
    (convert) => {
      const optional = schema.object({
        name: schema.property(schema.optional(schema.string())),
      });
      expect(
        convert<unknown>({}, optional, undefined, { strict: true }),
      ).toEqual({});
      const nullable = schema.object({
        name: schema.property(schema.nullable(schema.string())),
      });
      expect(() =>
        convert<unknown>({}, nullable, undefined, { strict: true }),
      ).toThrow('$.name');
      expect(
        convert<unknown>({ name: null }, nullable, undefined, { strict: true }),
      ).toEqual({ name: null });
    },
  );

  it('reports the wire name for missing input and model name for missing output', () => {
    const descriptor = schema.object({
      displayName: schema.property(schema.string(), 'display_name'),
    });
    expect(() =>
      transformJson({}, descriptor, undefined, { strict: true }),
    ).toThrow('$.display_name');
    expect(() =>
      serializeJson<unknown>({}, descriptor, undefined, { strict: true }),
    ).toThrow('$.displayName');
  });
});
