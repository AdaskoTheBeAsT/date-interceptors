import '@js-joda/timezone';

import type {
  DateBackend,
  DateCodec,
} from '@adaskothebeast/hierarchical-convert-core';
import {
  Duration,
  Instant,
  LocalDate,
  LocalDateTime,
  LocalTime,
  MonthDay,
  Period,
  YearMonth,
  ZonedDateTime,
} from '@js-joda/core';

function jsJodaCodec<T extends { toString(): string }>(
  is: (value: unknown) => value is T,
  parse: (value: string) => T,
): DateCodec<T> {
  return {
    is,
    parse,
    serialize: (value) => value.toString(),
  };
}

export const jsJodaDateBackend = {
  name: 'js-joda',
  codecs: {
    instant: jsJodaCodec(
      (value): value is Instant => value instanceof Instant,
      (value) => Instant.parse(value),
    ),
    'plain-date': jsJodaCodec(
      (value): value is LocalDate => value instanceof LocalDate,
      (value) => LocalDate.parse(value),
    ),
    'plain-time': jsJodaCodec(
      (value): value is LocalTime => value instanceof LocalTime,
      (value) => LocalTime.parse(value),
    ),
    'plain-date-time': jsJodaCodec(
      (value): value is LocalDateTime => value instanceof LocalDateTime,
      (value) => LocalDateTime.parse(value),
    ),
    'zoned-date-time': jsJodaCodec(
      (value): value is ZonedDateTime => value instanceof ZonedDateTime,
      (value) => ZonedDateTime.parse(value),
    ),
    duration: jsJodaCodec(
      (value): value is Duration => value instanceof Duration,
      (value) => Duration.parse(value),
    ),
    period: jsJodaCodec(
      (value): value is Period => value instanceof Period,
      (value) => Period.parse(value),
    ),
    'plain-year-month': jsJodaCodec(
      (value): value is YearMonth => value instanceof YearMonth,
      (value) => YearMonth.parse(value),
    ),
    'plain-month-day': jsJodaCodec(
      (value): value is MonthDay => value instanceof MonthDay,
      (value) => MonthDay.parse(value),
    ),
  },
} satisfies DateBackend;
