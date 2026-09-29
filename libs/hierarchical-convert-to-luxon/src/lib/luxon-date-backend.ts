import type {
  DateBackend,
  DateCodec,
} from '@adaskothebeast/hierarchical-convert-core';
import { DateTime, Duration, IANAZone } from 'luxon';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const TIME_PATTERN = /^\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/u;
const DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/u;
const INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/u;
const YEAR_MONTH_PATTERN = /^\d{4}-\d{2}$/u;
const ZONED_DATE_TIME_SUFFIX = /(Z|[+-]\d{2}:\d{2})\[([^\]]+)\]$/u;

function isDateTime(value: unknown): value is DateTime {
  return DateTime.isDateTime(value) && value.isValid;
}

function parseDateTime(
  value: string,
  pattern: RegExp,
  options: Parameters<typeof DateTime.fromISO>[1],
): DateTime {
  if (!pattern.test(value)) {
    throw new RangeError(`Invalid ISO date value: ${value}`);
  }

  const result = DateTime.fromISO(value, options);
  if (!result.isValid) {
    throw new RangeError(`Invalid ISO date value: ${value}`);
  }
  return result;
}

function required(value: string | null, description: string): string {
  if (value === null) {
    throw new RangeError(`Unable to serialize ${description}`);
  }
  return value;
}

const instantCodec: DateCodec<DateTime> = {
  is: isDateTime,
  parse(value) {
    return parseDateTime(value, INSTANT_PATTERN, { setZone: true }).toUTC();
  },
  serialize(value) {
    return required(value.toUTC().toISO(), 'instant');
  },
};

const plainDateCodec: DateCodec<DateTime> = {
  is: isDateTime,
  parse(value) {
    return parseDateTime(value, DATE_PATTERN, { zone: 'utc' });
  },
  serialize(value) {
    return required(value.toISODate(), 'plain date');
  },
};

const plainTimeCodec: DateCodec<DateTime> = {
  is: isDateTime,
  parse(value) {
    if (!TIME_PATTERN.test(value)) {
      throw new RangeError(`Invalid ISO time value: ${value}`);
    }
    return parseDateTime(`2000-01-01T${value}`, DATE_TIME_PATTERN, {
      zone: 'utc',
    });
  },
  serialize(value) {
    return required(value.toISOTime({ includeOffset: false }), 'plain time');
  },
};

const plainDateTimeCodec: DateCodec<DateTime> = {
  is: isDateTime,
  parse(value) {
    return parseDateTime(value, DATE_TIME_PATTERN, { zone: 'utc' });
  },
  serialize(value) {
    return required(value.toISO({ includeOffset: false }), 'plain date-time');
  },
};

const zonedDateTimeCodec: DateCodec<DateTime> = {
  is: isDateTime,
  parse(value) {
    const match = ZONED_DATE_TIME_SUFFIX.exec(value);
    if (
      match === null ||
      !DATE_TIME_PATTERN.test(value.slice(0, match.index))
    ) {
      throw new RangeError(`Invalid zoned date-time value: ${value}`);
    }

    const localDateTime = value.slice(0, match.index);
    const [, offset, zone] = match;
    if (!IANAZone.isValidZone(zone)) {
      throw new RangeError(`Invalid IANA time zone: ${zone}`);
    }

    const result = DateTime.fromISO(localDateTime, { zone });
    if (!result.isValid || result.offset !== parseOffset(offset)) {
      throw new RangeError(`Invalid zoned date-time value: ${value}`);
    }
    return result;
  },
  serialize(value) {
    const zoneName = value.zoneName;
    if (zoneName === null || !IANAZone.isValidZone(zoneName)) {
      throw new RangeError('Zoned date-time requires an IANA time zone');
    }
    return `${required(value.toISO(), 'zoned date-time')}[${zoneName}]`;
  },
};

const durationCodec: DateCodec<Duration> = {
  is(value): value is Duration {
    return Duration.isDuration(value) && value.isValid;
  },
  parse(value) {
    const result = Duration.fromISO(value);
    if (!result.isValid) {
      throw new RangeError(`Invalid ISO duration value: ${value}`);
    }
    return result;
  },
  serialize(value) {
    return required(value.toISO(), 'duration');
  },
};

const plainYearMonthCodec: DateCodec<DateTime> = {
  is: isDateTime,
  parse(value) {
    if (!YEAR_MONTH_PATTERN.test(value)) {
      throw new RangeError(`Invalid ISO year-month value: ${value}`);
    }
    return parseDateTime(`${value}-01`, DATE_PATTERN, { zone: 'utc' });
  },
  serialize(value) {
    return value.toFormat('yyyy-MM');
  },
};

const plainMonthDayCodec: DateCodec<DateTime> = {
  is: isDateTime,
  parse(value) {
    if (
      !value.startsWith('--') ||
      !DATE_PATTERN.test(`2000-${value.slice(2)}`)
    ) {
      throw new RangeError(`Invalid ISO month-day value: ${value}`);
    }
    return parseDateTime(`2000-${value.slice(2)}`, DATE_PATTERN, {
      zone: 'utc',
    });
  },
  serialize(value) {
    return value.toFormat("'--'MM-dd");
  },
};

function parseOffset(value: string): number {
  if (value === 'Z') {
    return 0;
  }

  const sign = value[0] === '-' ? -1 : 1;
  return sign * (Number(value.slice(1, 3)) * 60 + Number(value.slice(4, 6)));
}

export const luxonDateBackend = {
  name: 'luxon',
  codecs: {
    instant: instantCodec,
    'plain-date': plainDateCodec,
    'plain-time': plainTimeCodec,
    'plain-date-time': plainDateTimeCodec,
    'zoned-date-time': zonedDateTimeCodec,
    duration: durationCodec,
    period: durationCodec,
    'plain-year-month': plainYearMonthCodec,
    'plain-month-day': plainMonthDayCodec,
  },
} satisfies DateBackend;
