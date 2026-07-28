import type { DateCodec } from '@adaskothebeast/typewriter-runtime';
import { DateTime, Duration } from 'luxon';

import { luxonDateBackend } from './luxon-date-backend';

describe('luxonDateBackend', () => {
  const { codecs } = luxonDateBackend;

  it.each([
    ['instant', '2024-02-29T12:34:56.789+01:00'],
    ['plain-date', '2024-02-29'],
    ['plain-time', '12:34:56.789'],
    ['plain-date-time', '2024-02-29T12:34:56.789'],
    ['duration', '-P1Y2M3DT4H5M6.789S'],
    ['plain-year-month', '2024-02'],
    ['plain-month-day', '--02-29'],
  ] as const)('round-trips the %s codec', (kind, wireValue) => {
    const codec = codecs[kind] as DateCodec;
    const parsed = codec.parse(wireValue);

    expect(codec.is(parsed)).toBe(true);
    expect(codec.is(wireValue)).toBe(false);
    expect(codec.parse(codec.serialize(parsed))).toEqual(parsed);
  });

  it('normalizes instants to UTC when serializing', () => {
    const codec = codecs.instant;

    expect(
      codec.serialize(codec.parse('2024-02-29T12:34:56.789+01:00')),
    ).toBe('2024-02-29T11:34:56.789Z');
  });

  it('anchors plain times while serializing only their time', () => {
    const codec = codecs['plain-time'];
    const parsed = codec.parse('12:34:56.789');

    expect(DateTime.isDateTime(parsed)).toBe(true);
    expect(parsed.toISODate()).toBe('2000-01-01');
    expect(codec.serialize(parsed)).toBe('12:34:56.789');
  });

  it('preserves an IANA zone in bracketed zoned date-times', () => {
    const codec = codecs['zoned-date-time'];
    const parsed = codec.parse(
      '2024-07-01T12:34:56.789+02:00[Europe/Paris]',
    );

    expect(parsed.zoneName).toBe('Europe/Paris');
    expect(codec.serialize(parsed)).toBe(
      '2024-07-01T12:34:56.789+02:00[Europe/Paris]',
    );
  });

  it('rejects a zoned date-time whose offset disagrees with its zone', () => {
    expect(() =>
      codecs['zoned-date-time'].parse(
        '2024-07-01T12:34:56+01:00[Europe/Paris]',
      ),
    ).toThrow(RangeError);
  });

  it('uses Luxon Duration values', () => {
    const parsed = codecs.duration.parse('P1DT2H');

    expect(Duration.isDuration(parsed)).toBe(true);
    expect(parsed.toObject()).toEqual({ days: 1, hours: 2 });
  });

  it.each([
    ['instant', '2024-02-29T12:34:56'],
    ['plain-date', '2024-02-30'],
    ['plain-time', '25:00'],
    ['plain-date-time', '2024-02-29T12:34:56Z'],
    ['zoned-date-time', '2024-02-29T12:34:56+01:00'],
    ['duration', 'not-a-duration'],
    ['plain-year-month', '2024-13'],
    ['plain-month-day', '--02-30'],
  ] as const)('rejects invalid %s strings', (kind, wireValue) => {
    expect(() => codecs[kind].parse(wireValue)).toThrow();
  });
});
