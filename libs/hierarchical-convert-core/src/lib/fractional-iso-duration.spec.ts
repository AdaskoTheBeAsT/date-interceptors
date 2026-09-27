import { parseFractionalIsoDuration } from '../index';

describe('fractional ISO duration parsing', () => {
  it('preserves ordered date and time components, including decimal commas', () => {
    expect(parseFractionalIsoDuration('-P1.5Y2,25M3W4DT5H6M7,25S')).toEqual({
      sign: '-',
      components: {
        years: 1.5,
        months: 2.25,
        weeks: 3,
        days: 4,
        hours: 5,
        minutes: 6,
        seconds: 7.25,
      },
    });
    expect(parseFractionalIsoDuration('+PT0S')).toEqual({
      sign: '+',
      components: { seconds: 0 },
    });
  });

  it.each([
    '',
    'P',
    'PT',
    'P1DT',
    'P1Y2Y',
    'P1D2M',
    'PT1M2H',
    'P1YT2H3D',
    'P1YTT2H',
    'P.5Y',
    'P1.Y',
    'P1,2.3Y',
    'P-1D',
    'P1Dgarbage',
  ])('rejects malformed duration %s', (value) => {
    expect(parseFractionalIsoDuration(value)).toBeUndefined();
  });

  it('permits a trailing T only for backends that already accept it', () => {
    expect(parseFractionalIsoDuration('P1DT')).toBeUndefined();
    expect(parseFractionalIsoDuration('P1DT', true)).toEqual({
      sign: undefined,
      components: { days: 1 },
    });
    expect(parseFractionalIsoDuration('PT', true)).toBeUndefined();
  });
});
