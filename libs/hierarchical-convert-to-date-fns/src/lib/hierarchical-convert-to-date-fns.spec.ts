import { Duration } from 'date-fns';

import { hierarchicalConvertToDateFns } from '../index';

describe('hierarchicalConvertToDateFns', () => {
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
    hierarchicalConvertToDateFns(input);

    expect(input).toEqual(expected);
  });

  it.each`
    input                                                               | expected
    ${{ duration: 'P0D' }}                                              | ${{ duration: { years: 0, months: 0, weeks: 0, days: 0, hours: 0, minutes: 0, seconds: 0 } as Duration }}
    ${{ duration: 'P4W' }}                                              | ${{ duration: { years: 0, months: 0, weeks: 4, days: 0, hours: 0, minutes: 0, seconds: 0 } as Duration }}
    ${{ duration: 'P1Y2M4DT2H3M2S' }}                                   | ${{ duration: { years: 1, months: 2, weeks: 0, days: 4, hours: 2, minutes: 3, seconds: 2 } as Duration }}
    ${{ someNewObj: { text: 'adam', duration: 'P1Y2M4DT2H3M2S' } }}     | ${{ someNewObj: { text: 'adam', duration: { years: 1, months: 2, weeks: 0, days: 4, hours: 2, minutes: 3, seconds: 2 } as Duration } }}
    ${[{ duration: 'P1Y2M4DT2H3M2S' }, { duration: 'P1Y2M4DT2H3M2S' }]} | ${[{ duration: { years: 1, months: 2, weeks: 0, days: 4, hours: 2, minutes: 3, seconds: 2 } as Duration }, { duration: { years: 1, months: 2, weeks: 0, days: 4, hours: 2, minutes: 3, seconds: 2 } as Duration }]}
    ${['P1Y2M4DT2H3M2S', 'P1Y2M4DT2H3M2S']}                             | ${[{ years: 1, months: 2, weeks: 0, days: 4, hours: 2, minutes: 3, seconds: 2 }, { years: 1, months: 2, weeks: 0, days: 4, hours: 2, minutes: 3, seconds: 2 }]}
  `('converts duration $input expecting $expected', ({ input, expected }) => {
    hierarchicalConvertToDateFns(input);

    expect(input).toEqual(expected);
  });

  it('parses fractional seconds with either separator and keeps negative or invalid values as strings', () => {
    const input = {
      point: 'PT1.5S',
      comma: 'PT1,5S',
      negative: '-PT1.5S',
      invalidDate: '2023-02-30T00:00:00Z',
      invalidDuration: 'P1DT',
    };

    hierarchicalConvertToDateFns(input);

    expect((input.point as unknown as Duration).seconds).toBe(1.5);
    expect((input.comma as unknown as Duration).seconds).toBe(1.5);
    expect(input.negative).toBe('-PT1.5S');
    expect(input.invalidDate).toBe('2023-02-30T00:00:00Z');
    expect(input.invalidDuration).toBe('P1DT');
  });

  it('is a no-op when run twice and leaves non-plain objects untouched', () => {
    const map = new Map([['date', '2023-07-17T23:06:00.000Z']]);
    const input = {
      date: '2023-07-17T23:06:00.000Z',
      duration: 'PT1S',
      map,
    };

    hierarchicalConvertToDateFns(input);
    const { date, duration } = input;
    const snapshot = JSON.stringify(input);
    hierarchicalConvertToDateFns(input);

    expect(input.date).toBe(date);
    expect(input.duration).toBe(duration);
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(map.get('date')).toBe('2023-07-17T23:06:00.000Z');
  });
});
