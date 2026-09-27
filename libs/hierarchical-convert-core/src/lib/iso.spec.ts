import {
  isIsoDateTime,
  isIsoDuration,
  millisecondDateTime,
  normalizeIsoDuration,
  parseIsoDateTime,
  parseIsoDuration,
} from '../index';

describe('ISO recognition contract', () => {
  it.each([
    '2000-02-29T23:59:59Z',
    '2024-02-29T00:00:00',
    '2024-01-01T12:30:45.1-05:30',
    '2024-01-01T12:30:45.123456789+02:00',
  ])('accepts a valid timestamp %s', (value) => {
    expect(isIsoDateTime(value)).toBe(true);
  });

  it.each([
    '',
    '2024-01-01',
    '2024/01/01T00:00:00',
    '1900-02-29T00:00:00Z',
    '2023-02-29T00:00:00Z',
    '2024-00-01T00:00:00Z',
    '2024-13-01T00:00:00Z',
    '2024-01-00T00:00:00Z',
    '2024-04-31T00:00:00Z',
    '2024-01-01T24:00:00Z',
    '2024-01-01T00:60:00Z',
    '2024-01-01T00:00:60Z',
    '2024-01-01T00:00:00+24:00',
    '2024-01-01T00:00:00+00:60',
    '2024-01-01T00:00:00.1234567890Z',
  ])('rejects invalid or unsupported input %s', (value) => {
    expect(isIsoDateTime(value)).toBe(false);
  });

  it.each([
    'PT0S',
    'PT3H',
    'P1Y',
    'P1Y2M3DT4H5M6.123456789S',
    '-PT1.5S',
    'P2W',
  ])('recognizes a duration %s', (value) => {
    expect(isIsoDuration(value)).toBe(true);
  });

  it.each([
    'P',
    'PT',
    '-T1H',
    'P1DT',
    'P-1D',
    'PT1.1234567890S',
    'P1YTT2H',
    'P1YT2H3D',
    'PT2H1Y',
  ])('rejects an incomplete or unsupported duration %s', (value) => {
    expect(isIsoDuration(value)).toBe(false);
  });

  it.each([
    ['2024-01-01T00:00:00', false],
    ['2024-01-01T00:00:00.123456789', false],
    ['2024-01-01T00:00:00Z', true],
    ['2024-01-01T00:00:00.1+05:30', true],
    ['2024-01-01T00:00:00-00:00', true],
  ])('reports whether %s carries an offset', (value, hasOffset) => {
    expect(parseIsoDateTime(value)).toEqual({ hasOffset });
  });

  it.each(['2024-01-01', '2024-02-30T00:00:00Z', '2024-01-01T00:00:00+2:00'])(
    'returns undefined for the unrecognised timestamp %s',
    (value) => {
      expect(parseIsoDateTime(value)).toBeUndefined();
    },
  );

  it('parses duration components with either decimal separator', () => {
    expect(parseIsoDuration('P1Y2M3W4DT5H6M7,25S')).toEqual({
      negative: false,
      components: {
        years: 1,
        months: 2,
        weeks: 3,
        days: 4,
        hours: 5,
        minutes: 6,
        seconds: 7.25,
      },
    });
    expect(parseIsoDuration('-PT0.123456789S')).toEqual({
      negative: true,
      components: {
        years: 0,
        months: 0,
        weeks: 0,
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0.123456789,
      },
    });
    expect(parseIsoDuration('P2W')?.components).toEqual({
      years: 0,
      months: 0,
      weeks: 2,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    });
    expect(parseIsoDuration('P1,5D')).toBeUndefined();
    expect(parseIsoDuration('PT')).toBeUndefined();
  });

  it('normalizes a decimal comma to a decimal point', () => {
    expect(normalizeIsoDuration('PT1,5S')).toBe('PT1.5S');
    expect(normalizeIsoDuration('-P1DT1.5S')).toBe('-P1DT1.5S');
  });

  it('truncates fractional precision without rounding across a second boundary', () => {
    expect(millisecondDateTime('2024-12-31T23:59:59.999999999Z')).toBe(
      '2024-12-31T23:59:59.999Z',
    );
    expect(millisecondDateTime('2024-01-01T00:00:00.1+02:00')).toBe(
      '2024-01-01T00:00:00.100+02:00',
    );
    expect(millisecondDateTime('2024-01-01T00:00:00Z')).toBe(
      '2024-01-01T00:00:00Z',
    );
  });
});
