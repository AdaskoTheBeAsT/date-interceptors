import { ZonedDateTime } from '@js-joda/core';

import { hierarchicalConvertToJsJoda } from './hierarchical-convert-to-js-joda';

describe('hierarchicalConvertToJsJoda', () => {
  it.each`
    input                                                                           | expected
    ${{}}                                                                           | ${{}}
    ${{ text: 'adam' }}                                                             | ${{ text: 'adam' }}
    ${{ date: '2023-07-17T23:06:00.000Z' }}                                         | ${{ date: ZonedDateTime.parse('2023-07-17T23:06:00.000Z') }}
    ${{ someNewObj: { text: 'adam', date: '2023-07-17T23:06:00.000Z' } }}           | ${{ someNewObj: { text: 'adam', date: ZonedDateTime.parse('2023-07-17T23:06:00.000Z') } }}
    ${[{ date: '2023-07-17T23:06:00.000Z' }, { date: '2023-07-17T23:06:00.000Z' }]} | ${[{ date: ZonedDateTime.parse('2023-07-17T23:06:00.000Z') }, { date: ZonedDateTime.parse('2023-07-17T23:06:00.000Z') }]}
    ${['2023-07-17T23:06:00.000Z', '2023-07-17T23:06:00.000Z']}                     | ${[ZonedDateTime.parse('2023-07-17T23:06:00.000Z'), ZonedDateTime.parse('2023-07-17T23:06:00.000Z')]}
  `('converts $input expecting $expected', ({ input, expected }) => {
    hierarchicalConvertToJsJoda(input);
    expect(input).toEqual(expected);
  });
});
