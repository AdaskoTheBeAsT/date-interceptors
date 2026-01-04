import moment from 'moment';

/**
 * Represents a value that can be a date/duration string, Moment, Duration,
 * or a nested structure containing such values.
 */
type DateValue = moment.Moment | moment.Duration | string | number | boolean | null;
type DateObject = { [key: string]: DateValue | DateObject | DateArray };
type DateArray = Array<DateValue | DateObject | DateArray>;
type RecordWithMomentAndDuration = DateObject;

// Regular expression that matches ISO 8601 date strings
const dateRegex =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|([+-]\d{2}:\d{2}))?$/;
const durationRegex =
  /^P(?:(0|[1-9]\d*)Y)?(?:(0|[1-9]\d*)M)?(?:(0|[1-9]\d*)W)?(?:(0|[1-9]\d*)D)?(?:T(?:(0|[1-9]\d*)H)?(?:(0|[1-9]\d*)M)?(?:(0|[1-9]\d*)S)?)?$/; // NOSONAR

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Function to recursively traverse the object and convert date strings to Moment and Duration objects in place.
 * @param obj Object to traverse
 * @param depth Current recursion depth (defaults to 0)
 * @param visited WeakSet to track visited objects and prevent circular references
 * @returns Void.
 */
export function hierarchicalConvertToMoment(
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

  const o = obj as RecordWithMomentAndDuration;

  for (const key in o) {
    if (DANGEROUS_KEYS.has(key) || !Object.hasOwn(o, key)) {
      continue;
    }

    const v = o[key];
    if (typeof v === 'string') {
      adjust(o, key, v);
    } else if (typeof v === 'object' && v !== null) {
      // Recurse into the object if it's not a string (could be an array or object)
      hierarchicalConvertToMoment(v, depth + 1, visited);
    }
  }
}

function adjust(
  o: RecordWithMomentAndDuration,
  k: keyof typeof o,
  v: string,
): void {
  // Fast rejection for non-date strings
  // ISO 8601 dates are at least 20 chars: "2023-01-01T00:00:00Z"
  if (v.length >= 20 && v[4] === '-' && v[7] === '-' && v[10] === 'T') {
    if (dateRegex.test(v)) {
      try {
        // Convert string to Moment object if it matches the date regex
        const date = moment(v);
        // Check if date is valid
        if (date.isValid()) {
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
        // Convert string to Duration object if it matches the duration regex
        o[k] = moment.duration(v);
      } catch (e) {
        // Leave as string if conversion fails
        console.warn(`Failed to convert duration string: ${v}`, e);
      }
    }
  }
}
