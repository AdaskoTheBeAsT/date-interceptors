import type { DateCodec } from '@adaskothebeast/typewriter-runtime';
import type { Duration } from 'date-fns';

import { dateFnsDateBackend } from '../index';

describe('dateFnsDateBackend', () => {
  const { codecs } = dateFnsDateBackend;

  it.each([
    [{}, 'PT0S'],
    [{ seconds: 1e-7 }, 'PT0.0000001S'],
    [{ seconds: 1.23e-7 }, 'PT0.000000123S'],
    [{ seconds: 1e21 }, 'PT1000000000000000000000S'],
    [{ seconds: 1.23e21 }, 'PT1230000000000000000000S'],
  ] as const)(
    'serializes duration %p without exponent notation',
    (value, expected) => {
      expect(codecs.duration.serialize(value)).toBe(expected);
      expect(codecs.duration.parse(expected)).toEqual(
        Object.keys(value).length ? value : { seconds: 0 },
      );
    },
  );

  it.each([
    null,
    [],
    { days: NaN },
    { days: Infinity },
    { days: '1' },
    { unknown: 1 },
  ])('rejects a malformed duration %p', (value) => {
    expect(codecs.duration.is(value)).toBe(false);
    expect(() => codecs.duration.serialize(value as Duration)).toThrow(
      RangeError,
    );
  });

  it.each([
    ['instant', '2024-02-29T12:34:56.789+01:00'],
    ['plain-date', '2024-02-29'],
    ['plain-date-time', '2024-02-29T12:34:56.789'],
    ['duration', 'P1Y2M3W4DT5H6M7.25S'],
  ] as const)('round-trips the %s codec', (kind, wireValue) => {
    const codec = codecs[kind] as DateCodec;
    const parsed = codec.parse(wireValue);

    expect(codec.is(parsed)).toBe(true);
    expect(codec.is(wireValue)).toBe(false);
    expect(codec.parse(codec.serialize(parsed))).toEqual(parsed);
  });

  it('uses native Date values for supported date schemas', () => {
    expect(codecs.instant.parse('2024-02-29T12:34:56Z')).toBeInstanceOf(Date);
    expect(codecs['plain-date'].parse('2024-02-29')).toBeInstanceOf(Date);
    expect(
      codecs['plain-date-time'].parse('2024-02-29T12:34:56'),
    ).toBeInstanceOf(Date);
  });

  it('normalizes instants to UTC when serializing', () => {
    expect(
      codecs.instant.serialize(
        codecs.instant.parse('2024-02-29T12:34:56.789+01:00'),
      ),
    ).toBe('2024-02-29T11:34:56.789Z');
  });

  it('preserves all supported date-fns Duration fields', () => {
    const duration = codecs.duration.parse('P1Y2M3W4DT5H6M7.25S') as Duration;

    expect(duration).toEqual({
      years: 1,
      months: 2,
      weeks: 3,
      days: 4,
      hours: 5,
      minutes: 6,
      seconds: 7.25,
    });
    expect(codecs.duration.serialize(duration)).toBe('P1Y2M3W4DT5H6M7.25S');
  });

  it('preserves explicitly represented zero duration fields', () => {
    expect(codecs.duration.parse('P0D')).toEqual({ days: 0 });
    expect(codecs.duration.serialize({ days: 0 })).toBe('P0D');
  });

  it('rejects negative durations because date-fns has no duration sign', () => {
    expect(() => codecs.duration.parse('-P1D')).toThrow(RangeError);
    expect(codecs.duration.is({ days: -1 })).toBe(false);
    expect(() => codecs.duration.serialize({ days: -1 })).toThrow(RangeError);
  });

  it('does not advertise unsupported date semantics', () => {
    expect(Object.keys(codecs).sort()).toEqual([
      'duration',
      'instant',
      'period',
      'plain-date',
      'plain-date-time',
    ]);
  });

  it.each([
    ['instant', '2024-02-29T12:34:56'],
    ['plain-date', '2024-02-30'],
    ['plain-date-time', '2024-02-29T12:34:56Z'],
    ['duration', 'P'],
  ] as const)('rejects invalid %s strings', (kind, wireValue) => {
    expect(() => codecs[kind].parse(wireValue)).toThrow();
  });
});
