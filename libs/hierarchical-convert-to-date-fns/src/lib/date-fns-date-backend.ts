import type {
  DateBackend,
  DateCodec,
} from '@adaskothebeast/hierarchical-convert-core';
import { parseFractionalIsoDuration } from '@adaskothebeast/hierarchical-convert-core';
import { format, isDate, isValid, parseISO } from 'date-fns';
import type { Duration } from 'date-fns';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/u;
const INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/u;
const DURATION_KEYS = [
  'years',
  'months',
  'weeks',
  'days',
  'hours',
  'minutes',
  'seconds',
] as const;

type DurationKey = (typeof DURATION_KEYS)[number];

function isValidDate(value: unknown): value is Date {
  return isDate(value) && isValid(value);
}

function parseDate(value: string, pattern: RegExp): Date {
  if (!pattern.test(value)) {
    throw new RangeError(`Invalid ISO date value: ${value}`);
  }

  const result = parseISO(value);
  if (!isValid(result)) {
    throw new RangeError(`Invalid ISO date value: ${value}`);
  }
  return result;
}

const instantCodec: DateCodec<Date> = {
  is: isValidDate,
  parse(value) {
    return parseDate(value, INSTANT_PATTERN);
  },
  serialize(value) {
    return value.toISOString();
  },
};

const plainDateCodec: DateCodec<Date> = {
  is: isValidDate,
  parse(value) {
    return parseDate(value, DATE_PATTERN);
  },
  serialize(value) {
    return format(value, 'yyyy-MM-dd');
  },
};

const plainDateTimeCodec: DateCodec<Date> = {
  is: isValidDate,
  parse(value) {
    return parseDate(value, DATE_TIME_PATTERN);
  },
  serialize(value) {
    return format(value, "yyyy-MM-dd'T'HH:mm:ss.SSS");
  },
};

function isDuration(value: unknown): value is Duration {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  return (
    keys.every((key) => DURATION_KEYS.includes(key as DurationKey)) &&
    keys.every((key) => {
      const component = record[key];
      return (
        typeof component === 'number' &&
        Number.isFinite(component) &&
        component >= 0
      );
    })
  );
}

function parseDuration(value: string): Duration {
  const parsed = parseFractionalIsoDuration(value);
  if (parsed === undefined || parsed.sign === '+') {
    throw new RangeError(`Invalid ISO duration value: ${value}`);
  }
  if (parsed.sign === '-') {
    throw new RangeError('date-fns Duration does not support negative values');
  }

  return parsed.components;
}

function serializeDuration(value: Duration): string {
  if (!isDuration(value)) {
    throw new RangeError('Invalid date-fns Duration value');
  }

  const datePart = [
    durationComponent(value, 'years', 'Y'),
    durationComponent(value, 'months', 'M'),
    durationComponent(value, 'weeks', 'W'),
    durationComponent(value, 'days', 'D'),
  ].join('');
  const timePart = [
    durationComponent(value, 'hours', 'H'),
    durationComponent(value, 'minutes', 'M'),
    durationComponent(value, 'seconds', 'S'),
  ].join('');

  if (datePart === '' && timePart === '') {
    return 'PT0S';
  }
  const timeSuffix = timePart === '' ? '' : `T${timePart}`;
  return `P${datePart}${timeSuffix}`;
}

function durationComponent(
  value: Duration,
  key: DurationKey,
  suffix: string,
): string {
  const component = value[key];
  return component === undefined
    ? ''
    : `${formatDurationNumber(component)}${suffix}`;
}

function formatDurationNumber(value: number): string {
  const text = String(value);
  const exponentMarker = text.search(/e/iu);
  if (exponentMarker === -1) {
    return text;
  }

  const coefficient = text.slice(0, exponentMarker);
  const exponent = Number(text.slice(exponentMarker + 1));
  const decimalPoint = coefficient.indexOf('.');
  const digits = coefficient.replace('.', '');
  const decimalIndex =
    (decimalPoint === -1 ? coefficient.length : decimalPoint) + exponent;

  if (decimalIndex <= 0) {
    return `0.${'0'.repeat(-decimalIndex)}${digits}`;
  }
  if (decimalIndex >= digits.length) {
    return `${digits}${'0'.repeat(decimalIndex - digits.length)}`;
  }
  return `${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
}

const durationCodec: DateCodec<Duration> = {
  is: isDuration,
  parse: parseDuration,
  serialize: serializeDuration,
};

export const dateFnsDateBackend = {
  name: 'date-fns',
  codecs: {
    instant: instantCodec,
    'plain-date': plainDateCodec,
    'plain-date-time': plainDateTimeCodec,
    duration: durationCodec,
    period: durationCodec,
  },
} satisfies DateBackend;
