import { hierarchicalConvertToDate } from './hierarchical-convert-to-date';

describe('hierarchicalConvertToDate', () => {
  it.each`
    input                                                                           | expected
    ${{}}                                                                           | ${{}}
    ${{ text: 'adam' }}                                                             | ${{ text: 'adam' }}
    ${{ date: '2023-07-17T23:06:00.000Z' }}                                         | ${{ date: new Date('2023-07-17T23:06:00.000Z') }}
    ${{ someNewObj: { text: 'adam', date: '2023-07-17T23:06:00.000Z' } }}           | ${{ someNewObj: { text: 'adam', date: new Date('2023-07-17T23:06:00.000Z') } }}
    ${[{ date: '2023-07-17T23:06:00.000Z' }, { date: '2023-07-17T23:06:00.000Z' }]} | ${[{ date: new Date('2023-07-17T23:06:00.000Z') }, { date: new Date('2023-07-17T23:06:00.000Z') }]}
    ${['2023-07-17T23:06:00.000Z', '2023-07-17T23:06:00.000Z']}                     | ${[new Date('2023-07-17T23:06:00.000Z'), new Date('2023-07-17T23:06:00.000Z')]}
    ${{ date: '2023-07-17T23:06:00.000+01:00' }}                                    | ${{ date: new Date('2023-07-17T23:06:00.000+01:00') }}
  `('converts $input expecting $expected', ({ input, expected }) => {
    hierarchicalConvertToDate(input);

    expect(input).toEqual(expected);
  });

  describe('Security - Prototype Pollution Protection', () => {
    it('should not process __proto__ property', () => {
      const input = {
        date: '2023-07-17T23:06:00.000Z',
        __proto__: { polluted: true },
      };

      hierarchicalConvertToDate(input);

      expect(input.date).toBeInstanceOf(Date);
      expect(Object.prototype).not.toHaveProperty('polluted');
    });

    it('should not process constructor property', () => {
      const input = {
        date: '2023-07-17T23:06:00.000Z',
        constructor: { polluted: true },
      };

      hierarchicalConvertToDate(input);

      expect(input.date).toBeInstanceOf(Date);
      expect(input.constructor).toEqual({ polluted: true });
    });

    it('should not process prototype property', () => {
      const input = {
        date: '2023-07-17T23:06:00.000Z',
        prototype: { polluted: true },
      };

      hierarchicalConvertToDate(input);

      expect(input.date).toBeInstanceOf(Date);
      expect(input.prototype).toEqual({ polluted: true });
    });
  });

  describe('Circular Reference Protection', () => {
    it('should handle circular references without infinite loop', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input: any = {
        date: '2023-07-17T23:06:00.000Z',
        nested: {},
      };
      input.nested.circular = input;

      expect(() => hierarchicalConvertToDate(input)).not.toThrow();
      expect(input.date).toBeInstanceOf(Date);
    });

    it('should handle self-referencing objects', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input: any = {
        date: '2023-07-17T23:06:00.000Z',
      };
      input.self = input;

      expect(() => hierarchicalConvertToDate(input)).not.toThrow();
      expect(input.date).toBeInstanceOf(Date);
    });
  });

  describe('Depth Limiting', () => {
    it('should handle deeply nested objects up to 100 levels', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input: any = { date: '2023-07-17T23:06:00.000Z' };
      let current = input;

      // Create 50 levels of nesting (well within limit)
      for (let i = 0; i < 50; i++) {
        current.nested = { date: '2023-07-17T23:06:00.000Z' };
        current = current.nested;
      }

      hierarchicalConvertToDate(input);

      expect(input.date).toBeInstanceOf(Date);
    });

    it('should stop processing at depth 100', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input: any = { date: '2023-07-17T23:06:00.000Z' };
      let current = input;

      // Create 101 levels of nesting (exceeds limit)
      for (let i = 0; i < 101; i++) {
        current.nested = { date: '2023-07-17T23:06:00.000Z' };
        current = current.nested;
      }

      hierarchicalConvertToDate(input);

      expect(input.date).toBeInstanceOf(Date);
      // Deep nested dates beyond 100 levels remain strings
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid date strings gracefully', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const input = {
        validDate: '2023-07-17T23:06:00.000Z',
        invalidDate: '2023-99-99T99:99:99.000Z',
      };

      hierarchicalConvertToDate(input);

      expect(input.validDate).toBeInstanceOf(Date);
      expect(input.invalidDate).toBe('2023-99-99T99:99:99.000Z'); // Remains string

      consoleWarnSpy.mockRestore();
    });

    it('should not throw on edge case date values', () => {
      const input = {
        date1: '0000-00-00T00:00:00.000Z',
        date2: '2023-02-30T00:00:00.000Z', // Invalid day
      };

      expect(() => hierarchicalConvertToDate(input)).not.toThrow();
    });
  });

  describe('Performance - Fast Rejection', () => {
    it('should quickly reject short strings', () => {
      const input = {
        shortString: 'hello',
        anotherShort: '123',
        validDate: '2023-07-17T23:06:00.000Z',
      };

      hierarchicalConvertToDate(input);

      expect(input.shortString).toBe('hello');
      expect(input.anotherShort).toBe('123');
      expect(input.validDate).toBeInstanceOf(Date);
    });

    it('should quickly reject strings without date format', () => {
      const input = {
        notADate: '2023/07/17 23:06:00', // Wrong format
        alsoNotADate: 'Monday, July 17, 2023',
        validDate: '2023-07-17T23:06:00.000Z',
      };

      hierarchicalConvertToDate(input);

      expect(input.notADate).toBe('2023/07/17 23:06:00');
      expect(input.alsoNotADate).toBe('Monday, July 17, 2023');
      expect(input.validDate).toBeInstanceOf(Date);
    });
  });

  describe('Type Safety', () => {
    it('should handle null values', () => {
      const input = {
        nullValue: null,
        date: '2023-07-17T23:06:00.000Z',
      };

      expect(() => hierarchicalConvertToDate(input)).not.toThrow();
      expect(input.nullValue).toBeNull();
      expect(input.date).toBeInstanceOf(Date);
    });

    it('should handle primitive types', () => {
      const input = {
        string: 'hello',
        number: 42,
        boolean: true,
        date: '2023-07-17T23:06:00.000Z',
      };

      hierarchicalConvertToDate(input);

      expect(input.string).toBe('hello');
      expect(input.number).toBe(42);
      expect(input.boolean).toBe(true);
      expect(input.date).toBeInstanceOf(Date);
    });
  });
});
