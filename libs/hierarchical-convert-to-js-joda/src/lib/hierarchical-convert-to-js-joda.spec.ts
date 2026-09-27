import { ZonedDateTime } from '@js-joda/core';

import { hierarchicalConvertToJsJoda } from '../index';

describe('hierarchicalConvertToJsJoda', () => {
  it.each`
    input                                                                           | expected
    ${{}}                                                                           | ${{}}
    ${{ text: 'adam' }}                                                             | ${{ text: 'adam' }}
    ${{ date: '2023-07-17T23:06:00.000Z' }}                                         | ${{ date: ZonedDateTime.parse('2023-07-17T23:06:00.000Z') }}
    ${{ someNewObj: { text: 'adam', date: '2023-07-17T23:06:00.000Z' } }}           | ${{ someNewObj: { text: 'adam', date: ZonedDateTime.parse('2023-07-17T23:06:00.000Z') } }}
    ${[{ date: '2023-07-17T23:06:00.000Z' }, { date: '2023-07-17T23:06:00.000Z' }]} | ${[{ date: ZonedDateTime.parse('2023-07-17T23:06:00.000Z') }, { date: ZonedDateTime.parse('2023-07-17T23:06:00.000Z') }]}
    ${['2023-07-17T23:06:00.000Z', '2023-07-17T23:06:00.000Z']}                     | ${[ZonedDateTime.parse('2023-07-17T23:06:00.000Z'), ZonedDateTime.parse('2023-07-17T23:06:00.000Z')]}
    ${{ date: '2023-07-17T23:06:00.000+01:00' }}                                    | ${{ date: ZonedDateTime.parse('2023-07-17T23:06:00.000+01:00') }}
  `('converts $input expecting $expected', ({ input, expected }) => {
    hierarchicalConvertToJsJoda(input);

    expect(input).toEqual(expected);
  });

  it('leaves local timestamps, durations, and invalid values as strings', () => {
    const input = {
      local: '2023-07-17T23:06:00',
      duration: 'PT1S',
      invalid: '2023-02-30T00:00:00Z',
    };

    hierarchicalConvertToJsJoda(input);

    expect(input).toEqual({
      local: '2023-07-17T23:06:00',
      duration: 'PT1S',
      invalid: '2023-02-30T00:00:00Z',
    });
  });

  it('is a no-op when run twice and leaves non-plain objects untouched', () => {
    const map = new Map([['date', '2023-07-17T23:06:00.000Z']]);
    const input = { date: '2023-07-17T23:06:00.000Z', map };

    hierarchicalConvertToJsJoda(input);
    const { date } = input;
    const snapshot = JSON.stringify(input);
    hierarchicalConvertToJsJoda(input);

    expect(input.date).toBe(date);
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(map.get('date')).toBe('2023-07-17T23:06:00.000Z');
  });
});
