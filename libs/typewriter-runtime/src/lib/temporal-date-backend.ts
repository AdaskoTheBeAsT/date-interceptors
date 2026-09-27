import { Temporal } from '@js-temporal/polyfill';

import type { DateBackend, DateCodec } from './date-backend';

type TemporalTypeName =
  | 'Instant'
  | 'PlainDate'
  | 'PlainTime'
  | 'PlainDateTime'
  | 'ZonedDateTime'
  | 'Duration'
  | 'PlainYearMonth'
  | 'PlainMonthDay';

/**
 * Checks the Temporal brand instead of using `instanceof`, so values created by
 * native Temporal or by another copy of the polyfill are recognized as well.
 */
function isTemporalValue(value: unknown, typeName: TemporalTypeName): boolean {
  if (value instanceof Temporal[typeName]) {
    return true;
  }
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { [Symbol.toStringTag]?: unknown })[Symbol.toStringTag] ===
      `Temporal.${typeName}` &&
    typeof (value as { toString?: unknown }).toString === 'function'
  );
}

function temporalCodec<T extends { toString(): string }>(
  typeName: TemporalTypeName,
  parse: (value: string) => T,
): DateCodec<T> {
  return {
    is: (value): value is T => isTemporalValue(value, typeName),
    parse,
    serialize: (value) => value.toString(),
  };
}

export const temporalDateBackend = {
  name: 'temporal',
  codecs: {
    instant: temporalCodec('Instant', (value) => Temporal.Instant.from(value)),
    'plain-date': temporalCodec('PlainDate', (value) =>
      Temporal.PlainDate.from(value),
    ),
    'plain-time': temporalCodec('PlainTime', (value) =>
      Temporal.PlainTime.from(value),
    ),
    'plain-date-time': temporalCodec('PlainDateTime', (value) =>
      Temporal.PlainDateTime.from(value),
    ),
    'zoned-date-time': temporalCodec('ZonedDateTime', (value) =>
      Temporal.ZonedDateTime.from(value),
    ),
    duration: temporalCodec('Duration', (value) =>
      Temporal.Duration.from(value),
    ),
    period: temporalCodec('Duration', (value) => Temporal.Duration.from(value)),
    'plain-year-month': temporalCodec('PlainYearMonth', (value) =>
      Temporal.PlainYearMonth.from(value),
    ),
    'plain-month-day': temporalCodec('PlainMonthDay', (value) =>
      Temporal.PlainMonthDay.from(value),
    ),
  },
} satisfies DateBackend;
