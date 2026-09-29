import type {
  DateBackend,
  DateCodec,
} from '@adaskothebeast/hierarchical-convert-core';
import { parseFractionalIsoDuration } from '@adaskothebeast/hierarchical-convert-core';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import duration from 'dayjs/plugin/duration.js';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(duration);

const INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/u;
const PLAIN_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const PLAIN_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?$/u;

const PLAIN_DATE_FORMAT = 'YYYY-MM-DD';
const PLAIN_DATE_TIME_FORMATS = [
  'YYYY-MM-DDTHH:mm',
  'YYYY-MM-DDTHH:mm:ss',
  'YYYY-MM-DDTHH:mm:ss.SSS',
];
const SERIALIZED_PLAIN_DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm:ss.SSS';

type DayjsDuration = ReturnType<typeof dayjs.duration>;

function validDayjs(value: dayjs.Dayjs, kind: string): dayjs.Dayjs {
  if (!value.isValid()) {
    throw new RangeError(`Invalid ${kind} value`);
  }
  return value;
}

const instantCodec: DateCodec<dayjs.Dayjs> = {
  is: dayjs.isDayjs,
  parse(value) {
    if (!INSTANT_PATTERN.test(value)) {
      throw new RangeError('Invalid instant value');
    }
    return validDayjs(dayjs(value).utc(), 'instant');
  },
  serialize(value) {
    return validDayjs(value, 'instant').utc().toISOString();
  },
};

const plainDateCodec: DateCodec<dayjs.Dayjs> = {
  is: dayjs.isDayjs,
  parse(value) {
    if (!PLAIN_DATE_PATTERN.test(value)) {
      throw new RangeError('Invalid plain-date value');
    }
    return validDayjs(dayjs(value, PLAIN_DATE_FORMAT, true), 'plain-date');
  },
  serialize(value) {
    return validDayjs(value, 'plain-date').format(PLAIN_DATE_FORMAT);
  },
};

const plainDateTimeCodec: DateCodec<dayjs.Dayjs> = {
  is: dayjs.isDayjs,
  parse(value) {
    if (!PLAIN_DATE_TIME_PATTERN.test(value)) {
      throw new RangeError('Invalid plain-date-time value');
    }
    return validDayjs(
      dayjs(value, PLAIN_DATE_TIME_FORMATS, true),
      'plain-date-time',
    );
  },
  serialize(value) {
    return validDayjs(value, 'plain-date-time').format(
      SERIALIZED_PLAIN_DATE_TIME_FORMAT,
    );
  },
};

const durationCodec: DateCodec<DayjsDuration> = {
  is: dayjs.isDuration,
  parse(value) {
    if (parseFractionalIsoDuration(value, true) === undefined) {
      throw new RangeError('Invalid duration value');
    }
    return dayjs.duration(value);
  },
  serialize(value) {
    return value.toISOString();
  },
};

export const dayjsDateBackend = {
  name: 'dayjs',
  codecs: {
    instant: instantCodec,
    'plain-date': plainDateCodec,
    'plain-date-time': plainDateTimeCodec,
    duration: durationCodec,
    period: durationCodec,
  },
} satisfies DateBackend;
