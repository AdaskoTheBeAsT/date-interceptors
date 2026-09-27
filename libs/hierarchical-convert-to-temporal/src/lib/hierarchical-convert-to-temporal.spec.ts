import { Temporal } from '@js-temporal/polyfill';

import { hierarchicalConvertToTemporal } from '../index';

describe('hierarchicalConvertToTemporal', () => {
  it.each`
    input                                                                           | expected
    ${{}}                                                                           | ${{}}
    ${{ text: 'adam' }}                                                             | ${{ text: 'adam' }}
    ${{ date: '2023-07-17T23:06:00.000Z' }}                                         | ${{ date: Temporal.Instant.from('2023-07-17T23:06:00.000Z') }}
    ${{ someNewObj: { text: 'adam', date: '2023-07-17T23:06:00.000Z' } }}           | ${{ someNewObj: { text: 'adam', date: Temporal.Instant.from('2023-07-17T23:06:00.000Z') } }}
    ${[{ date: '2023-07-17T23:06:00.000Z' }, { date: '2023-07-17T23:06:00.000Z' }]} | ${[{ date: Temporal.Instant.from('2023-07-17T23:06:00.000Z') }, { date: Temporal.Instant.from('2023-07-17T23:06:00.000Z') }]}
    ${['2023-07-17T23:06:00.000Z', '2023-07-17T23:06:00.000Z']}                     | ${[Temporal.Instant.from('2023-07-17T23:06:00.000Z'), Temporal.Instant.from('2023-07-17T23:06:00.000Z')]}
    ${{ date: '2023-07-17T23:06:00.000+01:00' }}                                    | ${{ date: Temporal.Instant.from('2023-07-17T23:06:00.000+01:00') }}
    ${{ date: '2023-07-17T23:06:00' }}                                              | ${{ date: Temporal.PlainDateTime.from('2023-07-17T23:06:00') }}
    ${{ date: '2023-07-17T23:06:00.123456789Z' }}                                   | ${{ date: Temporal.Instant.from('2023-07-17T23:06:00.123456789Z') }}
  `('converts date $input expecting $expected', ({ input, expected }) => {
    hierarchicalConvertToTemporal(input);

    expect(input).toEqual(expected);
  });

  it.each`
    input                                                               | expected
    ${{ duration: 'P0D' }}                                              | ${{ duration: Temporal.Duration.from({ days: 0 }) }}
    ${{ duration: 'P4W' }}                                              | ${{ duration: Temporal.Duration.from({ weeks: 4 }) }}
    ${{ duration: '-PT1H' }}                                            | ${{ duration: Temporal.Duration.from('-PT1H') }}
    ${{ duration: 'PT0.5S' }}                                           | ${{ duration: Temporal.Duration.from('PT0.5S') }}
    ${{ duration: 'P1Y2M4DT2H3M2S' }}                                   | ${{ duration: Temporal.Duration.from({ years: 1, months: 2, days: 4, hours: 2, minutes: 3, seconds: 2 }) }}
    ${{ someNewObj: { text: 'adam', duration: 'P1Y2M4DT2H3M2S' } }}     | ${{ someNewObj: { text: 'adam', duration: Temporal.Duration.from('P1Y2M4DT2H3M2S') } }}
    ${[{ duration: 'P1Y2M4DT2H3M2S' }, { duration: 'P1Y2M4DT2H3M2S' }]} | ${[{ duration: Temporal.Duration.from('P1Y2M4DT2H3M2S') }, { duration: Temporal.Duration.from('P1Y2M4DT2H3M2S') }]}
    ${['P1Y2M4DT2H3M2S', 'P1Y2M4DT2H3M2S']}                             | ${[Temporal.Duration.from('P1Y2M4DT2H3M2S'), Temporal.Duration.from('P1Y2M4DT2H3M2S')]}
  `('converts duration $input expecting $expected', ({ input, expected }) => {
    hierarchicalConvertToTemporal(input);

    expect(input).toEqual(expected);
  });

  it('skips dangerous properties', () => {
    const input = {
      date: '2023-07-17T23:06:00.000Z',
      constructor: { date: '2023-07-17T23:06:00.000Z' },
      prototype: { date: '2023-07-17T23:06:00.000Z' },
    };

    hierarchicalConvertToTemporal(input);

    expect(input.date).toBeInstanceOf(Temporal.Instant);
    expect(input.constructor.date).toBe('2023-07-17T23:06:00.000Z');
    expect(input.prototype.date).toBe('2023-07-17T23:06:00.000Z');
  });

  it('handles circular references', () => {
    const input: Record<string, unknown> = {
      date: '2023-07-17T23:06:00.000Z',
    };
    input['self'] = input;

    expect(() => hierarchicalConvertToTemporal(input)).not.toThrow();
    expect(input['date']).toBeInstanceOf(Temporal.Instant);
  });

  it('stops processing beyond 100 levels', () => {
    const input: Record<string, unknown> = {};
    let current = input;

    for (let index = 0; index < 101; index++) {
      const nested: Record<string, unknown> = {
        date: '2023-07-17T23:06:00.000Z',
      };
      current['nested'] = nested;
      current = nested;
    }

    hierarchicalConvertToTemporal(input);

    expect(current['date']).toBe('2023-07-17T23:06:00.000Z');
  });

  it('keeps nanoseconds and weeks, and leaves out-of-range durations as strings', () => {
    const input = {
      precise: 'PT0.123456789S',
      comma: 'PT1,5S',
      weeks: 'P1Y2W',
      huge: 'P99999999999999999999Y',
    };

    hierarchicalConvertToTemporal(input);

    expect(String(input.precise)).toBe('PT0.123456789S');
    expect(
      (input.comma as unknown as Temporal.Duration).total('milliseconds'),
    ).toBe(1500);
    expect((input.weeks as unknown as Temporal.Duration).weeks).toBe(2);
    expect(input.huge).toBe('P99999999999999999999Y');
  });

  it('is a no-op when run twice and leaves non-plain objects untouched', () => {
    const map = new Map([['date', '2023-07-17T23:06:00.000Z']]);
    const input = {
      date: '2023-07-17T23:06:00.000Z',
      duration: 'PT1S',
      map,
    };

    hierarchicalConvertToTemporal(input);
    const { date, duration } = input;
    const snapshot = JSON.stringify(input);
    hierarchicalConvertToTemporal(input);

    expect(input.date).toBe(date);
    expect(input.duration).toBe(duration);
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(map.get('date')).toBe('2023-07-17T23:06:00.000Z');
  });

  it('leaves invalid and primitive values unchanged', () => {
    const input = {
      invalidDate: '2023-99-99T99:99:99.000Z',
      invalidDuration: 'P',
      text: 'hello',
      number: 42,
      boolean: true,
      nullValue: null,
    };

    hierarchicalConvertToTemporal(input);

    expect(input).toEqual({
      invalidDate: '2023-99-99T99:99:99.000Z',
      invalidDuration: 'P',
      text: 'hello',
      number: 42,
      boolean: true,
      nullValue: null,
    });
  });
});
