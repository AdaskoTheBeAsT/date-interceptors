import type {
  DateBackend,
  DateCodec,
} from '@adaskothebeast/hierarchical-convert-core';
import moment from 'moment';

const INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/u;
const PLAIN_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const PLAIN_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?$/u;
const DURATION_PATTERN =
  /^[+-]?P(?=\d|T\d)(?:\d+(?:[.,]\d+)?Y)?(?:\d+(?:[.,]\d+)?M)?(?:\d+(?:[.,]\d+)?W)?(?:\d+(?:[.,]\d+)?D)?(?:T(?:\d+(?:[.,]\d+)?H)?(?:\d+(?:[.,]\d+)?M)?(?:\d+(?:[.,]\d+)?S)?)?$/u;

const PLAIN_DATE_FORMAT = 'YYYY-MM-DD';
const PLAIN_DATE_TIME_FORMATS = [
  'YYYY-MM-DDTHH:mm',
  'YYYY-MM-DDTHH:mm:ss',
  'YYYY-MM-DDTHH:mm:ss.SSS',
];
const SERIALIZED_PLAIN_DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm:ss.SSS';

function validMoment(value: moment.Moment, kind: string): moment.Moment {
  if (!value.isValid()) {
    throw new RangeError(`Invalid ${kind} value`);
  }
  return value;
}

function validDuration(value: moment.Duration, kind: string): moment.Duration {
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
    return validMoment(
      moment.parseZone(value, moment.ISO_8601, true).utc(),
      'instant',
    );
  },
  serialize(value) {
    return validMoment(value, 'instant').clone().utc().toISOString();
  },
};

const plainDateCodec: DateCodec<moment.Moment> = {
  is: moment.isMoment,
  parse(value) {
    if (!PLAIN_DATE_PATTERN.test(value)) {
      throw new RangeError('Invalid plain-date value');
    }
    return validMoment(moment(value, PLAIN_DATE_FORMAT, true), 'plain-date');
  },
  serialize(value) {
    return validMoment(value, 'plain-date').format(PLAIN_DATE_FORMAT);
  },
};

const plainDateTimeCodec: DateCodec<moment.Moment> = {
  is: moment.isMoment,
  parse(value) {
    if (!PLAIN_DATE_TIME_PATTERN.test(value)) {
      throw new RangeError('Invalid plain-date-time value');
    }
    return validMoment(
      moment(value, PLAIN_DATE_TIME_FORMATS, true),
      'plain-date-time',
    );
  },
  serialize(value) {
    return validMoment(value, 'plain-date-time').format(
      SERIALIZED_PLAIN_DATE_TIME_FORMAT,
    );
  },
};

const durationCodec: DateCodec<moment.Duration> = {
  is: moment.isDuration,
  parse(value) {
    if (!DURATION_PATTERN.test(value)) {
      throw new RangeError('Invalid duration value');
    }
    return validDuration(moment.duration(value), 'duration');
  },
  serialize(value) {
    return validDuration(value, 'duration').toISOString();
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
