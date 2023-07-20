import { hierarchicalConvertToDate } from './hierarchical-convert-to-date';

describe('hierarchicalConvertToDate', () => {
  it.each`
    input                                                                           | expected
    ${{}}                                                                           | ${{}}
    ${{ text: 'adam' }}                                                             | ${{ text: 'adam' }}
    ${{ date: '2023-07-17T23:06:00.000Z' }}                                         | ${{ date: new Date('2023-07-17T23:06:00.000Z') }}
    ${{ someNewObj: { text: 'adam', date: '2023-07-17T23:06:00.000Z' } }}           | ${{ someNewObj: { text: 'adam', date: new Date('2023-07-17T23:06:00.000Z') } }}
    ${[{ date: '2023-07-17T23:06:00.000Z' }, { date: '2023-07-17T23:06:00.000Z' }]} | ${[{ date: new Date('2023-07-17T23:06:00.000Z') }, { date: new Date('2023-07-17T23:06:00.000Z') }]}
  `('converts $input expecting $expected', ({ input, expected }) => {
    hierarchicalConvertToDate(input);
    expect(input).toEqual(expected);
  });
});
