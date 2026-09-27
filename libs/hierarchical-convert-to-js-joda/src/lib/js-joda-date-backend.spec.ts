import type { DateCodec } from '@adaskothebeast/typewriter-runtime';

import { jsJodaDateBackend } from '../index';

function expectRoundTrip<T>(codec: DateCodec<T>, wireValue: string): void {
  const parsed = codec.parse(wireValue);

  expect(codec.is(parsed)).toBe(true);
  expect(codec.is(wireValue)).toBe(false);
  expect(codec.serialize(parsed)).toBe(wireValue);
}

describe('jsJodaDateBackend', () => {
  it('provides codecs for every schema-aware date kind', () => {
    expectRoundTrip(
      jsJodaDateBackend.codecs.instant,
      '2024-01-02T03:04:05.123456789Z',
    );
    expectRoundTrip(jsJodaDateBackend.codecs['plain-date'], '2024-07-21');
    expectRoundTrip(
      jsJodaDateBackend.codecs['plain-time'],
      '12:34:56.123456789',
    );
    expectRoundTrip(
      jsJodaDateBackend.codecs['plain-date-time'],
      '2024-07-21T12:34:56.123456789',
    );
    expectRoundTrip(
      jsJodaDateBackend.codecs['zoned-date-time'],
      '2024-01-02T03:04:05+01:00[Europe/Paris]',
    );
    expectRoundTrip(jsJodaDateBackend.codecs.duration, 'PT26H3M4.005S');
    expectRoundTrip(jsJodaDateBackend.codecs.period, 'P1Y2M3D');
    expectRoundTrip(jsJodaDateBackend.codecs['plain-year-month'], '2024-07');
    expectRoundTrip(jsJodaDateBackend.codecs['plain-month-day'], '--07-21');
  });
});
