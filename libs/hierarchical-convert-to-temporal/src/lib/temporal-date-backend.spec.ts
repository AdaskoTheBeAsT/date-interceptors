import type { DateCodec } from '@adaskothebeast/typewriter-runtime';

import { temporalDateBackend } from '../index';

function expectRoundTrip<T>(codec: DateCodec<T>, wireValue: string): void {
  const parsed = codec.parse(wireValue);

  expect(codec.is(parsed)).toBe(true);
  expect(codec.is(wireValue)).toBe(false);
  expect(codec.serialize(parsed)).toBe(wireValue);
}

describe('temporalDateBackend', () => {
  it('round-trips calendar periods', () => {
    expectRoundTrip(temporalDateBackend.codecs.period, 'P1Y2M');
  });
  it('provides codecs for every schema-aware date kind', () => {
    expectRoundTrip(
      temporalDateBackend.codecs.instant,
      '2024-01-02T03:04:05.123456789Z',
    );
    expectRoundTrip(temporalDateBackend.codecs['plain-date'], '2024-07-21');
    expectRoundTrip(
      temporalDateBackend.codecs['plain-time'],
      '12:34:56.123456789',
    );
    expectRoundTrip(
      temporalDateBackend.codecs['plain-date-time'],
      '2024-07-21T12:34:56.123456789',
    );
    expectRoundTrip(
      temporalDateBackend.codecs['zoned-date-time'],
      '2024-01-02T03:04:05+01:00[Europe/Paris]',
    );
    expectRoundTrip(
      temporalDateBackend.codecs.duration,
      'P1Y2M3DT4H5M6.007008009S',
    );
    expectRoundTrip(temporalDateBackend.codecs['plain-year-month'], '2024-07');
    expectRoundTrip(temporalDateBackend.codecs['plain-month-day'], '07-21');
  });
});
