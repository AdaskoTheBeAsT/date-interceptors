import Decimal from 'decimal.js';

import { hierarchicalConvertToDecimal } from './hierarchical-convert-to-decimal';

describe('hierarchicalConvertToDecimal', () => {
  it.each`
    input                                                   | expected
    ${{}}                                                   | ${{}}
    ${{ text: 'adam' }}                                     | ${{ text: 'adam' }}
    ${{ amount: '123.45' }}                                 | ${{ amount: new Decimal('123.45') }}
    ${{ amount: '-0.001' }}                                 | ${{ amount: new Decimal('-0.001') }}
    ${{ amount: '+42' }}                                    | ${{ amount: new Decimal('+42') }}
    ${{ amount: '.5' }}                                     | ${{ amount: new Decimal('.5') }}
    ${{ amount: '1.25e+8' }}                                | ${{ amount: new Decimal('1.25e+8') }}
    ${{ nested: { amount: '123.45' } }}                     | ${{ nested: { amount: new Decimal('123.45') } }}
    ${[{ amount: '123.45' }, { amount: '-0.001' }]}         | ${[{ amount: new Decimal('123.45') }, { amount: new Decimal('-0.001') }]}
    ${['123.45', '-0.001', '1.25e+8']}                      | ${[new Decimal('123.45'), new Decimal('-0.001'), new Decimal('1.25e+8')]}
  `('converts $input expecting $expected', ({ input, expected }) => {
    hierarchicalConvertToDecimal(input);

    expect(input).toEqual(expected);
  });

  it('preserves arbitrary precision', () => {
    const input = {
      amount: '12345678901234567890.1234567890123456789',
    };

    hierarchicalConvertToDecimal(input);

    expect(Decimal.isDecimal(input.amount)).toBe(true);
    expect(input.amount.toString()).toBe(
      '12345678901234567890.1234567890123456789',
    );
  });

  it.each([
    '',
    ' ',
    '1 000',
    '1,000.00',
    'NaN',
    'Infinity',
    '0x10',
    '1.2.3',
    '1e',
  ])('leaves invalid decimal string %p unchanged', (value) => {
    const input = { value };

    hierarchicalConvertToDecimal(input);

    expect(input.value).toBe(value);
  });

  it('leaves primitive values unchanged', () => {
    const input = {
      number: 42,
      boolean: true,
      nullValue: null,
      text: 'hello',
    };

    hierarchicalConvertToDecimal(input);

    expect(input).toEqual({
      number: 42,
      boolean: true,
      nullValue: null,
      text: 'hello',
    });
  });

  it('skips dangerous properties', () => {
    const input = {
      amount: '123.45',
      constructor: { amount: '456.78' },
      prototype: { amount: '456.78' },
    };

    hierarchicalConvertToDecimal(input);

    expect(Decimal.isDecimal(input.amount)).toBe(true);
    expect(input.constructor.amount).toBe('456.78');
    expect(input.prototype.amount).toBe('456.78');
  });

  it('handles circular references', () => {
    const input: Record<string, unknown> = { amount: '123.45' };
    input['self'] = input;

    expect(() => hierarchicalConvertToDecimal(input)).not.toThrow();
    expect(Decimal.isDecimal(input['amount'])).toBe(true);
  });

  it('stops processing beyond 100 levels', () => {
    const input: Record<string, unknown> = {};
    let current = input;

    for (let index = 0; index < 101; index++) {
      const nested: Record<string, unknown> = { amount: '123.45' };
      current['nested'] = nested;
      current = nested;
    }

    hierarchicalConvertToDecimal(input);

    expect(current['amount']).toBe('123.45');
  });
});
