import { NIL, parse } from 'uuid';

import { hierarchicalConvertToUuid } from './hierarchical-convert-to-uuid';

describe('hierarchicalConvertToUuid', () => {
  const uuidV1 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  const uuidV4 = '550e8400-e29b-41d4-a716-446655440000';

  it.each`
    input                                               | expected
    ${{}}                                               | ${{}}
    ${{ text: 'adam' }}                                 | ${{ text: 'adam' }}
    ${{ id: uuidV4 }}                                   | ${{ id: parse(uuidV4) }}
    ${{ id: uuidV1 }}                                   | ${{ id: parse(uuidV1) }}
    ${{ id: NIL }}                                      | ${{ id: parse(NIL) }}
    ${{ nested: { id: uuidV4 } }}                       | ${{ nested: { id: parse(uuidV4) } }}
    ${[{ id: uuidV4 }, { id: uuidV1 }]}                 | ${[{ id: parse(uuidV4) }, { id: parse(uuidV1) }]}
    ${[uuidV4, uuidV1, NIL]}                            | ${[parse(uuidV4), parse(uuidV1), parse(NIL)]}
  `('converts $input expecting $expected', ({ input, expected }) => {
    hierarchicalConvertToUuid(input);

    expect(input).toEqual(expected);
  });

  it('converts uppercase UUID strings', () => {
    const input = { id: uuidV4.toUpperCase() };

    hierarchicalConvertToUuid(input);

    expect(input.id).toEqual(parse(uuidV4));
  });

  it.each([
    '',
    'not-a-uuid',
    '550e8400-e29b-41d4-a716-44665544000',
    '550e8400-e29b-91d4-a716-446655440000',
    '550e8400e29b41d4a716446655440000',
  ])('leaves invalid UUID string %p unchanged', (value) => {
    const input = { value };

    hierarchicalConvertToUuid(input);

    expect(input.value).toBe(value);
  });

  it('leaves primitive values unchanged', () => {
    const input = {
      number: 42,
      boolean: true,
      nullValue: null,
      text: 'hello',
    };

    hierarchicalConvertToUuid(input);

    expect(input).toEqual({
      number: 42,
      boolean: true,
      nullValue: null,
      text: 'hello',
    });
  });

  it('skips dangerous properties', () => {
    const input = {
      id: uuidV4,
      constructor: { id: uuidV1 },
      prototype: { id: uuidV1 },
    };

    hierarchicalConvertToUuid(input);

    expect(input.id).toEqual(parse(uuidV4));
    expect(input.constructor.id).toBe(uuidV1);
    expect(input.prototype.id).toBe(uuidV1);
  });

  it('handles circular references', () => {
    const input: Record<string, unknown> = { id: uuidV4 };
    input['self'] = input;

    expect(() => hierarchicalConvertToUuid(input)).not.toThrow();
    expect(input['id']).toEqual(parse(uuidV4));
  });

  it('stops processing beyond 100 levels', () => {
    const input: Record<string, unknown> = {};
    let current = input;

    for (let index = 0; index < 101; index++) {
      const nested: Record<string, unknown> = { id: uuidV4 };
      current['nested'] = nested;
      current = nested;
    }

    hierarchicalConvertToUuid(input);

    expect(current['id']).toBe(uuidV4);
  });
});
