import { DateTime, Duration } from 'luxon';

import { hierarchicalConvertToLuxon } from '../index';

describe('hierarchicalConvertToLuxon', () => {
  it.each`
    input                                                                           | expected
    ${{}}                                                                           | ${{}}
    ${{ text: 'adam' }}                                                             | ${{ text: 'adam' }}
    ${{ date: '2023-07-17T23:06:00.000Z' }}                                         | ${{ date: DateTime.fromISO('2023-07-17T23:06:00.000Z') }}
    ${{ someNewObj: { text: 'adam', date: '2023-07-17T23:06:00.000Z' } }}           | ${{ someNewObj: { text: 'adam', date: DateTime.fromISO('2023-07-17T23:06:00.000Z') } }}
    ${[{ date: '2023-07-17T23:06:00.000Z' }, { date: '2023-07-17T23:06:00.000Z' }]} | ${[{ date: DateTime.fromISO('2023-07-17T23:06:00.000Z') }, { date: DateTime.fromISO('2023-07-17T23:06:00.000Z') }]}
    ${['2023-07-17T23:06:00.000Z', '2023-07-17T23:06:00.000Z']}                     | ${[DateTime.fromISO('2023-07-17T23:06:00.000Z'), DateTime.fromISO('2023-07-17T23:06:00.000Z')]}
    ${{ date: '2023-07-17T23:06:00.000+01:00' }}                                    | ${{ date: DateTime.fromISO('2023-07-17T23:06:00.000+01:00') }}
  `('converts $input expecting $expected', ({ input, expected }) => {
    hierarchicalConvertToLuxon(input);

    expect(input).toEqual(expected);
  });

  it.each`
    input                                                               | expected
    ${{ duration: 'P0D' }}                                              | ${{ duration: Duration.fromObject({ days: 0 }) }}
    ${{ duration: 'P4W' }}                                              | ${{ duration: Duration.fromObject({ weeks: 4 }) }}
    ${{ duration: 'P1Y2M4DT2H3M2S' }}                                   | ${{ duration: Duration.fromObject({ years: 1, months: 2, days: 4, hours: 2, minutes: 3, seconds: 2 }) }}
    ${{ someNewObj: { text: 'adam', duration: 'P1Y2M4DT2H3M2S' } }}     | ${{ someNewObj: { text: 'adam', duration: Duration.fromObject({ years: 1, months: 2, days: 4, hours: 2, minutes: 3, seconds: 2 }) } }}
    ${[{ duration: 'P1Y2M4DT2H3M2S' }, { duration: 'P1Y2M4DT2H3M2S' }]} | ${[{ duration: Duration.fromObject({ years: 1, months: 2, days: 4, hours: 2, minutes: 3, seconds: 2 }) }, { duration: Duration.fromObject({ years: 1, months: 2, days: 4, hours: 2, minutes: 3, seconds: 2 }) }]}
    ${['P1Y2M4DT2H3M2S', 'P1Y2M4DT2H3M2S']}                             | ${[Duration.fromObject({ years: 1, months: 2, days: 4, hours: 2, minutes: 3, seconds: 2 }), Duration.fromObject({ years: 1, months: 2, days: 4, hours: 2, minutes: 3, seconds: 2 })]}
  `('converts duration $input expecting $expected', ({ input, expected }) => {
    hierarchicalConvertToLuxon(input);

    expect(input).toEqual(expected);
  });

  it('accepts a decimal comma natively and keeps weeks', () => {
    const input = { comma: 'PT1,5S', weeks: 'P1Y2W' };

    hierarchicalConvertToLuxon(input);

    expect((input.comma as unknown as Duration).as('milliseconds')).toBe(1500);
    expect((input.weeks as unknown as Duration).weeks).toBe(2);
  });

  it('keeps strings when Luxon reports invalid values', () => {
    const fromIso = jest
      .spyOn(DateTime, 'fromISO')
      .mockReturnValueOnce(DateTime.invalid('test'));
    const durationFromIso = jest
      .spyOn(Duration, 'fromISO')
      .mockReturnValueOnce(Duration.invalid('test'));
    const input = { date: '2023-07-17T23:06:00Z', duration: 'PT1S' };

    hierarchicalConvertToLuxon(input);

    expect(input).toEqual({ date: '2023-07-17T23:06:00Z', duration: 'PT1S' });
    fromIso.mockRestore();
    durationFromIso.mockRestore();
  });

  it('is a no-op when run twice and leaves non-plain objects untouched', () => {
    const map = new Map([['date', '2023-07-17T23:06:00.000Z']]);
    const input = {
      date: '2023-07-17T23:06:00.000Z',
      duration: 'PT1S',
      map,
    };

    hierarchicalConvertToLuxon(input);
    const { date, duration } = input;
    const snapshot = JSON.stringify(input);
    hierarchicalConvertToLuxon(input);

    expect(input.date).toBe(date);
    expect(input.duration).toBe(duration);
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(map.get('date')).toBe('2023-07-17T23:06:00.000Z');
  });
});
