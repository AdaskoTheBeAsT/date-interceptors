import dayjs from 'dayjs';

import { hierarchicalConvertToDayjs } from './hierarchical-convert-to-dayjs';

describe('hierarchicalConvertToDayjs', () => {
  it.each`
    input                                                                           | expected
    ${{}}                                                                           | ${{}}
    ${{ text: 'adam' }}                                                             | ${{ text: 'adam' }}
    ${{ date: '2023-07-17T23:06:00.000Z' }}                                         | ${{ date: dayjs.utc('2023-07-17T23:06:00.000Z') }}
    ${{ someNewObj: { text: 'adam', date: '2023-07-17T23:06:00.000Z' } }}           | ${{ someNewObj: { text: 'adam', date: dayjs.utc('2023-07-17T23:06:00.000Z') } }}
    ${[{ date: '2023-07-17T23:06:00.000Z' }, { date: '2023-07-17T23:06:00.000Z' }]} | ${[{ date: dayjs.utc('2023-07-17T23:06:00.000Z') }, { date: dayjs.utc('2023-07-17T23:06:00.000Z') }]}
    ${['2023-07-17T23:06:00.000Z', '2023-07-17T23:06:00.000Z']}                     | ${[dayjs.utc('2023-07-17T23:06:00.000Z'), dayjs.utc('2023-07-17T23:06:00.000Z')]}
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

  describe('Security - Prototype Pollution Protection', () => {
    it('should not process __proto__ property', () => {
      const input = {
        date: '2023-07-17T23:06:00.000Z',
        __proto__: { polluted: true },
      };

      hierarchicalConvertToDayjs(input);

      expect(dayjs.isDayjs(input.date)).toBe(true);
      expect(Object.prototype).not.toHaveProperty('polluted');
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
