import { Duration } from 'date-fns';

import { hierarchicalConvertToDateFns } from './hierarchical-convert-to-date-fns';

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
});
