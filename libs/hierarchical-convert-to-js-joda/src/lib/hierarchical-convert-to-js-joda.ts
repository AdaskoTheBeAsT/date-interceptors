import { ZonedDateTime } from '@js-joda/core';
require('@js-joda/timezone');

/**
 * Represents a value that can be a date string, ZonedDateTime,
 * or a nested structure containing such values.
 */
type DateValue = ZonedDateTime | string | number | boolean | null;
type DateObject = { [key: string]: DateValue | DateObject | DateArray };
type DateArray = Array<DateValue | DateObject | DateArray>;
type RecordWithDate = DateObject;

// Regular expression that matches ISO 8601 date strings
const dateRegex =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|([+-]\d{2}:\d{2}))?$/;

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Function to recursively traverse the object and convert date strings to ZonedDateTime objects in place.
 * @param obj Object to traverse
 * @param depth Current recursion depth (defaults to 0)
 * @param visited WeakSet to track visited objects and prevent circular references
 * @returns Void.
 */
export function hierarchicalConvertToJsJoda(
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
      hierarchicalConvertToJsJoda(v, depth + 1, visited);
    }
  }
}

function adjust(o: RecordWithDate, k: keyof typeof o, v: string): void {
  // Fast rejection for non-date strings
  // ISO 8601 dates are at least 20 chars: "2023-01-01T00:00:00Z"
  if (v.length >= 20 && v[4] === '-' && v[7] === '-' && v[10] === 'T') {
    if (dateRegex.test(v)) {
      try {
        // Convert string to ZonedDateTime object if it matches the date regex
        o[k] = ZonedDateTime.parse(v);
      } catch (e) {
        // Leave as string if parsing fails
        console.warn(`Failed to parse date string: ${v}`, e);
      }
    }
  }
}
