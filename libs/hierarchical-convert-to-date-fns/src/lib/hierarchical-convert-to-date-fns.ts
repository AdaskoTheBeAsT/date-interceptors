import { Duration, parseJSON } from 'date-fns';

/**
 * Represents a value that can be a date/duration string, Date, Duration,
 * or a nested structure containing such values.
 */
type DateValue = Date | Duration | string | number | boolean | null;
type DateObject = { [key: string]: DateValue | DateObject | DateArray };
type DateArray = Array<DateValue | DateObject | DateArray>;
type RecordWithDate = DateObject;

// Regular expression that matches ISO 8601 date strings
const dateRegex =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|([+-]\d{2}:\d{2}))?$/;

const durationRegex =
  /^P(?:(?<years>(0|[1-9]\d*))Y)?(?:(?<months>(0|[1-9]\d*))M)?(?:(?<weeks>(0|[1-9]\d*))W)?(?:(?<days>(0|[1-9]\d*))D)?(?:T(?:(?<hours>(0|[1-9]\d*))H)?(?:(?<minutes>(0|[1-9]\d*))M)?(?:(?<seconds>(0|[1-9]\d*))S)?)?$/; // NOSONAR

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Function to recursively traverse the object and convert date strings to Date and Duration objects in place.
 * @param obj Object to traverse
 * @param depth Current recursion depth (defaults to 0)
 * @param visited WeakSet to track visited objects and prevent circular references
 * @returns Void.
 */
export function hierarchicalConvertToDateFns(
  obj: unknown,
  depth = 0,
  visited = new WeakSet(),
): void {
  if (typeof obj !== 'object' || obj === null) {
    return;
  }

  if (depth > 100) {
    return;
  }

  if (visited.has(obj)) {
    return;
  }
  visited.add(obj);

  const o = obj as RecordWithDate;

  for (const key in o) {
    if (DANGEROUS_KEYS.has(key) || !Object.hasOwn(o, key)) {
      continue;
    }

    const v = o[key];
    if (typeof v === 'string') {
      adjust(o, key, v);
    } else if (typeof v === 'object' && v !== null) {
      // Recurse into the object if it's not a string (could be an array or object)
      hierarchicalConvertToDateFns(v, depth + 1, visited);
    }
  }
}

function adjust(o: RecordWithDate, k: keyof typeof o, v: string): void {
  // Fast rejection for non-date strings
  // ISO 8601 dates are at least 20 chars: "2023-01-01T00:00:00Z"
  if (v.length >= 20 && v[4] === '-' && v[7] === '-' && v[10] === 'T') {
    if (dateRegex.test(v)) {
      try {
        // Convert string to Date object if it matches the date regex
        const date = parseJSON(v);
        // Check if date is valid
        if (date && !Number.isNaN(date.getTime())) {
          o[k] = date;
        }
        return;
      } catch (e) {
        // Leave as string if parsing fails
        console.warn(`Failed to parse date string: ${v}`, e);
      }
    }
  }

  // Fast rejection for non-duration strings
  // ISO 8601 durations start with 'P' and are at least 2 chars
  if (v.length >= 2 && v.startsWith('P')) {
    const match = durationRegex.exec(v);
    if (match) {
      try {
        o[k] = convertToDuration(match);
      } catch (e) {
        // Leave as string if conversion fails
        console.warn(`Failed to convert duration string: ${v}`, e);
      }
    }
  }
}

function convertToDuration(match: RegExpExecArray): Duration {
  // Convert string to Duration object if it matches the duration regex
  const { years, months, weeks, days, hours, minutes, seconds } =
    match.groups as {
      years?: string;
      months?: string;
      weeks?: string;
      days?: string;
      hours?: string;
      minutes?: string;
      seconds?: string;
    };

  const duration: Duration = {
    years: Number(years) || 0,
    months: Number(months) || 0,
    weeks: Number(weeks) || 0,
    days: Number(days) || 0,
    hours: Number(hours) || 0,
    minutes: Number(minutes) || 0,
    seconds: Number(seconds) || 0,
  };

  return duration;
}
