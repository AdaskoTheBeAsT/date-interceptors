import * as moment from 'moment';

import { hierarchicalConvertToMoment } from './hierarchical-convert-to-moment';

describe('hierarchicalConvertToMoment', () => {
  it.each`
    input                                                                           | expected
    ${{}}                                                                           | ${{}}
    ${{ text: 'adam' }}                                                             | ${{ text: 'adam' }}
    ${{ date: '2023-07-17T23:06:00.000Z' }}                                         | ${{ date: moment('2023-07-17T23:06:00.000Z') }}
    ${{ someNewObj: { text: 'adam', date: '2023-07-17T23:06:00.000Z' } }}           | ${{ someNewObj: { text: 'adam', date: moment('2023-07-17T23:06:00.000Z') } }}
    ${[{ date: '2023-07-17T23:06:00.000Z' }, { date: '2023-07-17T23:06:00.000Z' }]} | ${[{ date: moment('2023-07-17T23:06:00.000Z') }, { date: moment('2023-07-17T23:06:00.000Z') }]}
    ${['2023-07-17T23:06:00.000Z', '2023-07-17T23:06:00.000Z']}                     | ${[moment('2023-07-17T23:06:00.000Z'), moment('2023-07-17T23:06:00.000Z')]}
    ${{ date: '2023-07-17T23:06:00.000+01:00' }}                                    | ${{ date: moment('2023-07-17T23:06:00.000+01:00') }}
  `('converts $input expecting $expected', ({ input, expected }) => {
    hierarchicalConvertToMoment(input);

    expect(input).toEqual(expected);
  });

  it.each`
    input                                                               | expected
    ${{ duration: 'P0D' }}                                              | ${{ duration: moment.duration({ years: 0, months: 0, weeks: 0, days: 0, hours: 0, minutes: 0, seconds: 0 }) }}
    ${{ duration: 'P4W' }}                                              | ${{ duration: moment.duration({ years: 0, months: 0, weeks: 4, days: 0, hours: 0, minutes: 0, seconds: 0 }) }}
    ${{ duration: 'P1Y2M4DT2H3M2S' }}                                   | ${{ duration: moment.duration({ years: 1, months: 2, weeks: 0, days: 4, hours: 2, minutes: 3, seconds: 2 }) }}
    ${{ someNewObj: { text: 'adam', duration: 'P1Y2M4DT2H3M2S' } }}     | ${{ someNewObj: { text: 'adam', duration: moment.duration({ years: 1, months: 2, weeks: 0, days: 4, hours: 2, minutes: 3, seconds: 2 }) } }}
    ${[{ duration: 'P1Y2M4DT2H3M2S' }, { duration: 'P1Y2M4DT2H3M2S' }]} | ${[{ duration: moment.duration({ years: 1, months: 2, weeks: 0, days: 4, hours: 2, minutes: 3, seconds: 2 }) }, { duration: moment.duration({ years: 1, months: 2, weeks: 0, days: 4, hours: 2, minutes: 3, seconds: 2 }) }]}
    ${['P1Y2M4DT2H3M2S', 'P1Y2M4DT2H3M2S']}                             | ${[moment.duration({ years: 1, months: 2, weeks: 0, days: 4, hours: 2, minutes: 3, seconds: 2 }), moment.duration({ years: 1, months: 2, weeks: 0, days: 4, hours: 2, minutes: 3, seconds: 2 })]}
  `('converts duration $input expecting $expected', ({ input, expected }) => {
    hierarchicalConvertToMoment(input);

    expect(input).toEqual(expected);
  });
});
