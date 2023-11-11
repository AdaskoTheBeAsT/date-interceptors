import { DateTime, Duration } from 'luxon';

import { hierarchicalConvertToLuxon } from './hierarchical-convert-to-luxon';

describe('hierarchicalConvertToLuxon', () => {
  it.each`
    input                                                                           | expected
    ${{}}                                                                           | ${{}}
    ${{ text: 'adam' }}                                                             | ${{ text: 'adam' }}
    ${{ date: '2023-07-17T23:06:00.000Z' }}                                         | ${{ date: DateTime.fromISO('2023-07-17T23:06:00.000Z') }}
    ${{ someNewObj: { text: 'adam', date: '2023-07-17T23:06:00.000Z' } }}           | ${{ someNewObj: { text: 'adam', date: DateTime.fromISO('2023-07-17T23:06:00.000Z') } }}
    ${[{ date: '2023-07-17T23:06:00.000Z' }, { date: '2023-07-17T23:06:00.000Z' }]} | ${[{ date: DateTime.fromISO('2023-07-17T23:06:00.000Z') }, { date: DateTime.fromISO('2023-07-17T23:06:00.000Z') }]}
    ${['2023-07-17T23:06:00.000Z', '2023-07-17T23:06:00.000Z']}                     | ${[DateTime.fromISO('2023-07-17T23:06:00.000Z'), DateTime.fromISO('2023-07-17T23:06:00.000Z')]}
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
});
