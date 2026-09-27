import moment from 'moment';

import { hierarchicalConvertToMoment } from '../index';

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

  it('produces local-mode objects and accepts a decimal comma natively', () => {
    const input = {
      zulu: '2023-07-17T23:06:00Z',
      comma: 'PT1,5S',
      negative: '-PT1.5S',
    };

    hierarchicalConvertToMoment(input);

    const zulu = input.zulu as unknown as moment.Moment;
    expect(zulu.isUTC()).toBe(false);
    expect(zulu.valueOf()).toBe(Date.UTC(2023, 6, 17, 23, 6));
    expect((input.comma as unknown as moment.Duration).asMilliseconds()).toBe(
      1500,
    );
    expect(
      (input.negative as unknown as moment.Duration).asMilliseconds(),
    ).toBe(-1500);
  });

  it('keeps the string when Moment reports an invalid value', () => {
    const isValid = jest.spyOn(moment.fn, 'isValid').mockReturnValueOnce(false);
    const input = { date: '2023-07-17T23:06:00.000Z' };

    hierarchicalConvertToMoment(input);

    expect(input.date).toBe('2023-07-17T23:06:00.000Z');
    isValid.mockRestore();
  });

  it('is a no-op when run twice and does not rewrite Moment internals', () => {
    const map = new Map([['date', '2023-07-17T23:06:00.000Z']]);
    const input = {
      date: '2023-07-17T23:06:00.000Z',
      duration: 'PT1S',
      map,
    };

    hierarchicalConvertToMoment(input);
    const date = input.date as unknown as moment.Moment & { _i: unknown };
    const duration = input.duration;
    const originalInput = date._i;
    hierarchicalConvertToMoment(input);

    expect(input.date).toBe(date);
    expect(input.duration).toBe(duration);
    expect(date._i).toBe(originalInput);
    expect(typeof date._i).toBe('string');
    expect(map.get('date')).toBe('2023-07-17T23:06:00.000Z');
  });
});
