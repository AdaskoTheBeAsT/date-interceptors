import { ZonedDateTime } from '@js-joda/core';
require('@js-joda/timezone');

type RecordWithDate = Record<string, string | ZonedDateTime | object>;

// Regular expression that matches ISO 8601 date strings
const dateRegex =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|([+-]\d{2}:\d{2}))?$/;

/**
 * Function to recursively traverse the object and convert date strings to ZonedDateTime objects in place.
 * @param obj Object to traverse
 * @returns Void.
 */
export function hierarchicalConvertToJsJoda(obj: unknown): void {
  if (typeof obj !== 'object') {
    return;
  }

  const o = obj as RecordWithDate;

  for (const key in o) {
    if (!Object.hasOwn(o, key)) {
      continue;
    }

    const v = o[key];
    if (typeof v === 'string') {
      adjust(o, key, v);
    } else if (typeof v === 'object') {
      // Recurse into the object if it's not a string (could be an array or object)
      hierarchicalConvertToJsJoda(v);
    }
  }
}

function adjust(o: RecordWithDate, k: keyof typeof o, v: string): void {
  if (dateRegex.test(v)) {
    // Convert string to ZonedDateTime object if it matches the date regex
    o[k] = ZonedDateTime.parse(v);
  }
}
