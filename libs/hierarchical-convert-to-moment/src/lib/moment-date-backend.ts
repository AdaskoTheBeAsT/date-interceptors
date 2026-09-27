import type {
  DateBackend,
  DateCodec,
} from '@adaskothebeast/hierarchical-convert-core';
import { parseFractionalIsoDuration } from '@adaskothebeast/hierarchical-convert-core';
import moment from 'moment';

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

function validValue<T extends moment.Moment | moment.Duration>(
  value: T,
  kind: string,
): T {
  if (!value.isValid()) {
    throw new RangeError(`Invalid ${kind} value`);
  }
  return value;
}

const instantCodec: DateCodec<moment.Moment> = {
  is: moment.isMoment,
  parse(value) {
    if (!INSTANT_PATTERN.test(value)) {
      throw new RangeError('Invalid instant value');
    }
    return validValue(
      moment.parseZone(value, moment.ISO_8601, true).utc(),
      'instant',
    );
  },
  serialize(value) {
    return validValue(value, 'instant').clone().utc().toISOString();
  },
};

const plainDateCodec: DateCodec<moment.Moment> = {
  is: moment.isMoment,
  parse(value) {
    if (!PLAIN_DATE_PATTERN.test(value)) {
      throw new RangeError('Invalid plain-date value');
    }
    return validValue(moment(value, PLAIN_DATE_FORMAT, true), 'plain-date');
  },
  serialize(value) {
    return validValue(value, 'plain-date').format(PLAIN_DATE_FORMAT);
  },
};

const plainDateTimeCodec: DateCodec<moment.Moment> = {
  is: moment.isMoment,
  parse(value) {
    if (!PLAIN_DATE_TIME_PATTERN.test(value)) {
      throw new RangeError('Invalid plain-date-time value');
    }
    return validValue(
      moment(value, PLAIN_DATE_TIME_FORMATS, true),
      'plain-date-time',
    );
  },
  serialize(value) {
    return validValue(value, 'plain-date-time').format(
      SERIALIZED_PLAIN_DATE_TIME_FORMAT,
    );
  },
};

const durationCodec: DateCodec<moment.Duration> = {
  is: moment.isDuration,
  parse(value) {
    if (parseFractionalIsoDuration(value, true) === undefined) {
      throw new RangeError('Invalid duration value');
    }
    return validValue(moment.duration(value), 'duration');
  },
  serialize(value) {
    return validValue(value, 'duration').toISOString();
  },
};

export const momentDateBackend = {
  name: 'moment',
  codecs: {
    instant: instantCodec,
    'plain-date': plainDateCodec,
    'plain-date-time': plainDateTimeCodec,
    duration: durationCodec,
    period: durationCodec,
  },
} satisfies DateBackend;
