import dayjs from 'dayjs';

import { hierarchicalConvertToDayjs } from '../index';

describe('hierarchicalConvertToDayjs', () => {
  it.each`
    input                                                                           | expected
    ${{}}                                                                           | ${{}}
    ${{ text: 'adam' }}                                                             | ${{ text: 'adam' }}
    ${{ date: '2023-07-17T23:06:00.000Z' }}                                         | ${{ date: dayjs('2023-07-17T23:06:00.000Z') }}
    ${{ someNewObj: { text: 'adam', date: '2023-07-17T23:06:00.000Z' } }}           | ${{ someNewObj: { text: 'adam', date: dayjs('2023-07-17T23:06:00.000Z') } }}
    ${[{ date: '2023-07-17T23:06:00.000Z' }, { date: '2023-07-17T23:06:00.000Z' }]} | ${[{ date: dayjs('2023-07-17T23:06:00.000Z') }, { date: dayjs('2023-07-17T23:06:00.000Z') }]}
    ${['2023-07-17T23:06:00.000Z', '2023-07-17T23:06:00.000Z']}                     | ${[dayjs('2023-07-17T23:06:00.000Z'), dayjs('2023-07-17T23:06:00.000Z')]}
    ${{ date: '2023-07-17T23:06:00.000+01:00' }}                                    | ${{ date: dayjs('2023-07-17T23:06:00.000+01:00') }}
  `('converts date $input expecting $expected', ({ input, expected }) => {
    hierarchicalConvertToDayjs(input);

    expect(input).toEqual(expected);
  });

  it.each`
    input                                                               | expected
    ${{ duration: 'P0D' }}                                              | ${{ duration: dayjs.duration({ years: 0, months: 0, weeks: 0, days: 0, hours: 0, minutes: 0, seconds: 0 }) }}
    ${{ duration: 'P4W' }}                                              | ${{ duration: dayjs.duration({ years: 0, months: 0, weeks: 4, days: 0, hours: 0, minutes: 0, seconds: 0 }) }}
    ${{ duration: 'P1Y2M4DT2H3M2S' }}                                   | ${{ duration: dayjs.duration({ years: 1, months: 2, weeks: 0, days: 4, hours: 2, minutes: 3, seconds: 2 }) }}
    ${{ someNewObj: { text: 'adam', duration: 'P1Y2M4DT2H3M2S' } }}     | ${{ someNewObj: { text: 'adam', duration: dayjs.duration({ years: 1, months: 2, weeks: 0, days: 4, hours: 2, minutes: 3, seconds: 2 }) } }}
    ${[{ duration: 'P1Y2M4DT2H3M2S' }, { duration: 'P1Y2M4DT2H3M2S' }]} | ${[{ duration: dayjs.duration({ years: 1, months: 2, weeks: 0, days: 4, hours: 2, minutes: 3, seconds: 2 }) }, { duration: dayjs.duration({ years: 1, months: 2, weeks: 0, days: 4, hours: 2, minutes: 3, seconds: 2 }) }]}
    ${['P1Y2M4DT2H3M2S', 'P1Y2M4DT2H3M2S']}                             | ${[dayjs.duration({ years: 1, months: 2, weeks: 0, days: 4, hours: 2, minutes: 3, seconds: 2 }), dayjs.duration({ years: 1, months: 2, weeks: 0, days: 4, hours: 2, minutes: 3, seconds: 2 })]}
  `('converts duration $input expecting $expected', ({ input, expected }) => {
    hierarchicalConvertToDayjs(input);

    expect(input).toEqual(expected);
  });

  it('produces local-mode objects for Z and numeric offsets alike', () => {
    const input = {
      zulu: '2023-07-17T23:06:00Z',
      zero: '2023-07-17T23:06:00+00:00',
      shifted: '2023-07-18T01:06:00+02:00',
    };

    hierarchicalConvertToDayjs(input);

    const values = Object.values(input) as unknown as dayjs.Dayjs[];
    for (const value of values) {
      expect(dayjs.isDayjs(value)).toBe(true);
      expect(value.isUTC()).toBe(false);
      expect(value.valueOf()).toBe(Date.UTC(2023, 6, 17, 23, 6));
    }
  });

  it('accepts a decimal comma and keeps negative durations as strings', () => {
    const input = { comma: 'PT1,5S', negative: '-PT1.5S' };

    hierarchicalConvertToDayjs(input);

    expect(
      (
        input.comma as unknown as ReturnType<typeof dayjs.duration>
      ).asMilliseconds(),
    ).toBe(1500);
    expect(input.negative).toBe('-PT1.5S');
  });

  it('keeps the string when Day.js reports an invalid value', () => {
    const isValid = jest
      .spyOn(dayjs.prototype, 'isValid')
      .mockReturnValueOnce(false);
    const input = { date: '2023-07-17T23:06:00.000Z' };

    hierarchicalConvertToDayjs(input);

    expect(input.date).toBe('2023-07-17T23:06:00.000Z');
    isValid.mockRestore();
  });

  it('is a no-op when run twice and leaves non-plain objects untouched', () => {
    const map = new Map([['date', '2023-07-17T23:06:00.000Z']]);
    const input = {
      date: '2023-07-17T23:06:00.000Z',
      duration: 'PT1S',
      map,
    };

    hierarchicalConvertToDayjs(input);
    const { date, duration } = input;
    const snapshot = JSON.stringify(input);
    hierarchicalConvertToDayjs(input);

    expect(input.date).toBe(date);
    expect(input.duration).toBe(duration);
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(map.get('date')).toBe('2023-07-17T23:06:00.000Z');
  });

  describe('Security - Prototype Pollution Protection', () => {
    it('should not process an own __proto__ key from JSON', () => {
      const input = JSON.parse(
        '{"date":"2023-07-17T23:06:00.000Z","__proto__":"2024-01-01T00:00:00Z","nested":{"__proto__":{}}}',
      );

      hierarchicalConvertToDayjs(input);

      expect(dayjs.isDayjs(input.date)).toBe(true);
      expect(Object.getPrototypeOf(input)).toBe(Object.prototype);
      expect(Object.getPrototypeOf(input.nested)).toBe(Object.prototype);
      expect(Object.getOwnPropertyDescriptor(input, '__proto__')?.value).toBe(
        '2024-01-01T00:00:00Z',
      );
    });

    it('should not process dangerous properties', () => {
      const input = {
        date: '2023-07-17T23:06:00.000Z',
        constructor: { polluted: true },
        prototype: { polluted: true },
      };

      hierarchicalConvertToDayjs(input);

      expect(dayjs.isDayjs(input.date)).toBe(true);
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

      expect(() => hierarchicalConvertToDayjs(input)).not.toThrow();
      expect(dayjs.isDayjs(input.date)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid date strings gracefully', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const input = {
        validDate: '2023-07-17T23:06:00.000Z',
        invalidDate: '2023-99-99T99:99:99.000Z',
      };

      hierarchicalConvertToDayjs(input);

      expect(dayjs.isDayjs(input.validDate)).toBe(true);
      expect(input.invalidDate).toBe('2023-99-99T99:99:99.000Z');

      consoleWarnSpy.mockRestore();
    });
  });
});
