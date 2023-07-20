import * as dayjs from 'dayjs';
import { hierarchicalConvertToDayjs } from './hierarchical-convert-to-dayjs';

describe('hierarchicalConvertToDayjs', () => {
  it.each`
    input                                                                           | expected
    ${{}}                                                                           | ${{}}
    ${{ text: 'adam' }}                                                             | ${{ text: 'adam' }}
    ${{ date: '2023-07-17T23:06:00.000Z' }}                                         | ${{ date: dayjs.utc('2023-07-17T23:06:00.000Z') }}
    ${{ someNewObj: { text: 'adam', date: '2023-07-17T23:06:00.000Z' } }}           | ${{ someNewObj: { text: 'adam', date: dayjs.utc('2023-07-17T23:06:00.000Z') } }}
    ${[{ date: '2023-07-17T23:06:00.000Z' }, { date: '2023-07-17T23:06:00.000Z' }]} | ${[{ date: dayjs.utc('2023-07-17T23:06:00.000Z') }, { date: dayjs.utc('2023-07-17T23:06:00.000Z') }]}
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
  `('converts duration $input expecting $expected', ({ input, expected }) => {
    hierarchicalConvertToDayjs(input);
    expect(input).toEqual(expected);
  });
});
