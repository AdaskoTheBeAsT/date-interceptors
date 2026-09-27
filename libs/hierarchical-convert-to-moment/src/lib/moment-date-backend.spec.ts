import moment from 'moment';

import { momentDateBackend } from '../index';

describe('Moment invalid codec values', () => {
  it.each(['instant', 'plain-date', 'plain-date-time', 'duration'] as const)(
    'rejects malformed %s text',
    (kind) => {
      expect(() => momentDateBackend.codecs[kind].parse('invalid')).toThrow(
        RangeError,
      );
    },
  );
  it.each(['instant', 'plain-date', 'plain-date-time'] as const)(
    'rejects an invalid date during %s serialization',
    (kind) => {
      expect(() =>
        momentDateBackend.codecs[kind].serialize(moment.invalid()),
      ).toThrow(RangeError);
    },
  );
  it('rejects an invalid duration during serialization', () => {
    expect(() =>
      momentDateBackend.codecs.duration.serialize(moment.duration(NaN)),
    ).toThrow(RangeError);
  });
});

describe('momentDateBackend', () => {
  it('hydrates and serializes instants in UTC', () => {
    const codec = momentDateBackend.codecs.instant;
    const value = codec.parse('2024-01-02T03:04:05.678+02:00');

    expect(moment.isMoment(value)).toBe(true);
    expect(value.isUTC()).toBe(true);
    expect(codec.serialize(value)).toBe('2024-01-02T01:04:05.678Z');
  });

  it('hydrates and serializes local plain dates without a zone shift', () => {
    const codec = momentDateBackend.codecs['plain-date'];
    const value = codec.parse('2024-01-02');

    expect(moment.isMoment(value)).toBe(true);
    expect(value.format('YYYY-MM-DD')).toBe('2024-01-02');
    expect(codec.serialize(value)).toBe('2024-01-02');
  });

  it('hydrates and serializes local plain date-times without a zone shift', () => {
    const codec = momentDateBackend.codecs['plain-date-time'];
    const value = codec.parse('2024-01-02T03:04:05.678');

    expect(moment.isMoment(value)).toBe(true);
    expect(value.format('YYYY-MM-DDTHH:mm:ss.SSS')).toBe(
      '2024-01-02T03:04:05.678',
    );
    expect(codec.serialize(value)).toBe('2024-01-02T03:04:05.678');
  });

  it('hydrates and serializes ISO durations', () => {
    const codec = momentDateBackend.codecs.duration;
    const value = codec.parse('P1Y2M3DT4H5M6.7S');

    expect(moment.isDuration(value)).toBe(true);
    expect(codec.serialize(value)).toBe('P1Y2M3DT4H5M6.7S');
  });

  it.each(['+P1.5Y', '-PT1,5S', 'P1DT'])(
    'accepts supported duration syntax %s',
    (value) => {
      expect(
        moment.isDuration(momentDateBackend.codecs.duration.parse(value)),
      ).toBe(true);
    },
  );

  it.each(['P', 'PT', 'P1D2D', 'P1DT2H3D', 'P1YTT2H'])(
    'rejects invalid duration syntax %s',
    (value) => {
      expect(() => momentDateBackend.codecs.duration.parse(value)).toThrow(
        RangeError,
      );
    },
  );

  it('does not advertise mappings that Moment cannot preserve', () => {
    expect(momentDateBackend.codecs).not.toHaveProperty('plain-time');
    expect(momentDateBackend.codecs).not.toHaveProperty('zoned-date-time');
    expect(momentDateBackend.codecs).not.toHaveProperty('plain-year-month');
    expect(momentDateBackend.codecs).not.toHaveProperty('plain-month-day');
  });
});
