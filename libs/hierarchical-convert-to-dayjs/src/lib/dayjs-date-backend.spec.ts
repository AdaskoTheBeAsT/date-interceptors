import dayjs from 'dayjs';

import { dayjsDateBackend } from './dayjs-date-backend';

describe('dayjsDateBackend', () => {
  it('hydrates and serializes instants in UTC', () => {
    const codec = dayjsDateBackend.codecs.instant;
    const value = codec.parse('2024-01-02T03:04:05.678+02:00');

    expect(dayjs.isDayjs(value)).toBe(true);
    expect(value.isUTC()).toBe(true);
    expect(codec.serialize(value)).toBe('2024-01-02T01:04:05.678Z');
  });

  it('hydrates and serializes local plain dates without a zone shift', () => {
    const codec = dayjsDateBackend.codecs['plain-date'];
    const value = codec.parse('2024-01-02');

    expect(dayjs.isDayjs(value)).toBe(true);
    expect(value.format('YYYY-MM-DD')).toBe('2024-01-02');
    expect(codec.serialize(value)).toBe('2024-01-02');
  });

  it('hydrates and serializes local plain date-times without a zone shift', () => {
    const codec = dayjsDateBackend.codecs['plain-date-time'];
    const value = codec.parse('2024-01-02T03:04:05.678');

    expect(dayjs.isDayjs(value)).toBe(true);
    expect(value.format('YYYY-MM-DDTHH:mm:ss.SSS')).toBe(
      '2024-01-02T03:04:05.678',
    );
    expect(codec.serialize(value)).toBe('2024-01-02T03:04:05.678');
  });

  it('hydrates and serializes ISO durations', () => {
    const codec = dayjsDateBackend.codecs.duration;
    const value = codec.parse('P1Y2M3DT4H5M6.7S');

    expect(dayjs.isDuration(value)).toBe(true);
    expect(codec.serialize(value)).toBe('P1Y2M3DT4H5M6.7S');
  });

  it('does not advertise mappings that Day.js cannot preserve', () => {
    expect(dayjsDateBackend.codecs).not.toHaveProperty('plain-time');
    expect(dayjsDateBackend.codecs).not.toHaveProperty('zoned-date-time');
    expect(dayjsDateBackend.codecs).not.toHaveProperty('plain-year-month');
    expect(dayjsDateBackend.codecs).not.toHaveProperty('plain-month-day');
  });
});
