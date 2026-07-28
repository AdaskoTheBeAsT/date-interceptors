import { Temporal } from '@js-temporal/polyfill';
import type {
  DateBackend,
  DateCodec,
} from '@adaskothebeast/typewriter-runtime';

function temporalCodec<T extends { toString(): string }>(
  is: (value: unknown) => value is T,
  parse: (value: string) => T,
): DateCodec<T> {
  return {
    is,
    parse,
    serialize: (value) => value.toString(),
  };
}

export const temporalDateBackend = {
  name: 'temporal',
  codecs: {
    instant: temporalCodec(
      (value): value is Temporal.Instant =>
        value instanceof Temporal.Instant,
      (value) => Temporal.Instant.from(value),
    ),
    'plain-date': temporalCodec(
      (value): value is Temporal.PlainDate =>
        value instanceof Temporal.PlainDate,
      (value) => Temporal.PlainDate.from(value),
    ),
    'plain-time': temporalCodec(
      (value): value is Temporal.PlainTime =>
        value instanceof Temporal.PlainTime,
      (value) => Temporal.PlainTime.from(value),
    ),
    'plain-date-time': temporalCodec(
      (value): value is Temporal.PlainDateTime =>
        value instanceof Temporal.PlainDateTime,
      (value) => Temporal.PlainDateTime.from(value),
    ),
    'zoned-date-time': temporalCodec(
      (value): value is Temporal.ZonedDateTime =>
        value instanceof Temporal.ZonedDateTime,
      (value) => Temporal.ZonedDateTime.from(value),
    ),
    duration: temporalCodec(
      (value): value is Temporal.Duration =>
        value instanceof Temporal.Duration,
      (value) => Temporal.Duration.from(value),
    ),
    period: temporalCodec(
      (value): value is Temporal.Duration =>
        value instanceof Temporal.Duration,
      (value) => Temporal.Duration.from(value),
    ),
    'plain-year-month': temporalCodec(
      (value): value is Temporal.PlainYearMonth =>
        value instanceof Temporal.PlainYearMonth,
      (value) => Temporal.PlainYearMonth.from(value),
    ),
    'plain-month-day': temporalCodec(
      (value): value is Temporal.PlainMonthDay =>
        value instanceof Temporal.PlainMonthDay,
      (value) => Temporal.PlainMonthDay.from(value),
    ),
  },
} satisfies DateBackend;
