import { Temporal } from '@js-temporal/polyfill';

type TemporalValue =
  | Temporal.Instant
  | Temporal.PlainDateTime
  | Temporal.Duration
  | string
  | number
  | boolean
  | null;
type TemporalObject = {
  [key: string]: TemporalValue | TemporalObject | TemporalArray;
};
type TemporalArray = Array<
  TemporalValue | TemporalObject | TemporalArray
>;

const dateRegex =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|([+-]\d{2}:\d{2}))?$/;
const durationRegex =
  /^-?P(?=.*\d)(?:\d+(?:[.,]\d+)?Y)?(?:\d+(?:[.,]\d+)?M)?(?:\d+(?:[.,]\d+)?W)?(?:\d+(?:[.,]\d+)?D)?(?:T(?=\d)(?:\d+(?:[.,]\d+)?H)?(?:\d+(?:[.,]\d+)?M)?(?:\d+(?:[.,]\d+)?S)?)?$/; // NOSONAR

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function hierarchicalConvertToTemporal(
  obj: unknown,
  depth = 0,
  visited = new WeakSet(),
): void {
  if (typeof obj !== 'object' || obj === null || depth > 100) {
    return;
  }

  if (visited.has(obj)) {
    return;
  }
  visited.add(obj);

  const record = obj as TemporalObject;

  for (const key in record) {
    if (DANGEROUS_KEYS.has(key) || !Object.hasOwn(record, key)) {
      continue;
    }

    const value = record[key];
    if (typeof value === 'string') {
      adjust(record, key, value);
    } else if (typeof value === 'object' && value !== null) {
      hierarchicalConvertToTemporal(value, depth + 1, visited);
    }
  }
}

function adjust(
  record: TemporalObject,
  key: keyof TemporalObject,
  value: string,
): void {
  if (
    value.length >= 19 &&
    value[4] === '-' &&
    value[7] === '-' &&
    value[10] === 'T' &&
    dateRegex.test(value)
  ) {
    try {
      const offsetMarker = value[value.length - 6];
      record[key] =
        value.endsWith('Z') ||
        offsetMarker === '+' ||
        offsetMarker === '-'
          ? Temporal.Instant.from(value)
          : Temporal.PlainDateTime.from(value);
      return;
    } catch (error) {
      console.warn(`Failed to parse date string: ${value}`, error);
    }
  }

  if (
    value.length >= 3 &&
    (value.startsWith('P') || value.startsWith('-P')) &&
    durationRegex.test(value)
  ) {
    try {
      record[key] = Temporal.Duration.from(value);
    } catch (error) {
      console.warn(`Failed to convert duration string: ${value}`, error);
    }
  }
}
